// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ProofOfMet} from "../src/ProofOfMet.sol";

contract ProofOfMetTest is Test {
    ProofOfMet met;

    uint256 constant A_KEY = 0xA11CE;
    uint256 constant B_KEY = 0xB0B;
    uint256 constant C_KEY = 0xCA7;
    uint256 constant D_KEY = 0xD06;
    address a = vm.addr(A_KEY);
    address b = vm.addr(B_KEY);
    address c = vm.addr(C_KEY);
    address d = vm.addr(D_KEY);

    bytes32 constant CHAT = keccak256("chat");

    function setUp() public {
        vm.warp(1_760_000_000);
        met = new ProofOfMet();
    }

    function _sign(uint256 key, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(key, keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest)));
        return abi.encodePacked(r, s, v);
    }

    function _code(uint256 key, uint64 gatheringId, uint64 issuedAt, bytes32 nonce) internal view returns (bytes memory) {
        return _sign(key, met.codeDigest(vm.addr(key), gatheringId, issuedAt, nonce));
    }

    /// `scanner` records a meeting with the pet whose key is `shownKey`, using a fresh code.
    function _meetInPerson(uint256 shownKey, address scanner, bytes32 nonce) internal {
        uint64 issuedAt = uint64(block.timestamp);
        bytes memory sig = _code(shownKey, 0, issuedAt, nonce);
        vm.prank(scanner);
        met.recordMeet(vm.addr(shownKey), ProofOfMet.Method.Code, 0, issuedAt, nonce, CHAT, sig);
    }

    function _meetByLink(uint256 approverKey, address other) internal {
        bytes memory sig = _sign(approverKey, met.linkDigest(vm.addr(approverKey), other));
        vm.prank(other);
        met.recordMeet(vm.addr(approverKey), ProofOfMet.Method.Link, 0, 0, bytes32(0), CHAT, sig);
    }

    function test_codeMeetIsInPerson() public {
        // The chat's hash is committed in the event.
        vm.expectEmit(true, true, true, true);
        emit ProofOfMet.Met(1, a, b, ProofOfMet.Method.Code, 0, CHAT);
        _meetInPerson(A_KEY, b, "n1");
        assertTrue(met.hasMet(a, b));
        assertTrue(met.hasMet(b, a));
        assertTrue(met.hasMetInPerson(b, a));
        assertEq(met.friendCount(a), 1);
        assertEq(met.friendsOf(b)[0], a);
        assertEq(met.meetCount(), 1);
        ProofOfMet.Meet memory m = met.meetBetween(b, a);
        assertEq(m.a, a);
        assertEq(m.b, b);
        assertEq(m.at, block.timestamp);
    }

    function test_linkMeetIsNotInPerson() public {
        _meetByLink(A_KEY, b);
        assertTrue(met.hasMet(a, b));
        assertFalse(met.hasMetInPerson(a, b));
    }

    function test_samePairOnlyOnce() public {
        _meetInPerson(A_KEY, b, "n1");
        uint64 issuedAt = uint64(block.timestamp);
        bytes memory sig = _code(B_KEY, 0, issuedAt, "n2");
        vm.prank(a);
        vm.expectRevert(ProofOfMet.AlreadyMet.selector);
        met.recordMeet(b, ProofOfMet.Method.Code, 0, issuedAt, "n2", CHAT, sig);
    }

    function test_codeCannotBeReused() public {
        uint64 issuedAt = uint64(block.timestamp);
        bytes memory sig = _code(A_KEY, 0, issuedAt, "n1");
        vm.prank(b);
        met.recordMeet(a, ProofOfMet.Method.Code, 0, issuedAt, "n1", CHAT, sig);
        // A screenshot of the same code, tried by someone else.
        vm.prank(c);
        vm.expectRevert(ProofOfMet.CodeUsed.selector);
        met.recordMeet(a, ProofOfMet.Method.Code, 0, issuedAt, "n1", CHAT, sig);
    }

    function test_staleCodeRejected() public {
        uint64 issuedAt = uint64(block.timestamp);
        bytes memory sig = _code(A_KEY, 0, issuedAt, "n1");
        vm.warp(block.timestamp + met.CODE_WINDOW() + 1);
        vm.prank(b);
        vm.expectRevert(ProofOfMet.CodeExpired.selector);
        met.recordMeet(a, ProofOfMet.Method.Code, 0, issuedAt, "n1", CHAT, sig);
    }

    function test_codeFromTheFutureRejected() public {
        uint64 issuedAt = uint64(block.timestamp + met.CLOCK_SKEW() + 1);
        bytes memory sig = _code(A_KEY, 0, issuedAt, "n1");
        vm.prank(b);
        vm.expectRevert(ProofOfMet.CodeExpired.selector);
        met.recordMeet(a, ProofOfMet.Method.Code, 0, issuedAt, "n1", CHAT, sig);
    }

    function test_someoneElsesSignatureRejected() public {
        uint64 issuedAt = uint64(block.timestamp);
        // C signs a code and B claims it is A's.
        bytes memory sig = _sign(C_KEY, met.codeDigest(a, 0, issuedAt, "n1"));
        vm.prank(b);
        vm.expectRevert(ProofOfMet.BadSignature.selector);
        met.recordMeet(a, ProofOfMet.Method.Code, 0, issuedAt, "n1", CHAT, sig);
    }

    function test_linkApprovalIsForOneFriendOnly() public {
        bytes memory sig = _sign(A_KEY, met.linkDigest(a, b));
        vm.prank(c);
        vm.expectRevert(ProofOfMet.BadSignature.selector);
        met.recordMeet(a, ProofOfMet.Method.Link, 0, 0, bytes32(0), CHAT, sig);
    }

    function test_cannotMeetYourself() public {
        uint64 issuedAt = uint64(block.timestamp);
        bytes memory sig = _code(A_KEY, 0, issuedAt, "n1");
        vm.prank(a);
        vm.expectRevert(ProofOfMet.Yourself.selector);
        met.recordMeet(a, ProofOfMet.Method.Code, 0, issuedAt, "n1", CHAT, sig);
    }

    function test_hourlyLimit() public {
        uint256 max = met.MAX_NEW_PER_HOUR();
        for (uint256 i = 0; i < max; i++) {
            _meetInPerson(A_KEY, address(uint160(0x1000 + i)), bytes32(i));
        }
        uint64 issuedAt = uint64(block.timestamp);
        bytes memory sig = _code(A_KEY, 0, issuedAt, "last");
        vm.prank(b);
        vm.expectRevert(ProofOfMet.TooManyNewFriends.selector);
        met.recordMeet(a, ProofOfMet.Method.Code, 0, issuedAt, "last", CHAT, sig);

        vm.warp(block.timestamp + 1 hours);
        _meetInPerson(A_KEY, b, "next-hour");
        assertEq(met.friendCount(a), max + 1);
    }

    function test_mutualAndVouchCounts() public {
        _meetInPerson(A_KEY, b, "1");
        _meetInPerson(A_KEY, c, "2");
        _meetByLink(B_KEY, c);
        _meetInPerson(D_KEY, c, "3");
        // b and c share one friend (a); a and d share one (c).
        assertEq(met.mutualCount(b, c), 1);
        assertEq(met.mutualCount(a, d), 1);

        address[] memory members = new address[](3);
        members[0] = a;
        members[1] = b;
        members[2] = d;
        assertEq(met.vouchCount(c, members, false), 3);
        assertEq(met.vouchCount(c, members, true), 2); // b met c by link only
    }

    function test_gatheringStampsMeetsAndAttendance() public {
        uint64 start = uint64(block.timestamp);
        vm.prank(a);
        uint256 id = met.createGathering("Campus night", start, start + 3 hours);

        uint64 issuedAt = uint64(block.timestamp);
        bytes memory sig = _code(A_KEY, uint64(id), issuedAt, "g1");
        vm.prank(b);
        met.recordMeet(a, ProofOfMet.Method.Code, uint64(id), issuedAt, "g1", CHAT, sig);
        sig = _code(A_KEY, uint64(id), issuedAt, "g2");
        vm.prank(c);
        met.recordMeet(a, ProofOfMet.Method.Code, uint64(id), issuedAt, "g2", CHAT, sig);

        ProofOfMet.Gathering memory g = met.getGathering(id);
        assertEq(g.meets, 2);
        assertEq(g.attendees, 3);
        assertTrue(met.attended(id, c));
        assertFalse(met.attended(id, d));
        assertEq(met.meetsFrom(0, 10).length, 2);
        assertEq(met.meetsFrom(1, 10)[0].b, c);
    }

    function test_gatheringClosedAndCodeBoundToIt() public {
        uint64 start = uint64(block.timestamp);
        uint256 id = met.createGathering("Campus night", start, start + 1 hours);

        // A code signed for no gathering cannot be recorded into one.
        uint64 issuedAt = uint64(block.timestamp);
        bytes memory plain = _code(A_KEY, 0, issuedAt, "n1");
        vm.prank(b);
        vm.expectRevert(ProofOfMet.BadSignature.selector);
        met.recordMeet(a, ProofOfMet.Method.Code, uint64(id), issuedAt, "n1", CHAT, plain);

        vm.warp(start + 1 hours + 1);
        issuedAt = uint64(block.timestamp);
        bytes memory late = _code(A_KEY, uint64(id), issuedAt, "n2");
        vm.prank(b);
        vm.expectRevert(ProofOfMet.GatheringClosed.selector);
        met.recordMeet(a, ProofOfMet.Method.Code, uint64(id), issuedAt, "n2", CHAT, late);
    }

    function test_linkCannotCountForAGathering() public {
        uint64 start = uint64(block.timestamp);
        uint256 id = met.createGathering("Campus night", start, start + 1 hours);
        bytes memory sig = _sign(A_KEY, met.linkDigest(a, b));
        vm.prank(b);
        vm.expectRevert(ProofOfMet.GatheringNeedsCode.selector);
        met.recordMeet(a, ProofOfMet.Method.Link, uint64(id), 0, bytes32(0), CHAT, sig);
    }

    function test_roomAdmitsOnlyThePeopleMembersHaveMet() public {
        vm.prank(a);
        uint256 room = met.createRoom("Inner Circle", 2, true);

        // b has met a in person: a one-member room asks for that one member.
        _meetInPerson(A_KEY, b, "1");
        (bool ok, uint256 vouches, uint256 needed) = met.canJoin(room, b);
        assertTrue(ok);
        assertEq(vouches, 1);
        assertEq(needed, 1);
        vm.prank(b);
        met.join(room);

        // c has met only a: 1 of 2.
        _meetInPerson(A_KEY, c, "2");
        (ok, vouches, needed) = met.canJoin(room, c);
        assertFalse(ok);
        assertEq(vouches, 1);
        assertEq(needed, 2);
        vm.prank(c);
        vm.expectRevert(abi.encodeWithSelector(ProofOfMet.NotEnoughVouches.selector, 1, 2));
        met.join(room);

        // A link with b does not count in an in-person room...
        _meetByLink(B_KEY, c);
        (ok,,) = met.canJoin(room, c);
        assertFalse(ok);

        // ...so d, who meets both a and b in person, gets in where c could not.
        _meetInPerson(A_KEY, d, "3");
        _meetInPerson(B_KEY, d, "4");
        vm.prank(d);
        met.join(room);
        assertTrue(met.isMember(room, d));
        (,,,, address[] memory members) = met.getRoom(room);
        assertEq(members.length, 3);

        vm.prank(d);
        vm.expectRevert(ProofOfMet.AlreadyMember.selector);
        met.join(room);
    }

    function test_roomThatCountsLinks() public {
        vm.prank(a);
        uint256 room = met.createRoom("Everyone", 1, false);
        _meetByLink(A_KEY, b);
        vm.prank(b);
        met.join(room);
        assertTrue(met.isMember(room, b));
    }

    function test_unknownRoomAndBadThreshold() public {
        vm.expectRevert(ProofOfMet.UnknownRoom.selector);
        met.canJoin(1, a);
        vm.expectRevert(ProofOfMet.BadThreshold.selector);
        met.createRoom("x", 0, false);
    }

    function testFuzz_pairIsSymmetric(address x, address y) public view {
        assertEq(met.hasMet(x, y), met.hasMet(y, x));
    }
}
