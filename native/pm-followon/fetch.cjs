const fs=require('fs');const{keccak256,toHex,encodePacked,hashMessage,recoverPublicKey,verifyMessage}=require('viem');const{publicKeyToAddress}=require('viem/accounts')
const canonicalize=v=>Array.isArray(v)?v.map(canonicalize):v&&typeof v==='object'?Object.entries(v).sort(([a],[b])=>Buffer.compare(Buffer.from(a),Buffer.from(b))).map(([k,v])=>[k,canonicalize(v)]):v
const requestHash=r=>keccak256(toHex(JSON.stringify([r.operation,canonicalize(r.parameters),canonicalize(r.responseProjection)])))
async function main(){
 const ids=process.argv.slice(2);if(ids.length!==2)throw Error('Pass two explicit recorded/fresh candidate IDs; do not reuse old fixture as a new prediction')
 const discovery=JSON.parse(fs.readFileSync('pm-followon/discovery-brief.json','utf8'))
 const fixtures=await Promise.all(ids.map(async id=>{
  const request={operation:'getMarketById',parameters:{id},responseProjection:{m:'/id',i:'/conditionId',o:'/outcomes',p:'/outcomePrices',s:'/umaResolutionStatus',c:'/closed',t:'/updatedAt'}}
  const r=await fetch('https://airnode-polymarket.fly.dev/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(20000)})
  if(!r.ok)throw Error('Airnode HTTP'+r.status)
  const envelope=await r.json(),hash=requestHash(request)
  if(hash!==envelope.requestHash)throw Error('Request mismatch')
  const inner=keccak256(encodePacked(['bytes32','uint256','bytes'],[hash,BigInt(envelope.timestamp),toHex(envelope.data)])),digest=hashMessage({raw:inner})
  const publicKey=await recoverPublicKey({hash:digest,signature:envelope.signature}),address=publicKeyToAddress(publicKey)
  if(address.toLowerCase()!=='0xbb451127f6d8b2baefb9ddfb7c724dac38eb9d2e')throw Error('Wrong original signer')
  const decoded=JSON.parse(envelope.data)
  if(decoded.m!==id||decoded.c!==true||decoded.s!=='resolved')throw Error('Not the expected finalized market')
  return {observedAt:new Date().toISOString(),scope:'already finalized market; cryptographic replay, not a newly funded future market',recordedEndDate:discovery.candidates.find(c=>c.id===id)?.endDate,request,envelope,decoded,inner,digest,publicKey,address,packedBytes:64+Buffer.byteLength(envelope.data),independentViemVerified:await verifyMessage({address,message:{raw:inner},signature:envelope.signature})}
 }))
 if(fixtures[0].publicKey!==fixtures[1].publicKey)throw Error('Unexpected signer key mismatch')
 fs.writeFileSync('pm-followon/fixtures.json',JSON.stringify(fixtures,null,2)+'\n');console.log(fixtures.map(f=>({id:f.decoded.m,bytes:f.packedBytes,verified:f.independentViemVerified,status:f.decoded.s})))
}
main().catch(e=>{console.error(e);process.exitCode=1})
