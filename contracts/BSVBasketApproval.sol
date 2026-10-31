// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {AirnodeV2Attestation} from "./vendor/AirnodeV2Attestation.sol";
import {ProjectedJson} from "./vendor/ProjectedJson.sol";
import {JSONParserLib} from "solady/utils/JSONParserLib.sol";
import {LibString} from "solady/utils/LibString.sol";

/// @notice Original API3 proof consumer for a BSV basket. No EVM collateral.
/// BSV does not verify this EVM state; an explicitly trusted attestor reads it.
contract BSVBasketApproval {
    using JSONParserLib for JSONParserLib.Item;
    struct Source { string marketId; bytes32 conditionId; bytes32 outcomesHash; bytes32 createRequestHash; bytes32 settlementRequestHash; address signer; uint8 selectedOutcome; uint64 endTime; }
    struct Proof { uint256 timestamp; bytes data; bytes signature; }
    Source[2] private sources;
    bytes32 public immutable manifestHash;
    bool public immutable operatorIsOr;
    uint256 public immutable createdAt;
    uint256 public immutable tradeClosesAt;
    uint256 public immutable deadline;
    bool public initialized;
    bool[2] public finalSource;
    bool[2] public selectedWon;
    bool public settled;
    bool public result;
    bool public voided;
    error InvalidPolicy(); error DuplicateAction(); error WrongPhase(); error ResponseTooOld(uint256 timestamp); error FutureTimestamp(uint256 timestamp); error SourceTooOld(uint256 timestamp); error IdentityMismatch(); error OutcomesMismatch(); error NotOpen(); error NotFinal(); error UnsupportedPayout(); error OutsideWindow();
    event BasketApproved(bytes32 indexed manifestHash);
    event SourceApproved(uint8 indexed component, bool selectedWon);
    event SettlementApproved(bytes32 indexed manifestHash, bool result);
    event RefundApproved(bytes32 indexed manifestHash);
    constructor(Source[2] memory fixedSources, bool isOr, bytes32 hash, uint256 closes, uint256 expires) {
        if(hash == bytes32(0) || closes <= block.timestamp || expires <= closes || expires > block.timestamp + 1 days) revert InvalidPolicy();
        for(uint256 i; i<2; i++) { Source memory s=fixedSources[i]; if(s.signer==address(0)||s.conditionId==bytes32(0)||s.selectedOutcome>1||s.endTime<=closes||s.endTime>=expires) revert InvalidPolicy(); sources[i]=s; }
        manifestHash=hash; operatorIsOr=isOr; createdAt=block.timestamp; tradeClosesAt=closes; deadline=expires;
    }
    function source(uint256 i) external view returns(Source memory) { return sources[i]; }
    function initialize(Proof[2] calldata proofs) external { if(initialized) revert DuplicateAction(); if(block.timestamp>=tradeClosesAt) revert OutsideWindow(); for(uint8 i;i<2;i++){_verify(i,proofs[i],false); if(ProjectedJson.readBool(proofs[i].data,"closed")) revert NotOpen(); if(ProjectedJson.readTimestamp(proofs[i].data,"endDate")!=sources[i].endTime) revert IdentityMismatch();} initialized=true; emit BasketApproved(manifestHash); }
    function verifyProof(uint8 i, Proof calldata p, bool terminal) external view returns(uint256){return _verify(i,p,terminal);}
    function submit(uint8 i, Proof calldata p) external { if(!initialized||settled||voided) revert WrongPhase(); if(i>1) revert InvalidPolicy(); if(finalSource[i]) revert DuplicateAction(); if(block.timestamp>=deadline) revert OutsideWindow(); uint256 updated=_verify(i,p,true); if(p.timestamp<createdAt||updated<createdAt||block.timestamp<sources[i].endTime) revert OutsideWindow(); if(!ProjectedJson.readBool(p.data,"closed")||!LibString.eq(ProjectedJson.readString(p.data,"status"),"resolved")) revert NotFinal(); bytes memory prices=bytes(ProjectedJson.readString(p.data,"outcomePrices")); JSONParserLib.Item memory a=JSONParserLib.parse(string(prices)); if(!a.isArray()||a.size()!=2) revert UnsupportedPayout(); string memory p0=ProjectedJson.readString(prices,uint256(0)); string memory p1=ProjectedJson.readString(prices,uint256(1)); bool first=LibString.eq(p0,"1")&&LibString.eq(p1,"0"); bool second=LibString.eq(p0,"0")&&LibString.eq(p1,"1"); if(!first&&!second) revert UnsupportedPayout(); finalSource[i]=true; selectedWon[i]=sources[i].selectedOutcome==0?first:second; emit SourceApproved(i,selectedWon[i]); if(finalSource[0]&&finalSource[1]){ result=operatorIsOr ? selectedWon[0]||selectedWon[1] : selectedWon[0]&&selectedWon[1]; settled=true; emit SettlementApproved(manifestHash,result); } }
    function approveRefund() external { if(!initialized||settled||voided) revert WrongPhase(); if(block.timestamp<deadline) revert OutsideWindow(); voided=true; emit RefundApproved(manifestHash); }
    function _verify(uint8 i, Proof calldata p, bool terminal) internal view returns(uint256 updated){ if(i>1) revert InvalidPolicy(); Source storage s=sources[i]; AirnodeV2Attestation.verify(s.signer,terminal?s.settlementRequestHash:s.createRequestHash,p.timestamp,p.data,p.signature); if(p.timestamp>block.timestamp+30) revert FutureTimestamp(p.timestamp); if(p.timestamp+300<block.timestamp) revert ResponseTooOld(p.timestamp); if(!LibString.eq(ProjectedJson.readString(p.data,"marketId"),s.marketId)||ProjectedJson.readBytes32(p.data,"conditionId")!=s.conditionId) revert IdentityMismatch(); bytes memory labels=bytes(ProjectedJson.readString(p.data,"outcomes")); JSONParserLib.Item memory a=JSONParserLib.parse(string(labels)); if(!a.isArray()||a.size()!=2||keccak256(abi.encode(ProjectedJson.readString(labels,uint256(0)),ProjectedJson.readString(labels,uint256(1))))!=s.outcomesHash) revert OutcomesMismatch(); updated=ProjectedJson.readTimestamp(p.data,"updatedAt"); if(updated>block.timestamp+30) revert FutureTimestamp(updated); if(updated+900<block.timestamp) revert SourceTooOld(updated); }
}
