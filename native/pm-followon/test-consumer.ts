import fs from 'node:fs'
import assert from 'node:assert/strict'
import {bsv,toByteString,SigHashPreimage,Ripemd160} from 'scrypt-ts'
import {getPreimage,DEFAULT_SIGHASH_TYPE} from 'scryptlib'
import {PolymarketOutcome} from '../src/contracts/polymarket-outcome'

PolymarketOutcome.loadArtifact('artifacts/polymarket-outcome.json')
const fixtures=JSON.parse(fs.readFileSync('pm-followon/fixtures.json','utf8'))
const wrongRoute=JSON.parse(fs.readFileSync('pm-followon/wrong-route.json','utf8'))
const b=(s:string)=>toByteString(Buffer.from(s).toString('hex'))
const point={x:BigInt('0x'+fixtures[0].publicKey.slice(4,68)),y:BigInt('0x'+fixtures[0].publicKey.slice(68,132))}
const policies=fixtures.map((f:any,i:number)=>({requestHash:toByteString(f.envelope.requestHash.slice(2)),marketId:b(f.decoded.m),conditionId:b(f.decoded.i),outcomesJsonToken:b(JSON.stringify(f.decoded.o)),selectedOutcome:BigInt(i===0?JSON.parse(f.decoded.p).indexOf('1'):1-JSON.parse(f.decoded.p).indexOf('1')),endsAt:BigInt(Date.parse(f.recordedEndDate)/1000)}))
const end=policies.reduce((m:bigint,p:any)=>m>p.endsAt?m:p.endsAt,0n),deadline=end+1800n,refundAfter=deadline+60n
const yes=bsv.Script.fromHex('76a914'+'11'.repeat(20)+'88ac'),no=bsv.Script.fromHex('76a914'+'22'.repeat(20)+'88ac'),thief=bsv.Script.fromHex('76a914'+'33'.repeat(20)+'88ac')
const pool=2000
function proof(f:any){const e=f.envelope,d=f.decoded||JSON.parse(e.data);return{timestamp:BigInt(e.timestamp),data:b(e.data),sig:{r:BigInt('0x'+e.signature.slice(2,66)),s:BigInt('0x'+e.signature.slice(66,130))},p:b(JSON.stringify(d.p)),u:b(d.t)}}
const base0=proof(fixtures[0]),base1=proof(fixtures[1])
const cases:any[]=[
 {name:'two original proofs AND false pays immutable NO 2000sat',ok:true},
 {name:'same proofs OR true pays immutable YES 2000sat',isOr:true,ok:true},
 {name:'genuine proofs cannot redirect fixed payout',recipient:thief,ok:false},
 {name:'edited prices with matching parser token cannot forge original signature',editPrice:true,ok:false},
 {name:'swapped authentic source cannot satisfy pinned market and condition',swap:true,ok:false},
 {name:'genuine same-market passthrough response cannot satisfy operation request hash',wrongRoute:true,ok:false},
 {name:'changed pinned outcome order rejects original final record',wrongOrder:true,ok:false},
 {name:'closed=false cannot satisfy literal finality',notClosed:true,ok:false},
 {name:'status=proposed cannot satisfy resolved finality',notFinal:true,ok:false},
 {name:'early refund rejected',refund:true,lockTime:Number(refundAfter-1n),ok:false},
 {name:'all-final sequence cannot bypass refund deadline',refund:true,lockTime:Number(refundAfter),sequence:0xffffffff,ok:false},
 {name:'mature non-final refund restores fixed 1000/1000',refund:true,lockTime:Number(refundAfter),ok:true},
]
const results:any={checkedAt:new Date().toISOString(),scope:'compiled local Script replay using genuine already-finalized source responses, dummy UTXO and dummy recipients; no live new prediction or broadcast',policy:{sourceEnds:policies.map((p:any)=>p.endsAt.toString()),observationDeadline:deadline.toString(),refundAfter:refundAfter.toString(),timing:'fixed signed/source observation window and signing lag; no current block timestamp upper bound; settlement/refund race after maturity'},cases:[]}
const file=process.argv.includes('--guards-only')?'pm-followon/guard-results.json':'pm-followon/consumer-results.json'
for(const tc of cases.filter(c=>!process.argv.includes('--guards-only')||c.refund||c.swap||c.wrongOrder||c.notClosed||c.notFinal)){
 const started=Date.now(),leg0={...policies[0]},leg1={...policies[1]}
 if(tc.wrongOrder)leg0.outcomesJsonToken=b(JSON.stringify(JSON.stringify(JSON.parse(fixtures[0].decoded.o).reverse())))
 let a={...base0},d={...base1}
 if(tc.swap)a={...base1}
 if(tc.wrongRoute)a=proof(wrongRoute)
 if(tc.editPrice){const raw={...fixtures[0].decoded,p:JSON.parse(fixtures[0].decoded.p)[0]==='1'?'["0", "1"]':'["1", "0"]'};a.data=b(JSON.stringify(raw));a.p=b(JSON.stringify(raw.p))}
 if(tc.notClosed)a.data=b(fixtures[0].envelope.data.replace('"c":true','"c":false'))
 if(tc.notFinal)a.data=b(fixtures[0].envelope.data.replace('"s":"resolved"','"s":"proposed"'))
 const c=new PolymarketOutcome(leg0,leg1,point,!!tc.isOr,deadline,BigInt(pool),toByteString(yes.toHex()),toByteString(no.toHex()),refundAfter,toByteString(yes.toHex()),toByteString(no.toHex()),1000n)
 const tx=new bsv.Transaction();tx.addInput(new bsv.Transaction.Input({prevTxId:Buffer.alloc(32,1),outputIndex:0,script:bsv.Script.empty(),sequenceNumber:tc.sequence??0xfffffffe,output:new bsv.Transaction.Output({script:c.lockingScript,satoshis:pool})}))
 if(tc.refund){tx.addOutput(new bsv.Transaction.Output({script:yes,satoshis:1000}));tx.addOutput(new bsv.Transaction.Output({script:no,satoshis:1000}))}
 else{tx.addOutput(new bsv.Transaction.Output({script:tc.recipient||(tc.isOr?yes:no),satoshis:pool}))}
 tx.nLockTime=tc.lockTime||0
 const subscript=c.lockingScript.subScript(0),preimage=getPreimage(tx,subscript,pool,0,DEFAULT_SIGHASH_TYPE)
 const call=(c as any).getDelegateInstance().spend(!!tc.refund,a.timestamp,a.data,a.sig,a.p,a.u,d.timestamp,d.data,d.sig,d.p,d.u,SigHashPreimage(preimage),0n,Ripemd160('00'.repeat(20)))
 const unlock=call.toScript();tx.inputs[0].setScript(unlock)
 const r=call.verify({tx,inputIndex:0,inputSatoshis:pool})
 results.cases.push({name:tc.name,status:r.success===tc.ok?'PASS':'FAIL',accepted:r.success,expectedAccepted:tc.ok,error:r.error||'',scriptInterpreterRun:true,elapsedMs:Date.now()-started,lockingScriptBytes:c.lockingScript.toHex().length/2,unlockingScriptBytes:unlock.toHex().length/2,postSeparatorScriptBytes:subscript.toHex().length/2,preimageBytes:preimage.length/2})
 results.status=r.success===tc.ok?'IN_PROGRESS':'FAIL';fs.writeFileSync(file,JSON.stringify(results,null,2)+'\n')
 console.log(tc.name,r.success===tc.ok?'PASS':'FAIL',r.error?.slice(0,130),{ms:Date.now()-started,lockingBytes:c.lockingScript.toHex().length/2,unlockingBytes:unlock.toHex().length/2})
 assert.equal(r.success,tc.ok,tc.name)
}
results.status='PASS';fs.writeFileSync(file,JSON.stringify(results,null,2)+'\n')
