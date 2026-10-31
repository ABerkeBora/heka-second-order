/** Read-only economic rejection checks against the running local project. No wallet calls or tx broadcast. */
import fs from 'node:fs';import crypto from 'node:crypto';
const names=['.runtime/state.json','.runtime/transactions.json','.runtime/next/state.json','.runtime/next/transactions.json','.runtime/bsv/intent.json','.runtime/bsv-native/intent.json'];
const snapshot=()=>Object.fromEntries(names.filter(fs.existsSync).map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const before=snapshot(),checks=[];
for(const c of [{action:'prepare',body:{stakeSatoshis:5000},error:'execution gate BLOCKED'},{action:'prepare',body:{stakeSatoshis:5000,proposalId:'replay',acceptFixedObservationWindow:true},error:'execution gate BLOCKED'},{action:'propose',body:{objective:'Continuous leveraged exposure forever'},error:'continuous or calendar-period'},{action:'fund',body:{},error:'Prepare frozen native funding first'}]){
 const r=await fetch('http://localhost:3101/api/bsv/native/'+c.action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(c.body)});const j=await r.json();if(r.status!==400||!j.error?.includes(c.error))throw Error(JSON.stringify({case:c.action,status:r.status,error:j.error}));checks.push({action:c.action,status:r.status,rejected:j.error});
}
const after=snapshot();if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Protected journals changed after invalid requests');
const result={checkedAt:new Date().toISOString(),status:'PASS',scope:'actual local HTTP resource/replay/unsupported gates; no native funding or wallet action',checks,protectedJournalHashesUnchanged:true,before,after};fs.mkdirSync('evidence/bsv-native',{recursive:true});fs.writeFileSync('evidence/bsv-native/gates.json',JSON.stringify(result,null,2)+'\n');console.log(result);
