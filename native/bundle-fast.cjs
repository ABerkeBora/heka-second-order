const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto')
const {handleCompilerOutput}=require('scryptlib/dist/compilerWrapper')
const name=process.argv[2]||'airnode-native'
const buildFolder=process.argv[3]||'fast-compile'
const sourcePath=path.resolve('artifacts/'+name+'.scrypt')
const transform=JSON.parse(fs.readFileSync('artifacts/'+name+'.transformer.json','utf8'))
if(!transform.success)throw Error('Refusing to bundle a partial/failed TS transformation: '+JSON.stringify(transform.errors))
const hash=crypto.createHash('ripemd160').update(crypto.createHash('sha256').update(sourcePath).digest()).digest('hex').slice(0,10)
const outputDir=path.resolve(buildFolder)
const folder=path.join(outputDir,path.basename(sourcePath)+'-'+hash)
fs.mkdirSync(folder,{recursive:true})
// Direct-file compilation records paths relative to cwd; wrapper expects paths relative to source directory.
fs.writeFileSync(path.join(folder,'stdin_ast.json'),fs.readFileSync(buildFolder+'/'+name+'_ast.json','utf8').replace(/"artifacts\//g,'"'))
fs.writeFileSync(path.join(folder,'stdin_hex.txt'),fs.readFileSync(buildFolder+'/'+name+'_hex.txt','utf8').trim())
const r=handleCompilerOutput(sourcePath,{cmdPrefix:path.resolve('compiler/scryptc/mac/scryptc'),outputDir,hex:true,ast:true,artifact:true,outputToFiles:true,optimize:false},'')
if(r.errors.length)throw Error(JSON.stringify(r.errors))
fs.copyFileSync(buildFolder+'/'+name+'.json','artifacts/'+name+'.json')
fs.writeFileSync('scrypt.index.json',JSON.stringify({scryptBase:'artifacts',bindings:[{symbol:'AirnodeNative',path:'airnode-native.scrypt'},{symbol:'KeccakOneBlock',path:'keccak.scrypt'},{symbol:'KeccakTest',path:'keccak.scrypt'},{symbol:'NodaryParser',path:'nodary-parser.scrypt'},{symbol:'NodaryObservation',path:'nodary-parser.scrypt'},{symbol:'NodaryParserTest',path:'nodary-parser.scrypt'},{symbol:'NodaryOutcome',path:'nodary-outcome.scrypt'},{symbol:'KeccakTwoBlocks',path:'keccak-two.scrypt'},{symbol:'KeccakTwoTest',path:'keccak-two.scrypt'},{symbol:'IsoUtc',path:'iso-time.scrypt'},{symbol:'IsoTest',path:'iso-time.scrypt'},{symbol:'PolymarketOutcome',path:'polymarket-outcome.scrypt'},{symbol:'PMLegPolicy',path:'polymarket-outcome.scrypt'}]}))
console.log('Bundled unoptimized Script',{templateHexCharacters:r.hex.length,contract:r.contract,artifact:'artifacts/'+name+'.json'})
