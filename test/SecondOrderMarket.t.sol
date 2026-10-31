// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {LibString} from "solady/utils/LibString.sol";
import {SecondOrderMarket} from "../contracts/SecondOrderMarket.sol";
import {TestCollateral} from "../contracts/TestCollateral.sol";
import {AirnodeV2Attestation} from "../contracts/vendor/AirnodeV2Attestation.sol";

/// Local deterministic contract tests use a test signing key. They are not live API3 integration evidence.
contract SecondOrderMarketTest is Test {
    uint256 constant T0 = 1793414400;
    uint256 constant SIGNER_KEY = 0xA113;
    uint256 constant WRONG_KEY = 0xBAD;
    address buyer = makeAddr("buyer");
    address counterparty = makeAddr("counterparty");
    address beneficiary = makeAddr("beneficiary");
    TestCollateral token;
    SecondOrderMarket market;

    function setUp() public {
        vm.warp(T0);
        token = new TestCollateral();
        market = _deploy(false);
        market.initialize(_opens());
    }

    function _deploy(bool operatorIsOr) internal returns (SecondOrderMarket deployed) {
        SecondOrderMarket.Source[2] memory src;
        for (uint256 i; i < 2; i++) {
            src[i] = SecondOrderMarket.Source({marketId: i == 0 ? "100" : "200", conditionId: bytes32(i + 1),
                outcomesHash: keccak256(abi.encode("Up", "Down")), createRequestHash: bytes32(i + 10),
                settlementRequestHash: bytes32(i + 20), signer: vm.addr(SIGNER_KEY), selectedOutcome: 0,
                endTime: uint64(T0 + 600)});
        }
        deployed = new SecondOrderMarket(address(token), SecondOrderMarket.Policy({sources: src, operatorIsOr: operatorIsOr,
            tradeClosesAt: uint64(T0 + 300), deadline: uint64(T0 + 3600), maxEnvelopeAge: 300, maxSourceAge: 900}));
    }

    function _openData(uint8 i, bool closed, string memory updated, string memory labels) internal view returns (bytes memory) {
        return bytes(string.concat('{"closed":', closed ? "true" : "false", ',"conditionId":"', vm.toString(bytes32(uint256(i)+1)),
            '","endDate":"2026-10-31T02:50:00Z","marketId":"', i == 0 ? "100" : "200",
            '","outcomes":"', LibString.escapeJSON(labels), '","updatedAt":"', updated, '"}'));
    }

    function _finalData(uint8 i, string memory status, string memory prices, string memory updated) internal view returns (bytes memory) {
        return bytes(string.concat('{"closed":true,"conditionId":"', vm.toString(bytes32(uint256(i)+1)),
            '","marketId":"', i == 0 ? "100" : "200", '","outcomes":"', LibString.escapeJSON('["Up","Down"]'),
            '","outcomePrices":"', LibString.escapeJSON(prices), '","status":"', status,
            '","updatedAt":"', updated, '"}'));
    }

    function _proof(uint256 key, bytes32 requestHash, uint256 timestamp, bytes memory data)
        internal pure returns (SecondOrderMarket.Proof memory)
    {
        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(keccak256(abi.encodePacked(requestHash, timestamp, data)));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return SecondOrderMarket.Proof(timestamp, data, abi.encodePacked(r,s,v));
    }

    function _opens() internal view returns (SecondOrderMarket.Proof[2] memory proofs) {
        for (uint8 i; i < 2; i++) proofs[i] = _proof(SIGNER_KEY, bytes32(uint256(i)+10), block.timestamp,
            _openData(i, false, "2026-10-31T02:40:00Z", '["Up","Down"]'));
    }

    function _fund(address payer, address payee, bool side, uint256 amount) internal {
        token.mint(payer, amount);
        vm.startPrank(payer);
        token.approve(address(market), amount);
        market.authorize(payee, side, amount, amount, 1, uint64(T0 + 300));
        market.fund(keccak256(abi.encode(payer)), amount, _opens());
        vm.stopPrank();
    }

    function _matched() internal {
        _fund(buyer, beneficiary, true, 10e6);
        _fund(counterparty, counterparty, false, 15e6);
    }

    function _final(uint8 component, string memory prices) internal view returns (SecondOrderMarket.Proof memory) {
        return _proof(SIGNER_KEY, bytes32(uint256(component)+20), block.timestamp,
            _finalData(component, "resolved", prices, "2026-10-31T02:42:00Z"));
    }

    function _settle(bool source0, bool source1) internal {
        vm.warp(T0+120);
        market.submitEvidence(0, _final(0, source0 ? '["1","0"]' : '["0","1"]'));
        market.submitEvidence(1, _final(1, source1 ? '["1","0"]' : '["0","1"]'));
    }

    function testAndSettlementAndPermissionlessFixedBeneficiaryClaim() public {
        _matched();
        _settle(true,true);
        SecondOrderMarket.State memory s = market.marketState();
        assertEq(uint256(s.phase),2); assertTrue(s.result); assertEq(s.reserve,25e6);
        vm.prank(makeAddr("keeper")); market.claim(buyer);
        assertEq(token.balanceOf(beneficiary),25e6); assertEq(token.balanceOf(buyer),0);
        assertEq(market.marketState().reserve,0);
        market.claim(counterparty);
        assertEq(token.balanceOf(counterparty),0);
        vm.expectRevert(SecondOrderMarket.AlreadyClaimed.selector); market.claim(buyer);
    }

    function testAndOneFalsePaysNoSide() public {
        _matched(); _settle(true,false);
        assertFalse(market.marketState().result);
        market.claim(counterparty);
        assertEq(token.balanceOf(counterparty),25e6);
    }

    function testOrOneTruePaysYesSide() public {
        market = _deploy(true); market.initialize(_opens());
        _matched(); _settle(false,true);
        assertTrue(market.marketState().result);
        market.claim(buyer); assertEq(token.balanceOf(beneficiary),25e6);
    }

    function testDuplicateIntentCannotChangeReserves() public {
        _fund(buyer,buyer,true,10e6);
        vm.prank(buyer); vm.expectRevert(SecondOrderMarket.DuplicateIntent.selector);
        market.fund(keccak256(abi.encode(buyer)),10e6,_opens());
        assertEq(market.marketState().reserve,10e6);
        assertEq(token.balanceOf(address(market)),10e6);
    }

    function testBudgetAndMaxActionsEnforcedOnChain() public {
        token.mint(buyer,100e6); vm.startPrank(buyer); token.approve(address(market),100e6);
        market.authorize(buyer,true,5e6,8e6,2,uint64(T0+300));
        vm.expectRevert(SecondOrderMarket.BudgetExceeded.selector); market.fund(bytes32(uint256(1)),6e6,_opens());
        market.fund(bytes32(uint256(1)),5e6,_opens());
        vm.expectRevert(SecondOrderMarket.BudgetExceeded.selector); market.fund(bytes32(uint256(2)),4e6,_opens());
        market.fund(bytes32(uint256(2)),3e6,_opens());
        vm.expectRevert(SecondOrderMarket.BudgetExceeded.selector); market.fund(bytes32(uint256(3)),1,_opens());
        vm.stopPrank(); assertEq(market.marketState().reserve,8e6);
    }

    function testMandateCannotChangeBeneficiary() public {
        _fund(buyer,beneficiary,true,10e6);
        vm.prank(buyer); vm.expectRevert(SecondOrderMarket.MandateAlreadyExists.selector);
        market.authorize(counterparty,false,10e6,10e6,1,uint64(T0+300));
    }

    function testExpiredMandateStopsFunding() public {
        token.mint(buyer,10e6); vm.startPrank(buyer); token.approve(address(market),10e6);
        market.authorize(buyer,true,10e6,10e6,1,uint64(T0+60)); vm.warp(T0+60);
        vm.expectRevert(SecondOrderMarket.MandateExpired.selector); market.fund(bytes32(uint256(1)),10e6,_opens());
        vm.stopPrank(); assertEq(market.marketState().reserve,0);
    }

    function testEditedSignedValueRejectedAndReserveUnchanged() public {
        _matched(); vm.warp(T0+120);
        SecondOrderMarket.Proof memory p = _final(0,'["1","0"]');
        p.data = _finalData(0,"resolved",'["0","1"]',"2026-10-31T02:42:00Z");
        vm.expectPartialRevert(AirnodeV2Attestation.NotSignedByAirnode.selector); market.submitEvidence(0,p);
        assertEq(market.marketState().reserve,25e6); assertFalse(market.marketState().sourceFinal[0]);
    }

    function testStaleRealFormatResponseRejected() public {
        _matched(); vm.warp(T0+120); SecondOrderMarket.Proof memory p = _final(0,'["1","0"]');
        vm.warp(T0+421); vm.expectRevert(abi.encodeWithSelector(SecondOrderMarket.ResponseTooOld.selector,T0+120));
        market.submitEvidence(0,p); assertEq(market.marketState().reserve,25e6);
    }

    function testDifferentRequestRejected() public {
        _matched(); vm.warp(T0+120);
        SecondOrderMarket.Proof memory p = _proof(SIGNER_KEY,bytes32(uint256(99)),block.timestamp,
            _finalData(0,"resolved",'["1","0"]',"2026-10-31T02:42:00Z"));
        vm.expectPartialRevert(AirnodeV2Attestation.NotSignedByAirnode.selector); market.submitEvidence(0,p);
        assertEq(market.marketState().reserve,25e6);
    }

    function testWrongSignerRejected() public {
        _matched(); vm.warp(T0+120);
        SecondOrderMarket.Proof memory p = _proof(WRONG_KEY,bytes32(uint256(20)),block.timestamp,
            _finalData(0,"resolved",'["1","0"]',"2026-10-31T02:42:00Z"));
        vm.expectPartialRevert(AirnodeV2Attestation.NotSignedByAirnode.selector); market.submitEvidence(0,p);
        assertEq(market.marketState().reserve,25e6);
    }

    function testCreateProofCannotServeSettlement() public {
        _matched();
        vm.expectPartialRevert(AirnodeV2Attestation.NotSignedByAirnode.selector); market.submitEvidence(0,_opens()[0]);
        assertEq(market.marketState().reserve,25e6);
    }

    function testFreshSignatureCannotRefreshStaleSource() public {
        _matched(); vm.warp(T0+1200);
        SecondOrderMarket.Proof memory p = _proof(SIGNER_KEY,bytes32(uint256(20)),block.timestamp,
            _finalData(0,"resolved",'["1","0"]',"2026-10-31T02:40:00Z"));
        vm.expectRevert(abi.encodeWithSelector(SecondOrderMarket.SourceTooOld.selector,T0)); market.submitEvidence(0,p);
        assertEq(market.marketState().reserve,25e6);
    }

    function testFutureSignatureRejected() public {
        _matched(); vm.warp(T0+120);
        SecondOrderMarket.Proof memory p = _proof(SIGNER_KEY,bytes32(uint256(20)),block.timestamp+31,
            _finalData(0,"resolved",'["1","0"]',"2026-10-31T02:42:00Z"));
        vm.expectRevert(abi.encodeWithSelector(SecondOrderMarket.FutureTimestamp.selector,T0+151)); market.submitEvidence(0,p);
    }

    function testHistoricalSourceCannotSettleNewExposure() public {
        _matched(); vm.warp(T0+120);
        SecondOrderMarket.Proof memory p = _proof(SIGNER_KEY,bytes32(uint256(20)),block.timestamp,
            _finalData(0,"resolved",'["1","0"]',"2026-10-31T02:39:59Z"));
        vm.expectRevert(abi.encodeWithSelector(SecondOrderMarket.SourceBeforeMarket.selector,T0-1)); market.submitEvidence(0,p);
    }

    function testProposedNearOnePriceDoesNotSettle() public {
        _matched(); vm.warp(T0+120);
        SecondOrderMarket.Proof memory p = _proof(SIGNER_KEY,bytes32(uint256(20)),block.timestamp,
            _finalData(0,"proposed",'["0.9995","0.0005"]',"2026-10-31T02:42:00Z"));
        vm.expectRevert(SecondOrderMarket.NotFinal.selector); market.submitEvidence(0,p);
        assertEq(uint256(market.marketState().phase),1); assertEq(market.marketState().reserve,25e6);
    }

    function testSignedSplitCannotReleaseCollateralAndDeadlineRefundsEachPayer() public {
        _matched(); vm.warp(T0+120);
        vm.expectRevert(SecondOrderMarket.UnsupportedPayout.selector);
        market.submitEvidence(0,_final(0,'["0.5","0.5"]'));
        assertEq(uint256(market.marketState().phase),1); assertEq(market.marketState().reserve,25e6);
        vm.expectRevert(SecondOrderMarket.NotClaimable.selector); market.claim(buyer);
        vm.warp(T0+3600); market.voidExpired();
        market.claim(buyer); market.claim(counterparty);
        assertEq(token.balanceOf(beneficiary),10e6); assertEq(token.balanceOf(counterparty),15e6);
        assertEq(market.marketState().reserve,0);
    }

    function testOutcomeOrderChangeRejectedBeforeFunding() public {
        token.mint(buyer,10e6); vm.startPrank(buyer); token.approve(address(market),10e6);
        market.authorize(buyer,true,10e6,10e6,1,uint64(T0+300));
        SecondOrderMarket.Proof[2] memory p = _opens();
        p[0] = _proof(SIGNER_KEY,bytes32(uint256(10)),block.timestamp,
            _openData(0,false,"2026-10-31T02:40:00Z",'["Down","Up"]'));
        vm.expectRevert(SecondOrderMarket.OutcomesMismatch.selector); market.fund(bytes32(uint256(1)),10e6,p);
        vm.stopPrank(); assertEq(market.marketState().reserve,0); assertEq(token.balanceOf(buyer),10e6);
    }

    function testEarlyFinalityStopsTradingAndReplay() public {
        _matched(); vm.warp(T0+120); market.submitEvidence(0,_final(0,'["1","0"]'));
        assertTrue(market.marketState().tradingHalted);
        vm.prank(buyer); vm.expectRevert(SecondOrderMarket.TradingClosed.selector);
        market.fund(bytes32(uint256(123)),1,_opens());
        vm.expectRevert(SecondOrderMarket.DuplicateIntent.selector); market.submitEvidence(0,_final(0,'["1","0"]'));
        assertEq(market.marketState().reserve,25e6);
    }

    function testTimeoutAndUnmatchedRefundArePermissionless() public {
        _fund(buyer,beneficiary,true,10e6);
        vm.expectRevert(SecondOrderMarket.NotClaimable.selector); market.voidExpired();
        vm.warp(T0+300); market.voidExpired(); market.claim(buyer);
        assertEq(token.balanceOf(beneficiary),10e6);
    }

    function testMatchedPoolCanOnlyTimeoutAtDeadline() public {
        _matched(); vm.warp(T0+300);
        vm.expectRevert(SecondOrderMarket.NotClaimable.selector); market.voidExpired();
        vm.warp(T0+3600); market.voidExpired(); market.claim(buyer); market.claim(counterparty);
        assertEq(token.balanceOf(beneficiary),10e6); assertEq(token.balanceOf(counterparty),15e6);
    }

    function testUnsolicitedTokensDoNotEnterReserve() public {
        _matched(); token.mint(address(market),99e6); _settle(true,true); market.claim(buyer);
        assertEq(token.balanceOf(beneficiary),25e6); assertEq(token.balanceOf(address(market)),99e6);
        assertEq(market.marketState().reserve,0);
    }

    function testIntegerPayoutDustGoesToLastWinningStake() public {
        address secondWinner = makeAddr("secondWinner");
        _fund(buyer,beneficiary,true,1); _fund(secondWinner,secondWinner,true,2); _fund(counterparty,counterparty,false,7);
        _settle(true,true); market.claim(buyer); market.claim(secondWinner);
        assertEq(token.balanceOf(beneficiary),3); assertEq(token.balanceOf(secondWinner),7);
        assertEq(market.marketState().reserve,0);
    }

    function testFuzzTotalClaimsNeverExceedRecordedReserve(uint64 a,uint64 b,uint64 c) public {
        a = uint64(bound(a,1,1e12)); b = uint64(bound(b,1,1e12)); c = uint64(bound(c,1,1e12));
        address secondWinner = makeAddr("secondWinner");
        _fund(buyer,beneficiary,true,a); _fund(secondWinner,secondWinner,true,b); _fund(counterparty,counterparty,false,c);
        _settle(true,true); market.claim(buyer); market.claim(secondWinner); market.claim(counterparty);
        assertEq(token.balanceOf(beneficiary)+token.balanceOf(secondWinner),uint256(a)+b+c);
        assertEq(market.marketState().reserve,0);
    }
}
