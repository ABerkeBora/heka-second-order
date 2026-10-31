// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {LibString} from "solady/utils/LibString.sol";
import {ProjectedJson} from "../contracts/vendor/ProjectedJson.sol";
import {AirnodeV2Attestation} from "../contracts/vendor/AirnodeV2Attestation.sol";
import {SecondOrderMarket} from "../contracts/SecondOrderMarket.sol";
import {TestCollateral} from "../contracts/TestCollateral.sol";

/// @notice Real unmodified API3 signatures, executed locally at their recorded historical time.
/// These demonstrate contract verification, not a historical testnet deployment or newly live exposure.
contract RealSignedOpenProofTest is Test {
    using stdJson for string;
    uint256 constant SIGNED_AT = 1793414439;
    address constant AIRNODE = 0xbb451127f6d8B2bAEfB9ddFb7c724DAc38Eb9D2E;
    SecondOrderMarket market;
    TestCollateral token;
    SecondOrderMarket.Proof[2] proofs;
    bytes32[2] hashes;

    function setUp() public {
        vm.warp(SIGNED_AT);
        string[2] memory files = [string("test/fixtures/polymarket-open-6405900.json"),
            string("test/fixtures/polymarket-open-6405901.json")];
        SecondOrderMarket.Source[2] memory src;
        for (uint256 i; i < 2; i++) {
            string memory fixture = vm.readFile(files[i]);
            bytes memory data = bytes(fixture.readString(".response.data"));
            hashes[i] = fixture.readBytes32(".response.requestHash");
            proofs[i] = SecondOrderMarket.Proof({timestamp: vm.parseUint(fixture.readString(".response.timestamp")),
                data: data, signature: fixture.readBytes(".response.signature")});
            bytes memory labels = bytes(ProjectedJson.readString(data,"outcomes"));
            src[i] = SecondOrderMarket.Source({marketId: ProjectedJson.readString(data,"marketId"),
                conditionId: ProjectedJson.readBytes32(data,"conditionId"),
                outcomesHash: keccak256(abi.encode(ProjectedJson.readString(labels,uint256(0)),
                    ProjectedJson.readString(labels,uint256(1)))), createRequestHash: hashes[i],
                settlementRequestHash: keccak256(abi.encode("UNUSED_IN_OPEN_PROOF_TEST",i)), signer:AIRNODE,
                selectedOutcome:0, endTime:uint64(ProjectedJson.readTimestamp(data,"endDate"))});
        }
        token = new TestCollateral();
        market = new SecondOrderMarket(address(token),SecondOrderMarket.Policy({sources:src,operatorIsOr:false,
            tradeClosesAt:uint64(SIGNED_AT+120),deadline:uint64(SIGNED_AT+3600),maxEnvelopeAge:60,maxSourceAge:900}));
    }

    function _unchanged() internal view {
        SecondOrderMarket.State memory s = market.marketState();
        assertEq(uint256(s.phase),0); assertEq(s.reserve,0); assertEq(token.balanceOf(address(market)),0);
    }

    function testRealSignedOpenResponsesActivateAndFundPool() public {
        market.initialize(proofs);
        assertEq(uint256(market.marketState().phase),1);
        address payer = makeAddr("realProofPayer"); token.mint(payer,1e6);
        vm.startPrank(payer); token.approve(address(market),1e6);
        market.authorize(payer,true,1e6,1e6,1,uint64(SIGNED_AT+120));
        market.fund(keccak256("real-proof-intent"),1e6,proofs); vm.stopPrank();
        assertEq(market.marketState().reserve,1e6); assertEq(token.balanceOf(address(market)),1e6);
    }

    function testRealSignedResponseEditedValueRejected() public {
        proofs[0].data = bytes(LibString.replace(string(proofs[0].data),'"closed":false','"closed":true'));
        vm.expectPartialRevert(AirnodeV2Attestation.NotSignedByAirnode.selector); market.initialize(proofs);
        _unchanged();
    }

    function testRealSignedResponseTooOldRejected() public {
        vm.warp(SIGNED_AT+61);
        vm.expectRevert(abi.encodeWithSelector(SecondOrderMarket.ResponseTooOld.selector,SIGNED_AT));
        market.initialize(proofs); _unchanged();
    }

    function testRealSignedResponseForDifferentRequestRejected() public {
        proofs[0] = proofs[1];
        vm.expectPartialRevert(AirnodeV2Attestation.NotSignedByAirnode.selector); market.initialize(proofs);
        _unchanged();
    }

    function testRealResponseSignedByWrongKeyRejected() public {
        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(keccak256(abi.encodePacked(hashes[0],
            proofs[0].timestamp,proofs[0].data)));
        (uint8 v,bytes32 r,bytes32 s) = vm.sign(0xBAD,digest);
        proofs[0].signature = abi.encodePacked(r,s,v);
        vm.expectPartialRevert(AirnodeV2Attestation.NotSignedByAirnode.selector); market.initialize(proofs);
        _unchanged();
    }
}
