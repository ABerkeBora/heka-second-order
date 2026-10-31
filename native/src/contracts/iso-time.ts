import {SmartContract,SmartContractLib,method,prop,assert,ByteString,len,slice,toByteString,Utils} from 'scrypt-ts'
export class IsoUtc extends SmartContractLib{
 @method() static digits(s:ByteString,start:bigint,count:bigint):bigint{
  let value=0n
  for(let i=0;i<4;i++){if(BigInt(i)<count){const c=Utils.fromLEUnsigned(slice(s,start+BigInt(i),start+BigInt(i+1)));assert(c>=48n&&c<=57n,'non digit');value=value*10n+c-48n}}
  return value
 }
 @method() static parse(s:ByteString):bigint{
  const size=len(s)
  assert(size>=20n&&size<=27n,'unsupported UTC timestamp length')
  assert(slice(s,4n,5n)===toByteString('2d')&&slice(s,7n,8n)===toByteString('2d')&&slice(s,10n,11n)===toByteString('54')&&slice(s,13n,14n)===toByteString('3a')&&slice(s,16n,17n)===toByteString('3a')&&slice(s,size-1n)===toByteString('5a'),'not exact UTC ISO')
  if(size>20n){assert(size>=22n&&slice(s,19n,20n)===toByteString('2e'),'bad fraction');for(let i=0;i<6;i++){if(20n+BigInt(i)<size-1n){const c=Utils.fromLEUnsigned(slice(s,20n+BigInt(i),21n+BigInt(i)));assert(c>=48n&&c<=57n,'bad fractional digit')}}}
  const year=IsoUtc.digits(s,0n,4n)
  const month=IsoUtc.digits(s,5n,2n)
  const day=IsoUtc.digits(s,8n,2n)
  const hour=IsoUtc.digits(s,11n,2n)
  const minute=IsoUtc.digits(s,14n,2n)
  const second=IsoUtc.digits(s,17n,2n)
  assert(year>=1970n&&year<=2100n&&month>=1n&&month<=12n&&hour<24n&&minute<60n&&second<60n,'invalid UTC components')
  const leap=year%4n===0n&&(year%100n!==0n||year%400n===0n)
  let daysInMonth=31n
  if(month===2n){daysInMonth=leap?29n:28n}else if(month===4n||month===6n||month===9n||month===11n){daysInMonth=30n}
  assert(day>=1n&&day<=daysInMonth,'invalid day')
  const y=year-(month<=2n?1n:0n)
  const era=y/400n
  const yoe=y-era*400n
  const m=month+(month>2n?-3n:9n)
  const doy=(153n*m+2n)/5n+day-1n
  const doe=yoe*365n+yoe/4n-yoe/100n+doy
  return (era*146097n+doe-719468n)*86400n+hour*3600n+minute*60n+second
 }
}
export class IsoTest extends SmartContract{
 @prop() expected:bigint
 constructor(expected:bigint){super(...arguments);this.expected=expected}
 @method() public unlock(s:ByteString){assert(IsoUtc.parse(s)===this.expected,'ISO mismatch')}
}
