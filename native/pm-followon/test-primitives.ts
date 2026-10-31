import fs from 'node:fs'
import assert from 'node:assert/strict'
import {keccak256,toHex} from 'viem'
import {toByteString} from 'scrypt-ts'
import {KeccakTwoBlocks,KeccakTwoTest} from '../src/contracts/keccak-two'
import {IsoTest} from '../src/contracts/iso-time'
KeccakTwoTest.loadArtifact('artifacts/keccak-two.json');IsoTest.loadArtifact('artifacts/iso-time.json')
const results:any={checkedAt:new Date().toISOString(),scope:'local compiled two-block Keccak and strict UTC parser',keccak:[],iso:[]}
for(const size of [0,135,136,192,256,271]){
 const hex=toHex('x'.repeat(size)),expected=keccak256(hex),data=toByteString(hex.slice(2));assert.equal('0x'+KeccakTwoBlocks.digest(data),expected)
 const c=new KeccakTwoTest(toByteString(expected.slice(2))),r=(c as any).getDelegateInstance().unlock(data).verify({});assert(r.success,r.error);results.keccak.push({bytes:size,status:'PASS',scriptInterpreterRun:true});console.log('two-block Keccak',size,'PASS')
}
const tooBig=new KeccakTwoTest(toByteString('00'.repeat(32)));const oversized=(tooBig as any).getDelegateInstance().unlock(toByteString('00'.repeat(272))).verify({});assert(!oversized.success);results.keccak.push({bytes:272,expectedRejected:true,status:'PASS',scriptInterpreterRun:true})
const dates=['1970-01-01T00:00:00Z','2000-02-29T23:59:59.123456Z','2026-10-31T09:47:29.502728Z','2099-12-31T23:59:59Z','2100-03-01T00:00:00Z']
for(const date of dates){const epoch=BigInt(Math.floor(Date.parse(date)/1000)),c=new IsoTest(epoch),r=(c as any).getDelegateInstance().unlock(toByteString(Buffer.from(date).toString('hex'))).verify({});assert(r.success,r.error);results.iso.push({date,epoch:epoch.toString(),status:'PASS',scriptInterpreterRun:true});console.log('UTC',date,'PASS')}
for(const date of ['2026-02-30T00:00:00Z','2100-02-29T00:00:00Z','2026-13-01T00:00:00Z','2026-10-31T24:00:00Z','2026-10-31T09:47:29.Z']){const c=new IsoTest(0n),r=(c as any).getDelegateInstance().unlock(toByteString(Buffer.from(date).toString('hex'))).verify({});assert(!r.success,date);results.iso.push({date,expectedRejected:true,status:'PASS',scriptInterpreterRun:true})}
results.status='PASS';fs.writeFileSync('pm-followon/primitives-results.json',JSON.stringify(results,null,2)+'\n')
