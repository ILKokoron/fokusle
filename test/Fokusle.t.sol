// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Fokusle} from "../src/Fokusle.sol";

contract FokusleTest is Test {
    Fokusle fp;
    uint256 aliceKey = 0xA11CE;
    uint256 bobKey = 0xB0B;
    address alice = vm.addr(aliceKey);
    address bob = vm.addr(bobKey);

    function setUp() public {
        fp = new Fokusle();
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    function _sig(address u, uint256 key, uint256 dur) internal view returns (bytes memory) {
        bytes32 h = keccak256(abi.encodePacked(u, dur));
        // Simulate personal_sign: real wallets always prepend the EIP-191
        // prefix before signing, so the test must too, matching _recover().
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", h));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, ethSignedHash);
        return abi.encodePacked(r, s, v);
    }

    // helper: commit then warp forward by the session duration then log
    function _commitAndLog(address user, uint256 key, uint256 dur) internal {
        bytes memory sig = _sig(user, key, dur);
        vm.prank(user); fp.commit(dur, sig);
        vm.warp(block.timestamp + dur);
        vm.prank(user); fp.logFocus(dur);
    }

    function test_commit_then_log() public {
        _commitAndLog(alice, aliceKey, 1500);
        (uint256 total, , uint256 streak, , , uint256 sess) = fp.getProgress(alice);
        assertEq(total, 1500);
        assertEq(streak, 1);
        assertEq(sess, 1);
    }

    function test_commit_wrong_sig_reverts() public {
        // sign WRONG duration -> hash mismatch -> recover != caller -> revert
        bytes32 wrong = keccak256(abi.encodePacked(alice, uint256(1500 + 999)));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(aliceKey, wrong);
        bytes memory sig = abi.encodePacked(r, s, v);
        vm.prank(alice);
        vm.expectRevert("Fokusle: bad signature");
        fp.commit(1500, sig);
    }

    function test_log_without_commit_reverts() public {
        vm.prank(alice);
        vm.expectRevert();
        fp.logFocus(1500);
    }

    function test_log_before_time_elapsed_reverts() public {
        // commit to 1500s, but try to log immediately (no time passed) -> must revert
        bytes memory sig = _sig(alice, aliceKey, 1500);
        vm.prank(alice); fp.commit(1500, sig);
        vm.prank(alice);
        vm.expectRevert("Fokusle: not enough time elapsed");
        fp.logFocus(1500);
    }

    function test_log_more_than_committed_duration_reverts() public {
        // commit to 600s, wait 600s, but try to claim 1500s -> must revert
        bytes memory sig = _sig(alice, aliceKey, 600);
        vm.prank(alice); fp.commit(600, sig);
        vm.warp(block.timestamp + 600);
        vm.prank(alice);
        vm.expectRevert("Fokusle: exceeds committed duration");
        fp.logFocus(1500);
    }

    function test_streak_breaks_after_2_days() public {
        _commitAndLog(alice, aliceKey, 1500);

        vm.warp(block.timestamp + 1 days + 1);
        _commitAndLog(alice, aliceKey, 1500);
        (, , uint256 s2, , , ) = fp.getProgress(alice);
        assertEq(s2, 2);

        vm.warp(block.timestamp + 2 days + 1);
        _commitAndLog(alice, aliceKey, 1500);
        (, , uint256 s3, , , ) = fp.getProgress(alice);
        assertEq(s3, 1);
    }

    function test_first_hour_badge() public {
        _commitAndLog(alice, aliceKey, 3600);
        uint256[] memory b = fp.getBadges(alice);
        assertEq(b.length, 1);
        assertEq(b[0], 1);
    }

    function test_weekly_reset() public {
        _commitAndLog(alice, aliceKey, 1000);
        vm.warp(block.timestamp + 7 days + 1);
        _commitAndLog(alice, aliceKey, 500);
        (uint256 total, uint256 wk, , , , ) = fp.getProgress(alice);
        assertEq(total, 1500);
        assertEq(wk, 500);
    }

    function test_leaderboard_and_parallel_streaks() public {
        _commitAndLog(alice, aliceKey, 1500);
        _commitAndLog(bob, bobKey, 1500);

        address[] memory lb = fp.getLeaderboard();
        assertEq(lb.length, 2);

        address[] memory q = new address[](2);
        q[0] = alice; q[1] = bob;
        uint256[] memory streaks = fp.getStreaks(q);
        assertEq(streaks[0], 1);
        assertEq(streaks[1], 1);
    }

    function test_recommit_after_missed_window() public {
        // commit but never log; window expires; must be able to commit again
        bytes memory sig = _sig(alice, aliceKey, 600);
        vm.prank(alice); fp.commit(600, sig);

        vm.warp(block.timestamp + 600 + 300 + 1); // past duration + grace
        bytes memory sig2 = _sig(alice, aliceKey, 600);
        vm.prank(alice); fp.commit(600, sig2); // must NOT revert
    }

    function test_double_commit_without_expiry_reverts() public {
        bytes memory sig = _sig(alice, aliceKey, 600);
        vm.prank(alice); fp.commit(600, sig);
        bytes memory sig2 = _sig(alice, aliceKey, 600);
        vm.prank(alice);
        vm.expectRevert("Fokusle: already committed");
        fp.commit(600, sig2);
    }

    function test_badge_soulbound() public {
        _commitAndLog(alice, aliceKey, 3600);
        assertEq(fp.balanceOf(alice), 1);
    }

    function test_gacha_pull_requires_enough_xp() public {
        // alice has 0 XP fresh — must revert
        vm.prank(alice);
        vm.expectRevert(Fokusle.NotEnoughXP.selector);
        fp.pullGacha();
    }

    function test_gacha_pull_spends_xp_and_records_result() public {
        _commitAndLog(alice, aliceKey, 3600); // 1 hour session, accrues XP
        (, , , uint256 xpBefore, , ) = fp.getProgress(alice);

        if (xpBefore < fp.GACHA_COST_XP()) {
            vm.warp(block.timestamp + 1 days + 1);
            _commitAndLog(alice, aliceKey, 3600);
        }

        (, , , uint256 xpNow, , ) = fp.getProgress(alice);
        require(xpNow >= fp.GACHA_COST_XP(), "test setup: not enough XP accrued");

        vm.prank(alice);
        uint256 result = fp.pullGacha();
        assertTrue(result >= 1 && result <= 7);

        (, , , uint256 xpAfter, , ) = fp.getProgress(alice);
        assertEq(xpAfter, xpNow - fp.GACHA_COST_XP());

        uint256[] memory pulls = fp.getGachaPulls(alice);
        assertEq(pulls.length, 1);
        assertEq(pulls[0], result);
    }
}
