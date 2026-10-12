// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title Proof of Met
/// @notice A public graph of which Stand-In pets have met. A meeting is written by one
///         pet's wallet and must carry the other pet's signature: either over a fresh
///         single-use code that pet was showing (an in-person meeting), or over a plain
///         approval of this one friend (a link or an NFC sticker, which could have been
///         forwarded). Anyone can read the graph; rooms below are one thing built on it:
///         a group you may join only if enough of its members have met you.
/// @dev    Pets are plain addresses. This contract does not know who holds their keys.
contract ProofOfMet {
    enum Method {
        Link, // static link or NFC sticker: both sides agreed, presence not shown
        Code // a fresh rotating code was scanned: the two screens were in the same place
    }

    struct Meet {
        address a; // the pet that showed its code (or approved the link)
        address b; // the pet that scanned and recorded the meeting
        uint64 at;
        uint64 gatheringId; // 0 when not at a gathering
        Method method;
        bytes32 chatHash; // keccak256 of the two pets' first chat, kept off-chain
    }

    struct Gathering {
        address host;
        string name;
        uint64 startsAt;
        uint64 endsAt;
        uint32 meets;
        uint32 attendees;
    }

    struct Room {
        address creator;
        string name;
        uint16 threshold; // members who must have met you before you may join
        bool inPersonOnly; // count Code meetings only
        address[] members;
    }

    /// A code must be recorded within this long of being issued.
    uint256 public constant CODE_WINDOW = 15 minutes;
    /// Allowance for the issuer's clock running ahead of the chain's.
    uint256 public constant CLOCK_SKEW = 2 minutes;
    /// New friends one pet may add in any hour, so a leaked key cannot farm the graph.
    uint256 public constant MAX_NEW_PER_HOUR = 30;

    Meet[] private _meets;
    mapping(bytes32 pair => uint256 indexPlusOne) private _pairIndex;
    mapping(address pet => address[]) private _friends;
    mapping(address pet => mapping(bytes32 nonce => bool)) public codeUsed;
    mapping(address pet => uint256) private _hourStart;
    mapping(address pet => uint256) private _hourCount;

    Gathering[] private _gatherings; // id is index + 1
    mapping(uint256 gatheringId => mapping(address pet => bool)) public attended;

    Room[] private _rooms; // id is index + 1
    mapping(uint256 roomId => mapping(address pet => bool)) public isMember;

    event Met(
        uint256 indexed meetId, address indexed a, address indexed b, Method method, uint64 gatheringId, bytes32 chatHash
    );
    event GatheringCreated(uint256 indexed gatheringId, address indexed host, string name, uint64 startsAt, uint64 endsAt);
    event RoomCreated(uint256 indexed roomId, address indexed creator, string name, uint16 threshold, bool inPersonOnly);
    event Joined(uint256 indexed roomId, address indexed pet, uint256 vouches);

    error Yourself();
    error AlreadyMet();
    error BadSignature();
    error CodeExpired();
    error CodeUsed();
    error TooManyNewFriends();
    error UnknownGathering();
    error GatheringClosed();
    error GatheringNeedsCode();
    error BadWindow();
    error UnknownRoom();
    error AlreadyMember();
    error NotEnoughVouches(uint256 have, uint256 need);
    error BadThreshold();

    // ------------------------------------------------------------------ meetings

    /// @notice What pet `a` signs to show a code: valid once, for CODE_WINDOW.
    function codeDigest(address a, uint64 gatheringId, uint64 issuedAt, bytes32 nonce) public view returns (bytes32) {
        return keccak256(abi.encode("StandIn code", address(this), block.chainid, a, gatheringId, issuedAt, nonce));
    }

    /// @notice What pet `a` signs to approve `b` without a code.
    function linkDigest(address a, address b) public view returns (bytes32) {
        return keccak256(abi.encode("StandIn link", address(this), block.chainid, a, b));
    }

    /// @notice Called by pet `b`, carrying pet `a`'s signature. For Method.Code the
    ///         signature is over codeDigest and the code must be fresh and unused; for
    ///         Method.Link it is over linkDigest and `gatheringId`, `issuedAt`, `nonce`
    ///         are ignored (pass zero).
    function recordMeet(
        address a,
        Method method,
        uint64 gatheringId,
        uint64 issuedAt,
        bytes32 nonce,
        bytes32 chatHash,
        bytes calldata signature
    ) external returns (uint256 meetId) {
        address b = msg.sender;
        if (a == b) revert Yourself();
        bytes32 pair = _pair(a, b);
        if (_pairIndex[pair] != 0) revert AlreadyMet();

        if (method == Method.Code) {
            if (block.timestamp + CLOCK_SKEW < issuedAt || block.timestamp > uint256(issuedAt) + CODE_WINDOW) {
                revert CodeExpired();
            }
            if (codeUsed[a][nonce]) revert CodeUsed();
            if (_recover(codeDigest(a, gatheringId, issuedAt, nonce), signature) != a) revert BadSignature();
            codeUsed[a][nonce] = true;
        } else {
            if (gatheringId != 0) revert GatheringNeedsCode();
            if (_recover(linkDigest(a, b), signature) != a) revert BadSignature();
        }

        if (gatheringId != 0) {
            if (gatheringId > _gatherings.length) revert UnknownGathering();
            Gathering storage g = _gatherings[gatheringId - 1];
            if (block.timestamp < g.startsAt || block.timestamp > g.endsAt) revert GatheringClosed();
            g.meets += 1;
            g.attendees += _attend(gatheringId, a) + _attend(gatheringId, b);
        }

        _countNewFriend(a);
        _countNewFriend(b);

        _meets.push(Meet(a, b, uint64(block.timestamp), gatheringId, method, chatHash));
        meetId = _meets.length;
        _pairIndex[pair] = meetId;
        _friends[a].push(b);
        _friends[b].push(a);
        emit Met(meetId, a, b, method, gatheringId, chatHash);
    }

    function hasMet(address a, address b) public view returns (bool) {
        return _pairIndex[_pair(a, b)] != 0;
    }

    /// @notice True only for a meeting made with a fresh code.
    function hasMetInPerson(address a, address b) public view returns (bool) {
        uint256 i = _pairIndex[_pair(a, b)];
        return i != 0 && _meets[i - 1].method == Method.Code;
    }

    function meetBetween(address a, address b) external view returns (Meet memory) {
        uint256 i = _pairIndex[_pair(a, b)];
        if (i == 0) return Meet(address(0), address(0), 0, 0, Method.Link, bytes32(0));
        return _meets[i - 1];
    }

    function friendsOf(address pet) external view returns (address[] memory) {
        return _friends[pet];
    }

    function friendCount(address pet) external view returns (uint256) {
        return _friends[pet].length;
    }

    /// @notice How many pets both `a` and `b` have met.
    function mutualCount(address a, address b) external view returns (uint256 n) {
        address[] storage mine = _friends[a];
        for (uint256 i = 0; i < mine.length; i++) {
            if (mine[i] != b && hasMet(mine[i], b)) n++;
        }
    }

    /// @notice How many of `members` have met `candidate`. The building block for gating.
    function vouchCount(address candidate, address[] memory members, bool inPersonOnly) public view returns (uint256 n) {
        for (uint256 i = 0; i < members.length; i++) {
            if (inPersonOnly ? hasMetInPerson(members[i], candidate) : hasMet(members[i], candidate)) n++;
        }
    }

    function meetCount() external view returns (uint256) {
        return _meets.length;
    }

    /// @notice Meetings `from` (0-based) onward, at most `max`. Enough for a live wall without an indexer.
    function meetsFrom(uint256 from, uint256 max) external view returns (Meet[] memory page) {
        uint256 end = from + max > _meets.length ? _meets.length : from + max;
        if (from >= end) return new Meet[](0);
        page = new Meet[](end - from);
        for (uint256 i = from; i < end; i++) {
            page[i - from] = _meets[i];
        }
    }

    // ---------------------------------------------------------------- gatherings

    /// @notice An event with a time window. Codes shown for it stamp meetings with its id.
    function createGathering(string calldata name, uint64 startsAt, uint64 endsAt) external returns (uint256 gatheringId) {
        if (endsAt <= startsAt || endsAt <= block.timestamp) revert BadWindow();
        _gatherings.push(Gathering(msg.sender, name, startsAt, endsAt, 0, 0));
        gatheringId = _gatherings.length;
        emit GatheringCreated(gatheringId, msg.sender, name, startsAt, endsAt);
    }

    function gatheringCount() external view returns (uint256) {
        return _gatherings.length;
    }

    function getGathering(uint256 gatheringId) external view returns (Gathering memory) {
        if (gatheringId == 0 || gatheringId > _gatherings.length) revert UnknownGathering();
        return _gatherings[gatheringId - 1];
    }

    // --------------------------------------------------------------------- rooms

    /// @notice A group you may join once `threshold` of its members have met you.
    function createRoom(string calldata name, uint16 threshold, bool inPersonOnly) external returns (uint256 roomId) {
        if (threshold == 0) revert BadThreshold();
        Room storage room = _rooms.push();
        room.creator = msg.sender;
        room.name = name;
        room.threshold = threshold;
        room.inPersonOnly = inPersonOnly;
        room.members.push(msg.sender);
        roomId = _rooms.length;
        isMember[roomId][msg.sender] = true;
        emit RoomCreated(roomId, msg.sender, name, threshold, inPersonOnly);
    }

    /// @notice Whether `pet` may join, how many members vouch for it, and how many it needs.
    ///         A room smaller than its threshold asks for every member instead.
    function canJoin(uint256 roomId, address pet) public view returns (bool ok, uint256 vouches, uint256 needed) {
        Room storage room = _room(roomId);
        vouches = vouchCount(pet, room.members, room.inPersonOnly);
        needed = room.members.length < room.threshold ? room.members.length : room.threshold;
        ok = !isMember[roomId][pet] && vouches >= needed;
    }

    function join(uint256 roomId) external {
        if (isMember[roomId][msg.sender]) revert AlreadyMember();
        (, uint256 vouches, uint256 needed) = canJoin(roomId, msg.sender);
        if (vouches < needed) revert NotEnoughVouches(vouches, needed);
        _rooms[roomId - 1].members.push(msg.sender);
        isMember[roomId][msg.sender] = true;
        emit Joined(roomId, msg.sender, vouches);
    }

    function roomCount() external view returns (uint256) {
        return _rooms.length;
    }

    function getRoom(uint256 roomId)
        external
        view
        returns (address creator, string memory name, uint16 threshold, bool inPersonOnly, address[] memory members)
    {
        Room storage room = _room(roomId);
        return (room.creator, room.name, room.threshold, room.inPersonOnly, room.members);
    }

    // ----------------------------------------------------------------- internals

    function _pair(address a, address b) private pure returns (bytes32) {
        return a < b ? keccak256(abi.encode(a, b)) : keccak256(abi.encode(b, a));
    }

    function _room(uint256 roomId) private view returns (Room storage) {
        if (roomId == 0 || roomId > _rooms.length) revert UnknownRoom();
        return _rooms[roomId - 1];
    }

    function _attend(uint256 gatheringId, address pet) private returns (uint32) {
        if (attended[gatheringId][pet]) return 0;
        attended[gatheringId][pet] = true;
        return 1;
    }

    function _countNewFriend(address pet) private {
        if (block.timestamp >= _hourStart[pet] + 1 hours) {
            _hourStart[pet] = block.timestamp;
            _hourCount[pet] = 0;
        }
        if (_hourCount[pet] >= MAX_NEW_PER_HOUR) revert TooManyNewFriends();
        _hourCount[pet] += 1;
    }

    /// @dev Signatures are over the EIP-191 personal-message form of a 32-byte digest.
    function _recover(bytes32 digest, bytes calldata signature) private pure returns (address) {
        if (signature.length != 65) return address(0);
        bytes32 r = bytes32(signature[0:32]);
        bytes32 s = bytes32(signature[32:64]);
        uint8 v = uint8(signature[64]);
        if (v < 27) v += 27;
        return ecrecover(keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest)), v, r, s);
    }
}
