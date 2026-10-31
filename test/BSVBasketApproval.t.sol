// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Test} from "forge-std/Test.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {LibString} from "solady/utils/LibString.sol";
import {AirnodeV2Attestation} from "../contracts/vendor/AirnodeV2Attestation.sol";
import {BSVBasketApproval} from "../contracts/BSVBasketApproval.sol";

/// Synthetic local signing keys; not real Airnode or BSV network evidence.
contract BSVBasketApprovalTest is Test {
 uint256 constant T=1793414400;uint256 constant KEY=0xA113;BSVBasketApproval a;
 function setUp() public {vm.warp(T);a=deploy(false);a.initialize(opens());}
 function deploy(bool isOr) internal returns(BSVBasketApproval){BSVBasketApproval.Source[2] memory s;for(uint256 i;i<2;i++)s[i]=BSVBasketApproval.Source(i==0?"100":"200",bytes32(i+1),keccak256(abi.encode("Up","Down")),bytes32(i+10),bytes32(i+20),vm.addr(KEY),0,uint64(T+600));return new BSVBasketApproval(s,isOr,keccak256("fixed BSV manifest"),T+300,T+3600);}
 function proof(uint256 key,bytes32 request,uint256 time,bytes memory data) internal pure returns(BSVBasketApproval.Proof memory){bytes32 hash=MessageHashUtils.toEthSignedMessageHash(keccak256(abi.encodePacked(request,time,data)));(uint8 v,bytes32 r,bytes32 s)=vm.sign(key,hash);return BSVBasketApproval.Proof(time,data,abi.encodePacked(r,s,v));}
 function data(uint8 i,bool closed,string memory status,string memory prices,string memory updated) internal view returns(bytes memory){return bytes(string.concat('{"marketId":"',i==0?"100":"200",'","conditionId":"',vm.toString(bytes32(uint256(i)+1)),'","closed":',closed?"true":"false",',"endDate":"2026-10-31T02:50:00Z","outcomes":"',LibString.escapeJSON('["Up","Down"]'),'","status":"',status,'","outcomePrices":"',LibString.escapeJSON(prices),'","updatedAt":"',updated,'"}'));}
 function opens() internal view returns(BSVBasketApproval.Proof[2] memory p){for(uint8 i;i<2;i++)p[i]=proof(KEY,bytes32(uint256(i)+10),block.timestamp,data(i,false,"open",'["0.5","0.5"]',"2026-10-31T02:40:00Z"));}
 function terminal(uint8 i,string memory prices) internal view returns(BSVBasketApproval.Proof memory){return proof(KEY,bytes32(uint256(i)+20),block.timestamp,data(i,true,"resolved",prices,"2026-10-31T02:50:00Z"));}
 function settle(string memory x,string memory y) internal {vm.warp(T+600);a.submit(0,terminal(0,x));a.submit(1,terminal(1,y));}
 function testValidOriginalProofCreatesEssentialApprovalState() public {assertTrue(a.initialized());assertEq(a.manifestHash(),keccak256("fixed BSV manifest"));settle('["1","0"]','["1","0"]');assertTrue(a.settled());assertTrue(a.result());}
 function testAndFalse() public {settle('["1","0"]','["0","1"]');assertFalse(a.result());}
 function testOrTrue() public {a=deploy(true);a.initialize(opens());settle('["0","1"]','["1","0"]');assertTrue(a.result());}
 function testEditedValueRejectedBeforeStateChange() public {vm.warp(T+600);BSVBasketApproval.Proof memory p=terminal(0,'["1","0"]');p.data=data(0,true,"resolved",'["0","1"]',"2026-10-31T02:50:00Z");vm.expectPartialRevert(AirnodeV2Attestation.NotSignedByAirnode.selector);a.submit(0,p);assertFalse(a.finalSource(0));}
 function testWrongRequestRejected() public {vm.warp(T+600);BSVBasketApproval.Proof memory p=proof(KEY,bytes32(uint256(99)),block.timestamp,data(0,true,"resolved",'["1","0"]',"2026-10-31T02:50:00Z"));vm.expectPartialRevert(AirnodeV2Attestation.NotSignedByAirnode.selector);a.submit(0,p);assertFalse(a.finalSource(0));}
 function testWrongSignerRejected() public {vm.warp(T+600);BSVBasketApproval.Proof memory p=proof(0xBAD,bytes32(uint256(20)),block.timestamp,data(0,true,"resolved",'["1","0"]',"2026-10-31T02:50:00Z"));vm.expectPartialRevert(AirnodeV2Attestation.NotSignedByAirnode.selector);a.submit(0,p);assertFalse(a.finalSource(0));}
 function testUneditedStaleProofRejected() public {vm.warp(T+600);BSVBasketApproval.Proof memory p=terminal(0,'["1","0"]');vm.warp(T+901);vm.expectRevert(abi.encodeWithSelector(BSVBasketApproval.ResponseTooOld.selector,T+600));a.submit(0,p);assertFalse(a.finalSource(0));}
 function testFreshEnvelopeDoesNotRefreshStaleSource() public {vm.warp(T+1600);BSVBasketApproval.Proof memory p=proof(KEY,bytes32(uint256(20)),block.timestamp,data(0,true,"resolved",'["1","0"]',"2026-10-31T02:40:00Z"));vm.expectRevert(abi.encodeWithSelector(BSVBasketApproval.SourceTooOld.selector,T));a.submit(0,p);}
 function testNearOneIsNotFinal() public {vm.warp(T+600);vm.expectRevert(BSVBasketApproval.UnsupportedPayout.selector);a.submit(0,terminal(0,'["0.9995","0.0005"]'));}
 function testProposedIsNotResolved() public {vm.warp(T+600);BSVBasketApproval.Proof memory p=proof(KEY,bytes32(uint256(20)),block.timestamp,data(0,true,"proposed",'["1","0"]',"2026-10-31T02:50:00Z"));vm.expectRevert(BSVBasketApproval.NotFinal.selector);a.submit(0,p);}
 function testClosedFalseIsNotResolved() public {vm.warp(T+600);BSVBasketApproval.Proof memory p=proof(KEY,bytes32(uint256(20)),block.timestamp,data(0,false,"resolved",'["1","0"]',"2026-10-31T02:50:00Z"));vm.expectRevert(BSVBasketApproval.NotFinal.selector);a.submit(0,p);}
 function testDuplicateSourceCannotExecuteTwice() public {vm.warp(T+600);a.submit(0,terminal(0,'["1","0"]'));vm.expectRevert(BSVBasketApproval.DuplicateAction.selector);a.submit(0,terminal(0,'["0","1"]'));assertTrue(a.selectedWon(0));}
 function testDoubleInitializationBlocked() public {vm.expectRevert(BSVBasketApproval.DuplicateAction.selector);a.initialize(opens());}
 function testRefundOnlyAfterImmutableDeadline() public {vm.expectRevert(BSVBasketApproval.OutsideWindow.selector);a.approveRefund();vm.warp(T+3600);a.approveRefund();assertTrue(a.voided());vm.expectRevert(BSVBasketApproval.WrongPhase.selector);a.approveRefund();}
 function testSettledCannotRefund() public {settle('["1","0"]','["1","0"]');vm.warp(T+3600);vm.expectRevert(BSVBasketApproval.WrongPhase.selector);a.approveRefund();}
 function testInvalidComponentRejected() public {vm.expectRevert(BSVBasketApproval.InvalidPolicy.selector);a.verifyProof(2,proof(KEY,bytes32(uint256(20)),block.timestamp,bytes('{}')),true);}
}
