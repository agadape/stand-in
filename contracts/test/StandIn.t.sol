// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {StandIn} from "../src/StandIn.sol";

contract StandInTest is Test {
    StandIn internal standIn;

    address internal owner = makeAddr("owner");
    address internal twin = makeAddr("twin");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal stranger = makeAddr("stranger");

    bytes32 internal constant PERSONA = keccak256("persona-v1");
    bytes32 internal constant VERDICT = keccak256("verdict");

    uint256 internal twinId;

    function setUp() public {
        standIn = new StandIn();
        vm.prank(twin);
        twinId = standIn.createTwin(owner, PERSONA);
        vm.deal(alice, 10 ether);
        vm.deal(stranger, 10 ether);
    }

    function _prove(uint16 score) internal {
        vm.prank(twin);
        standIn.proveOwner(twinId, score, VERDICT);
    }

    function _fund(address from, uint256 amount) internal {
        vm.prank(from);
        standIn.fund{value: amount}(twinId);
    }

    function test_createTwinRecordsOwnerAndSigner() public view {
        StandIn.Twin memory t = standIn.getTwin(twinId);
        assertEq(t.owner, owner);
        assertEq(t.signer, twin);
        assertEq(t.personaHash, PERSONA);
        assertFalse(t.ownerProven);
        assertEq(standIn.nextTwinId(), 2);
    }

    function test_createTwinRejectsZeroOwner() public {
        vm.prank(twin);
        vm.expectRevert(StandIn.ZeroAddress.selector);
        standIn.createTwin(address(0), PERSONA);
    }

    function test_getTwinRevertsForUnknownId() public {
        vm.expectRevert(StandIn.UnknownTwin.selector);
        standIn.getTwin(99);
    }

    function test_onlySignerMayProveOwner() public {
        vm.prank(owner);
        vm.expectRevert(StandIn.NotSigner.selector);
        standIn.proveOwner(twinId, 7000, VERDICT);

        _prove(7000);
        StandIn.Twin memory t = standIn.getTwin(twinId);
        assertTrue(t.ownerProven);
        assertEq(t.ownerScore, 7000);
    }

    function test_proveOwnerRejectsScoreAboveMax() public {
        vm.prank(twin);
        vm.expectRevert(StandIn.ScoreTooHigh.selector);
        standIn.proveOwner(twinId, 10_001, VERDICT);
    }

    function test_fundAccumulatesPot() public {
        _fund(alice, 1 ether);
        _fund(stranger, 0.5 ether);
        assertEq(standIn.getTwin(twinId).pot, 1.5 ether);
        assertEq(address(standIn).balance, 1.5 ether);
    }

    function test_verdictBeforeOwnerProvenReverts() public {
        vm.prank(twin);
        vm.expectRevert(StandIn.OwnerNotProven.selector);
        standIn.submitVerdict(twinId, alice, 5000, VERDICT);
    }

    function test_onlySignerMaySubmitVerdict() public {
        _prove(7000);
        vm.prank(alice);
        vm.expectRevert(StandIn.NotSigner.selector);
        standIn.submitVerdict(twinId, alice, 9000, VERDICT);
    }

    function test_ownerCannotChallengeOwnTwin() public {
        _prove(7000);
        vm.prank(twin);
        vm.expectRevert(StandIn.SelfChallenge.selector);
        standIn.submitVerdict(twinId, owner, 9000, VERDICT);
    }

    function test_failingVerdictKeepsPotAndRecordsBest() public {
        _prove(7000);
        _fund(alice, 1 ether);

        vm.prank(twin);
        vm.expectEmit(true, true, false, true);
        emit StandIn.Attempt(twinId, bob, 6000, false, VERDICT);
        standIn.submitVerdict(twinId, bob, 6000, VERDICT);

        StandIn.Twin memory t = standIn.getTwin(twinId);
        assertEq(t.pot, 1 ether);
        assertEq(t.attempts, 1);
        assertEq(t.bestScore, 6000);
        assertEq(t.bestChallenger, bob);
        assertEq(bob.balance, 0);
    }

    function test_passingVerdictPaysPotToChallenger() public {
        _prove(7000);
        _fund(alice, 1 ether);

        vm.prank(twin);
        vm.expectEmit(true, true, false, true);
        emit StandIn.Paid(twinId, bob, 1 ether);
        standIn.submitVerdict(twinId, bob, 7001, VERDICT);

        StandIn.Twin memory t = standIn.getTwin(twinId);
        assertEq(t.pot, 0);
        assertEq(bob.balance, 1 ether);
        assertEq(t.bestChallenger, bob);
    }

    function test_equalScoreDoesNotPass() public {
        _prove(7000);
        _fund(alice, 1 ether);
        vm.prank(twin);
        standIn.submitVerdict(twinId, bob, 7000, VERDICT);
        assertEq(standIn.getTwin(twinId).pot, 1 ether);
        assertEq(bob.balance, 0);
    }

    function test_passingVerdictWithEmptyPotStillRecords() public {
        _prove(7000);
        vm.prank(twin);
        standIn.submitVerdict(twinId, bob, 9000, VERDICT);
        StandIn.Twin memory t = standIn.getTwin(twinId);
        assertEq(t.attempts, 1);
        assertEq(t.bestScore, 9000);
    }

    function test_reclaimByOwner() public {
        _fund(alice, 1 ether);
        vm.prank(owner);
        standIn.reclaim(twinId);
        assertEq(owner.balance, 1 ether);
        assertEq(standIn.getTwin(twinId).pot, 0);
    }

    function test_reclaimBySignerPaysOwner() public {
        _fund(alice, 1 ether);
        vm.prank(twin);
        standIn.reclaim(twinId);
        assertEq(owner.balance, 1 ether);
        assertEq(twin.balance, 0);
    }

    function test_reclaimByStrangerReverts() public {
        _fund(alice, 1 ether);
        vm.prank(stranger);
        vm.expectRevert(StandIn.NotOwnerOrSigner.selector);
        standIn.reclaim(twinId);
    }

    function test_updatePersonaOnlySigner() public {
        bytes32 next = keccak256("persona-v2");
        vm.prank(owner);
        vm.expectRevert(StandIn.NotSigner.selector);
        standIn.updatePersona(twinId, next);

        vm.prank(twin);
        standIn.updatePersona(twinId, next);
        assertEq(standIn.getTwin(twinId).personaHash, next);
    }

    function testFuzz_payoutOnlyWhenStrictlyAboveOwner(uint16 ownerScore, uint16 score, uint96 pot) public {
        ownerScore = uint16(bound(ownerScore, 0, 10_000));
        score = uint16(bound(score, 0, 10_000));
        vm.assume(pot > 0);
        vm.deal(alice, pot);

        _prove(ownerScore);
        _fund(alice, pot);

        vm.prank(twin);
        standIn.submitVerdict(twinId, bob, score, VERDICT);

        if (score > ownerScore) {
            assertEq(bob.balance, pot);
            assertEq(standIn.getTwin(twinId).pot, 0);
        } else {
            assertEq(bob.balance, 0);
            assertEq(standIn.getTwin(twinId).pot, pot);
        }
    }
}
