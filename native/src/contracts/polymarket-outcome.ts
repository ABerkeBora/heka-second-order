import {SmartContract,prop,method,ByteString,assert,Utils,reverseByteString,toByteString,len,hash256,SigHash,SigHashPreimage,Ripemd160} from 'scrypt-ts'
import {SECP256K1,Point,Signature} from 'scrypt-ts-lib'
import {KeccakOneBlock} from './keccak'
import {KeccakTwoBlocks} from './keccak-two'
import {IsoUtc} from './iso-time'

export type PMLegPolicy={requestHash:ByteString,marketId:ByteString,conditionId:ByteString,outcomesJsonToken:ByteString,selectedOutcome:bigint,endsAt:bigint}

/** Experimental native two-original-Airnode AND/OR consumer; no attestor key. */
export class PolymarketOutcome extends SmartContract{
 @prop() leg0:PMLegPolicy
 @prop() leg1:PMLegPolicy
 @prop() airnodePublicKey:Point
 @prop() isOr:boolean
 @prop() observationDeadline:bigint
 @prop() collateralSatoshis:bigint
 @prop() yesRecipientScript:ByteString
 @prop() noRecipientScript:ByteString
 @prop() refundAfter:bigint
 @prop() refundBuyerScript:ByteString
 @prop() refundCounterpartyScript:ByteString
 @prop() buyerStakeSatoshis:bigint
 constructor(leg0:PMLegPolicy,leg1:PMLegPolicy,airnodePublicKey:Point,isOr:boolean,observationDeadline:bigint,collateralSatoshis:bigint,yesRecipientScript:ByteString,noRecipientScript:ByteString,refundAfter:bigint,refundBuyerScript:ByteString,refundCounterpartyScript:ByteString,buyerStakeSatoshis:bigint){
  super(...arguments)
  this.leg0=leg0;this.leg1=leg1;this.airnodePublicKey=airnodePublicKey;this.isOr=isOr;this.observationDeadline=observationDeadline;this.collateralSatoshis=collateralSatoshis;this.yesRecipientScript=yesRecipientScript;this.noRecipientScript=noRecipientScript;this.refundAfter=refundAfter;this.refundBuyerScript=refundBuyerScript;this.refundCounterpartyScript=refundCounterpartyScript;this.buyerStakeSatoshis=buyerStakeSatoshis
 }
 @method() verifyLeg(leg:PMLegPolicy,timestamp:bigint,data:ByteString,signature:Signature,pricesJsonToken:ByteString,updatedAtIso:ByteString):boolean{
  assert(len(leg.requestHash)===32n&&len(leg.marketId)>0n&&len(leg.marketId)<=12n&&len(leg.conditionId)===66n&&(leg.selectedOutcome===0n||leg.selectedOutcome===1n),'invalid source policy')
  const token10=toByteString('225b5c22315c222c205c22305c225d22')
  const token01=toByteString('225b5c22305c222c205c22315c225d22')
  const compact10=toByteString('225b5c22315c222c5c22305c225d22')
  const compact01=toByteString('225b5c22305c222c5c22315c225d22')
  assert(pricesJsonToken===token10||pricesJsonToken===token01||pricesJsonToken===compact10||pricesJsonToken===compact01,'not exact terminal one-hot string')
  const expected=toByteString('7b2263223a747275652c2269223a22')+leg.conditionId+toByteString('222c226d223a22')+leg.marketId+toByteString('222c226f223a')+leg.outcomesJsonToken+toByteString('2c2270223a')+pricesJsonToken+toByteString('2c2273223a227265736f6c766564222c2274223a22')+updatedAtIso+toByteString('227d')
  assert(data===expected,'raw source identity/order/finality mismatch')
  const sourceAt=IsoUtc.parse(updatedAtIso)
  assert(sourceAt>=leg.endsAt&&sourceAt<=this.observationDeadline&&timestamp>=leg.endsAt&&timestamp<=this.observationDeadline,'outside immutable observation window')
  assert(sourceAt<=timestamp+30n&&timestamp<=sourceAt+900n,'source/signature lag')
  const packed=leg.requestHash+reverseByteString(Utils.toLEUnsigned(timestamp,32n),32n)+data
  const inner=KeccakTwoBlocks.digest(packed)
  const digest=KeccakOneBlock.digest(toByteString('19457468657265756d205369676e6564204d6573736167653a0a3332')+inner)
  assert(SECP256K1.verifySig(Utils.fromLEUnsigned(reverseByteString(digest,32n)),signature,this.airnodePublicKey),'original Polymarket Airnode mismatch')
  const winnerIndex:bigint=(pricesJsonToken===token10||pricesJsonToken===compact10)?0n:1n
  return winnerIndex===leg.selectedOutcome
 }
 @method() public spend(refund:boolean,t0:bigint,d0:ByteString,s0:Signature,p0:ByteString,u0:ByteString,t1:bigint,d1:ByteString,s1:Signature,p1:ByteString,u1:ByteString,preimage:SigHashPreimage,changeAmount:bigint,changeAddress:Ripemd160){
  assert(this.leg0.marketId!==this.leg1.marketId&&this.observationDeadline>=this.leg0.endsAt&&this.observationDeadline>=this.leg1.endsAt&&this.refundAfter>this.observationDeadline&&this.collateralSatoshis>0n&&this.buyerStakeSatoshis>0n&&this.buyerStakeSatoshis<this.collateralSatoshis,'invalid paired policy')
  let expectedOutputs=Utils.buildOutput(this.refundBuyerScript,this.buyerStakeSatoshis)+Utils.buildOutput(this.refundCounterpartyScript,this.collateralSatoshis-this.buyerStakeSatoshis)
  if(!refund){
   const wins0=this.verifyLeg(this.leg0,t0,d0,s0,p0,u0)
   const wins1=this.verifyLeg(this.leg1,t1,d1,s1,p1,u1)
   const yes=this.isOr?(wins0||wins1):(wins0&&wins1)
   expectedOutputs=Utils.buildOutput(yes?this.yesRecipientScript:this.noRecipientScript,this.collateralSatoshis)
  }
  this.insertCodeSeparator()
  assert(this.checkPreimageSigHashType(preimage,SigHash.ALL),'actual transaction preimage mismatch')
  assert(SigHash.value(preimage)===this.collateralSatoshis,'wrong protected collateral')
  if(refund){assert(SigHash.nSequence(preimage)<0xffffffffn&&SigHash.nLocktime(preimage)>=this.refundAfter,'refund not mature')}
  assert(changeAmount>=0n,'negative change')
  const change=changeAmount>0n?Utils.buildPublicKeyHashOutput(changeAddress,changeAmount):toByteString('')
  assert(SigHash.hashOutputs(preimage)===hash256(expectedOutputs+change),'fixed AND/OR payout mismatch')
 }
}
