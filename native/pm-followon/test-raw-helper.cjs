const fs=require('fs'),assert=require('assert/strict')
const {Transaction,TransactionSignature,LockingScript}=require('@bsv/sdk')
const {bsv,getPreimage,DEFAULT_SIGHASH_TYPE,SigHashPreimage,Int,Bytes,Ripemd160}=require('scryptlib')
const {createPolymarketOutcome,verifyRaw}=require('./consumer-helper.cjs')
const f=JSON.parse(fs.readFileSync('pm-followon/fixtures.json','utf8'))
const yes='76a914'+'11'.repeat(20)+'88ac',no='76a914'+'22'.repeat(20)+'88ac',fee='76a914'+'33'.repeat(20)+'88ac'
const legs=f.map((x,i)=>({marketId:x.decoded.m,conditionId:x.decoded.i,outcomesString:x.decoded.o,selectedOutcome:i===0?JSON.parse(x.decoded.p).indexOf('1'):1-JSON.parse(x.decoded.p).indexOf('1'),endsAt:BigInt(Date.parse(x.recordedEndDate)/1000)}))
const end=legs.reduce((m,l)=>m>l.endsAt?m:l.endsAt,0n),deadline=end+1800n
const policy={legs,airnodePublicKey:f[0].publicKey,isOr:true,observationDeadline:deadline,collateralSatoshis:2000n,yesRecipientScript:yes,noRecipientScript:no,refundAfter:deadline+60n,refundBuyerScript:yes,refundCounterpartyScript:no,buyerStakeSatoshis:1000n};const guard=createPolymarketOutcome(policy)
const tx=new bsv.Transaction()
tx.addInput(new bsv.Transaction.Input({prevTxId:Buffer.alloc(32,1),outputIndex:0,script:bsv.Script.empty(),sequenceNumber:0xfffffffe,output:new bsv.Transaction.Output({script:bsv.Script.fromHex(guard.lockingHex),satoshis:2000})}))
tx.addInput(new bsv.Transaction.Input({prevTxId:Buffer.alloc(32,2),outputIndex:1,script:bsv.Script.empty(),sequenceNumber:0xfffffffe,output:new bsv.Transaction.Output({script:bsv.Script.fromHex(fee),satoshis:1000})}))
tx.addOutput(new bsv.Transaction.Output({script:bsv.Script.fromHex(yes),satoshis:2000}));tx.addOutput(new bsv.Transaction.Output({script:bsv.Script.fromHex(fee),satoshis:900}))
const sdk=Transaction.fromHex(tx.toString()),inputIndex=0
const pre=TransactionSignature.format({sourceTXID:sdk.inputs[0].sourceTXID,sourceOutputIndex:0,sourceSatoshis:2000,transactionVersion:sdk.version,otherInputs:sdk.inputs.filter((_,i)=>i!==inputIndex),inputIndex,outputs:sdk.outputs,inputSequence:sdk.inputs[0].sequence,subscript:LockingScript.fromHex(guard.postSeparatorScriptHex),lockTime:sdk.lockTime,scope:TransactionSignature.SIGHASH_ALL|TransactionSignature.SIGHASH_FORKID})
const preHex=Buffer.from(pre).toString('hex'),legacy=getPreimage(tx,bsv.Script.fromHex(guard.postSeparatorScriptHex),2000,0,DEFAULT_SIGHASH_TYPE);assert.equal(preHex,legacy)
const unlock=guard.unlock({envelopes:f.map(x=>x.envelope),preimageHex:preHex,changeAmount:900n,changePublicKeyHash:'33'.repeat(20)})
const args=[];for(const x of f){const e=x.envelope,s=e.signature.replace(/^0x/,'');args.push(Int(BigInt(e.timestamp)),Bytes(Buffer.from(e.data).toString('hex')),{r:Int(BigInt('0x'+s.slice(0,64))),s:Int(BigInt('0x'+s.slice(64,128)))},Bytes(Buffer.from(JSON.stringify(x.decoded.p)).toString('hex')),Bytes(Buffer.from(x.decoded.t).toString('hex')))}
const call=guard._delegate.spend(false,...args,SigHashPreimage(preHex),Int(900),Ripemd160('33'.repeat(20)));assert.equal(unlock,call.toScript().toHex());tx.inputs[0].setScript(call.toScript())
const started=Date.now(),r=verifyRaw({policy,rawTransaction:tx.toString(),inputIndex:0,sourceSatoshis:2000});assert(r.success,r.error)
const result={checkedAt:new Date().toISOString(),scope:'local compiled native guard with two-input fee sponsor, exact protected payout and sponsor change; dummy addresses/UTXOs only',status:'PASS',sdkVersion:'3.2.1',sdkLegacyPreimageEqual:true,sighash:65,preimageBytes:pre.length,unlockingScriptBytes:unlock.length/2,protectedPayoutSatoshis:2000,sponsorInput:1000,sponsorChange:900,fixtureFeeSatoshis:100,elapsedMs:Date.now()-started,...guard.info}
fs.writeFileSync('pm-followon/raw-helper-results.json',JSON.stringify(result,null,2)+'\n');console.log(result)
