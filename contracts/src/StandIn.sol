// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title Stand-In
/// @notice Every twin is an AI judge with its own wallet. Friends try to pass as the
///         twin's owner, the twin posts a score for each attempt, and the first
///         challenger to beat the owner's own score is paid the pot by the twin itself.
///         Nothing here is callable by the app operator: only the twin's wallet can
///         post verdicts, and only the owner (or the twin, on the owner's behalf) can
///         take the pot back.
contract StandIn {
    struct Twin {
        address owner; // the human the twin imitates; receives reclaimed pots
        address signer; // the twin's wallet; the only address that may post verdicts
        bytes32 personaHash; // keccak256 of the off-chain persona bundle
        bool ownerProven; // the owner has played as themselves at least once
        uint16 ownerScore; // the owner's own score, in basis points
        uint16 bestScore; // best challenger score so far
        address bestChallenger;
        uint32 attempts;
        uint128 pot;
    }

    uint16 public constant MAX_SCORE = 10_000;

    uint256 public nextTwinId = 1;
    mapping(uint256 twinId => Twin) private _twins;

    event TwinCreated(uint256 indexed twinId, address indexed owner, address indexed signer, bytes32 personaHash);
    event PersonaUpdated(uint256 indexed twinId, bytes32 personaHash);
    event OwnerProven(uint256 indexed twinId, uint16 score, bytes32 verdictHash);
    event Attempt(uint256 indexed twinId, address indexed challenger, uint16 score, bool passed, bytes32 verdictHash);
    event Funded(uint256 indexed twinId, address indexed from, uint256 amount);
    event Paid(uint256 indexed twinId, address indexed to, uint256 amount);
    event Reclaimed(uint256 indexed twinId, address indexed to, uint256 amount);

    error UnknownTwin();
    error NotSigner();
    error NotOwnerOrSigner();
    error ZeroAddress();
    error ScoreTooHigh();
    error OwnerNotProven();
    error SelfChallenge();
    error PotTooLarge();
    error TransferFailed();

    modifier exists(uint256 twinId) {
        if (_twins[twinId].signer == address(0)) revert UnknownTwin();
        _;
    }

    modifier onlySigner(uint256 twinId) {
        if (_twins[twinId].signer == address(0)) revert UnknownTwin();
        if (msg.sender != _twins[twinId].signer) revert NotSigner();
        _;
    }

    /// @notice The twin registers itself and names the human it imitates.
    function createTwin(address owner, bytes32 personaHash) external returns (uint256 twinId) {
        if (owner == address(0)) revert ZeroAddress();
        twinId = nextTwinId++;
        Twin storage t = _twins[twinId];
        t.owner = owner;
        t.signer = msg.sender;
        t.personaHash = personaHash;
        emit TwinCreated(twinId, owner, msg.sender, personaHash);
    }

    function getTwin(uint256 twinId) external view exists(twinId) returns (Twin memory) {
        return _twins[twinId];
    }

    function updatePersona(uint256 twinId, bytes32 personaHash) external onlySigner(twinId) {
        _twins[twinId].personaHash = personaHash;
        emit PersonaUpdated(twinId, personaHash);
    }

    /// @notice The owner has answered as themselves; this is the bar challengers must beat.
    function proveOwner(uint256 twinId, uint16 score, bytes32 verdictHash) external onlySigner(twinId) {
        if (score > MAX_SCORE) revert ScoreTooHigh();
        Twin storage t = _twins[twinId];
        t.ownerProven = true;
        t.ownerScore = score;
        emit OwnerProven(twinId, score, verdictHash);
    }

    /// @notice Anyone may sweeten a twin's pot.
    function fund(uint256 twinId) external payable exists(twinId) {
        Twin storage t = _twins[twinId];
        if (msg.value > type(uint128).max - t.pot) revert PotTooLarge();
        // Safe: the guard above ensures pot + msg.value fits in uint128.
        // forge-lint: disable-next-line(unsafe-typecast)
        t.pot += uint128(msg.value);
        emit Funded(twinId, msg.sender, msg.value);
    }

    /// @notice The twin records a challenger's attempt. Beating the owner's score empties
    ///         the pot into the challenger's wallet in the same transaction.
    function submitVerdict(uint256 twinId, address challenger, uint16 score, bytes32 verdictHash)
        external
        onlySigner(twinId)
    {
        if (challenger == address(0)) revert ZeroAddress();
        if (score > MAX_SCORE) revert ScoreTooHigh();
        Twin storage t = _twins[twinId];
        if (!t.ownerProven) revert OwnerNotProven();
        if (challenger == t.owner) revert SelfChallenge();

        t.attempts += 1;
        if (score > t.bestScore) {
            t.bestScore = score;
            t.bestChallenger = challenger;
        }

        bool passed = score > t.ownerScore;
        emit Attempt(twinId, challenger, score, passed, verdictHash);

        uint256 prize = t.pot;
        if (passed && prize > 0) {
            t.pot = 0;
            emit Paid(twinId, challenger, prize);
            _send(challenger, prize);
        }
    }

    /// @notice Returns the pot to the owner. The twin may do this on the owner's behalf
    ///         so an owner with no gas is never locked out of their own money.
    function reclaim(uint256 twinId) external exists(twinId) {
        Twin storage t = _twins[twinId];
        if (msg.sender != t.owner && msg.sender != t.signer) revert NotOwnerOrSigner();
        uint256 amount = t.pot;
        t.pot = 0;
        emit Reclaimed(twinId, t.owner, amount);
        if (amount > 0) _send(t.owner, amount);
    }

    function _send(address to, uint256 amount) private {
        // Destinations are the owner or a challenger named by the twin's own wallet;
        // both callers are restricted above, so this is not an open ETH sink.
        // forge-lint: disable-next-line(arbitrary-send-eth)
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
