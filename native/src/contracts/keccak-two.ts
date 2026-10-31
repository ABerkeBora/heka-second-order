import {SmartContract,SmartContractLib,method,prop,assert,ByteString,FixedArray,fill,len,slice,toByteString,Utils,xor,and} from 'scrypt-ts'
import {KeccakOneBlock} from './keccak'

/** Experimental Ethereum Keccak-256, bounded to two rate blocks (0..271 bytes). */
export class KeccakTwoBlocks extends SmartContractLib {
 @method() static permute(a:FixedArray<bigint,25>):FixedArray<bigint,25>{
  for(let round=0;round<24;round++){
   let c:FixedArray<bigint,5>=fill(0n,5)
   let d:FixedArray<bigint,5>=fill(0n,5)
   for(let x=0;x<5;x++){c[x]=xor(xor(xor(xor(a[x],a[x+5]),a[x+10]),a[x+15]),a[x+20])}
   for(let x=0;x<5;x++){d[x]=xor(c[(x+4)%5],KeccakOneBlock.rot(c[(x+1)%5],1n))}
   for(let y=0;y<5;y++){for(let x=0;x<5;x++){a[x+5*y]=xor(a[x+5*y],d[x])}}
   let b:FixedArray<bigint,25>=fill(0n,25)
   for(let y=0;y<5;y++){for(let x=0;x<5;x++){b[y+5*((2*x+3*y)%5)]=KeccakOneBlock.rot(a[x+5*y],KeccakOneBlock.ROT[x+5*y])}}
   for(let y=0;y<5;y++){for(let x=0;x<5;x++){a[x+5*y]=xor(b[x+5*y],and(xor(KeccakOneBlock.MASK,b[(x+1)%5+5*y]),b[(x+2)%5+5*y]))}}
   a[0]=xor(a[0],KeccakOneBlock.RC[round])
  }
  return a
 }
 @method() static digest(input:ByteString):ByteString{
  const size=len(input)
  assert(size<=271n,'two block input limit')
  const paddedSize:bigint=size<136n?136n:272n
  let padded=toByteString('')
  if(size===paddedSize-1n){padded=input+toByteString('81')}
  else{padded=input+toByteString('01')+Utils.toLEUnsigned(0n,paddedSize-size-2n)+toByteString('80')}
  let a:FixedArray<bigint,25>=fill(0n,25)
  for(let block=0;block<2;block++){
   if(BigInt(block)*136n<paddedSize){
    for(let i=0;i<17;i++){const pos=BigInt(block)*136n+BigInt(i)*8n;a[i]=xor(a[i],Utils.fromLEUnsigned(slice(padded,pos,pos+8n)))}
    a=KeccakTwoBlocks.permute(a)
   }
  }
  return Utils.toLEUnsigned(a[0],8n)+Utils.toLEUnsigned(a[1],8n)+Utils.toLEUnsigned(a[2],8n)+Utils.toLEUnsigned(a[3],8n)
 }
}
export class KeccakTwoTest extends SmartContract{
 @prop() expected:ByteString
 constructor(expected:ByteString){super(...arguments);this.expected=expected}
 @method() public unlock(input:ByteString){assert(KeccakTwoBlocks.digest(input)===this.expected,'Keccak mismatch')}
}
