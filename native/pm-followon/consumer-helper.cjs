/* Local native two-source Polymarket prototype. No wallet/key/broadcast operations. */
const fs=require('fs'),path=require('path'),crypto=require('crypto'),zlib=require('zlib')
const {buildContractClass,Bytes,Int,SigHashPreimage,Ripemd160,bsv}=require('scryptlib')
const {keccak256,toHex}=require('viem'),{publicKeyToAddress}=require('viem/accounts')
const artifactPath=path.join(__dirname,'../artifacts/polymarket-outcome.json')
const artifactText=fs.existsSync(artifactPath)?fs.readFileSync(artifactPath,'utf8'):zlib.gunzipSync(fs.readFileSync(artifactPath+'.gz')).toString('utf8')
const Consumer=buildContractClass(JSON.parse(artifactText))
const strip=v=>String(v).replace(/^0x/,'')
const rawBytes=s=>Bytes(Buffer.from(s,'utf8').toString('hex'))
const num=n=>Int(BigInt(n))
const canon=v=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.entries(v).sort(([a],[b])=>Buffer.compare(Buffer.from(a),Buffer.from(b))).map(([k,v])=>[k,canon(v)]):v
const projection={m:'/id',i:'/conditionId',o:'/outcomes',p:'/outcomePrices',s:'/umaResolutionStatus',c:'/closed',t:'/updatedAt'}
function requestFor(id){return{operation:'getMarketById',parameters:{id:String(id)},responseProjection:projection}}
function hashRequest(r){return keccak256(toHex(JSON.stringify([r.operation,canon(r.parameters),canon(r.responseProjection)])))}
function createPolymarketOutcome(policy){
 const key=strip(policy.airnodePublicKey),address=publicKeyToAddress('0x'+key)
 if(!/^04[0-9a-fA-F]{128}$/.test(key)||address.toLowerCase()!=='0xbb451127f6d8b2baefb9ddfb7c724dac38eb9d2e')throw Error('Expected verified original Polymarket Airnode public key')
 if(!Array.isArray(policy.legs)||policy.legs.length!==2||policy.legs[0].marketId===policy.legs[1].marketId)throw Error('Exactly two distinct source policies required')
 const legs=policy.legs.map(l=>{
  if(!/^\d{1,12}$/.test(String(l.marketId))||!/^0x[0-9a-fA-F]{64}$/.test(l.conditionId))throw Error('Malformed immutable source identity')
  const labels=JSON.parse(l.outcomesString)
  if(l.outcomesString.length>32||!Array.isArray(labels)||labels.length!==2||labels[0]===labels[1]||!labels.every(x=>x==='Up'||x==='Down'))throw Error('Only bounded, exact source Up/Down label order supported')
  if(![0,1].includes(Number(l.selectedOutcome)))throw Error('Selected outcome must be 0 or 1')
  const hash=hashRequest(requestFor(l.marketId));if(l.requestHash&&l.requestHash.toLowerCase()!==hash.toLowerCase())throw Error('Source request hash does not bind the fixed full seven-field projection')
  return{requestHash:Bytes(strip(hash)),marketId:rawBytes(String(l.marketId)),conditionId:rawBytes(l.conditionId),outcomesJsonToken:rawBytes(JSON.stringify(l.outcomesString)),selectedOutcome:num(l.selectedOutcome),endsAt:num(l.endsAt)}
 })
 const scripts=['yesRecipientScript','noRecipientScript','refundBuyerScript','refundCounterpartyScript'].map(k=>strip(policy[k]).toLowerCase())
 if(!scripts.every(s=>/^76a914[0-9a-f]{40}88ac$/.test(s))||scripts[0]===scripts[1]||new Set(scripts).size!==2||scripts[2]===scripts[3])throw Error('Payout/refund must use the same two distinct wallet-derived P2PKH recipient scripts')
 const pool=BigInt(policy.collateralSatoshis),stake=BigInt(policy.buyerStakeSatoshis)
 if(stake<=0n||stake>=pool||BigInt(policy.refundAfter)<=BigInt(policy.observationDeadline)||policy.legs.some(l=>BigInt(l.endsAt)>BigInt(policy.observationDeadline)))throw Error('Invalid fixed pool/time/refund split')
 const point={x:num('0x'+key.slice(2,66)),y:num('0x'+key.slice(66,130))}
 const c=new Consumer(legs[0],legs[1],point,!!policy.isOr,num(policy.observationDeadline),num(pool),Bytes(scripts[0]),Bytes(scripts[1]),num(policy.refundAfter),Bytes(scripts[2]),Bytes(scripts[3]),num(stake))
 const lockingHex=c.lockingScript.toHex(),postSeparatorScriptHex=c.lockingScript.subScript(0).toHex()
 return{
  lockingHex,postSeparatorScriptHex,
  info:{scope:'experimental native seven-field two-original-Airnode AND/OR guard; not deployed by helper',originalSigner:address,lockingScriptBytes:lockingHex.length/2,postSeparatorScriptBytes:postSeparatorScriptHex.length/2,lockingScriptSha256:crypto.createHash('sha256').update(Buffer.from(lockingHex,'hex')).digest('hex'),requestHashes:policy.legs.map(l=>hashRequest(requestFor(l.marketId))),minimumFundingFeeEstimateAtOneSatPerKB:Math.ceil((lockingHex.length/2+500)/1000),timing:'fixed source/signature observation window and lag, not current block age; mature settlement and refund race for the UTXO'},
  unlock({refund=false,envelopes=[],preimageHex,changeAmount=0n,changePublicKeyHash='00'.repeat(20)}){
   const args=[]
   for(let i=0;i<2;i++){
    if(refund){args.push(num(0),Bytes(''),{r:num(0),s:num(0)},Bytes(''),Bytes(''));continue}
    const e=envelopes[i],l=policy.legs[i]
    if(!e||e.requestHash.toLowerCase()!==hashRequest(requestFor(l.marketId)).toLowerCase())throw Error('Wrong source request')
    const d=JSON.parse(e.data),sig=strip(e.signature)
    if(d.m!==String(l.marketId)||d.i!==l.conditionId||d.o!==l.outcomesString||d.c!==true||d.s!=='resolved')throw Error('Source identity/order/finality mismatch')
    if(!/^[0-9a-fA-F]{130}$/.test(sig))throw Error('Original 65-byte Airnode signature required')
    args.push(num(e.timestamp),rawBytes(e.data),{r:num('0x'+sig.slice(0,64)),s:num('0x'+sig.slice(64,128))},rawBytes(JSON.stringify(d.p)),rawBytes(d.t))
   }
   const call=c.spend(!!refund,...args,SigHashPreimage(strip(preimageHex)),num(changeAmount),Ripemd160(strip(changePublicKeyHash)))
   return call.toScript().toHex()
  },
  _delegate:c,
 }
}
function verifyRaw({policy,rawTransaction,inputIndex=0,sourceSatoshis}){
 if(typeof rawTransaction!=='string'||!/^(?:[0-9a-fA-F]{2})+$/.test(rawTransaction))throw Error('Standard signed raw transaction hex required')
 const tx=new bsv.Transaction(rawTransaction)
 if(tx.toString()!==rawTransaction.toLowerCase()||!Number.isSafeInteger(inputIndex)||inputIndex<0||inputIndex>=tx.inputs.length)throw Error('Noncanonical raw transaction or wrong input index')
 const amount=Number(sourceSatoshis)
 if(!Number.isSafeInteger(amount)||amount<=0||BigInt(amount)!==BigInt(policy.collateralSatoshis))throw Error('Protected source amount must match immutable policy')
 const guard=createPolymarketOutcome(policy),started=Date.now()
 const result=guard._delegate.run_verify(tx.inputs[inputIndex].script,{tx,inputIndex,inputSatoshis:amount})
 return{...result,elapsedMs:Date.now()-started,scope:'local compiled Script VM only; not public-node operation/time-policy acceptance'}
}
module.exports={createPolymarketOutcome,requestFor,hashRequest,verifyRaw}
