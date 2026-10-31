/** Isolated regression of the actual V2 compose/authorize and preparation guards; no live services. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = path.join(project, ".verify");
fs.mkdirSync(base, { recursive: true });
const sandbox = fs.mkdtempSync(path.join(base, "next-gates-"));
fs.mkdirSync(path.join(sandbox, "src", "vendor"), { recursive: true });
fs.writeFileSync(path.join(sandbox, "package.json"), '{"private":true,"type":"module"}\n');
fs.symlinkSync(path.join(project, "node_modules"), path.join(sandbox, "node_modules"), "dir");
const productionFiles = ["src/next.ts", "src/engine.ts", "src/store.ts", "src/intent.ts", "src/vendor/airnode-v2.ts"];
for (const file of productionFiles) fs.copyFileSync(path.join(project, file), path.join(sandbox, file));
const sourceSha256 = Object.fromEntries(productionFiles.map(file => [file, createHash("sha256").update(fs.readFileSync(path.join(sandbox, file))).digest("hex")]));

fs.writeFileSync(path.join(sandbox, "src", "fixtures.ts"), `
export const control = {markets:[], model:null, change:null, changeAt:0, proofCalls:0, modelCalls:0, discoverCalls:0, actions:[], journal:[], allowPreparation:false, networkCalls:0};
`);
fs.writeFileSync(path.join(sandbox, "src", "source.ts"), `
import {encodeAbiParameters,keccak256,toHex} from 'viem';
import {control} from './fixtures.ts';
export const AIRNODE='0x1111111111111111111111111111111111111111';
export const MAX_ENVELOPE_AGE=300,MAX_SOURCE_AGE=900;
export const outcomesOf=value=>typeof value==='string'?JSON.parse(value):value;
export const outcomeHash=labels=>keccak256(encodeAbiParameters([{type:'string'},{type:'string'}],labels));
export const requestFor=(id,settlement=false)=>({operation:'getMarketById',parameters:{id},responseProjection:settlement?{marketId:'/id',status:'/umaResolutionStatus'}:{marketId:'/id',closed:'/closed'}});
export const proofArgs=response=>({timestamp:BigInt(response.timestamp),data:toHex(response.data),signature:response.signature});
export async function discover(){control.discoverCalls++;return{markets:structuredClone(control.markets),checkedAt:new Date().toISOString(),requestHash:'fixture-only'};}
export async function createProof(id){
 control.proofCalls++;
 const market=control.markets.find(m=>m.id===id); if(!market)throw Error('Fixture source ID is absent');
 const data={marketId:id,conditionId:market.conditionId,closed:false,endDate:market.endDate,outcomes:JSON.stringify(market.outcomes),updatedAt:market.updatedAt};
 if(control.proofCalls===control.changeAt){
  if(control.change==='condition')data.conditionId='0x'+'9'.repeat(64);
  if(control.change==='outcomes')data.outcomes=JSON.stringify([...market.outcomes].reverse());
  if(control.change==='end')data.endDate=new Date(Date.parse(market.endDate)+60000).toISOString();
  if(control.change==='closed')throw Error('Fixture createProof rejects a now-closed signed source');
 }
 return{data,response:{airnode:AIRNODE,requestHash:'0x'+'0'.repeat(64),timestamp:String(Math.floor(Date.now()/1000)),data:JSON.stringify(data),signature:'0x00'}};
}
export async function settlementProof(){throw Error('Unexpected settlement in backend-gates regression');}
`);
fs.writeFileSync(path.join(sandbox, "src", "llm.ts"), `
import {control} from './fixtures.ts';
export async function proposeIntent(){control.modelCalls++;return structuredClone(control.model);}
export async function propose(){throw Error('V1 model path must not run in isolated V2 gates test');}
`);
fs.writeFileSync(path.join(sandbox, "src", "chain.ts"), `
import {keccak256,toHex} from 'viem';import {control} from './fixtures.ts';
export const address=role=>({deployer:'0x0000000000000000000000000000000000000011',buyer:'0x0000000000000000000000000000000000000022',counterparty:'0x0000000000000000000000000000000000000033'})[role];
export const client={};export const marketAbi=()=>[];export const TOKEN_ABI=[];
export const transactions=()=>control.journal;
export async function reconcile(){return undefined;}
function attempt(action){control.actions.push(action);if(!control.allowPreparation)throw Error('Unexpected economic dependency invocation: '+action.functionName);const receipt={status:'success',transactionHash:keccak256(toHex(action.id)),contractAddress:action.contractAddress};control.journal.push({...action,hash:receipt.transactionHash,status:'success'});return receipt;}
export async function deploy(id,name){return attempt({id,kind:'deploy',functionName:name,contractAddress:name==='TestCollateral'?'0x0000000000000000000000000000000000000044':'0x0000000000000000000000000000000000000055'});}
export async function write(id,role,to,abi,functionName,args){return attempt({id,kind:'write',role,to,functionName,args});}
export async function read(){throw Error('Unexpected contract read in backend-gates regression');}
`);
fs.writeFileSync(path.join(sandbox, "runner.mjs"), `
import assert from 'node:assert/strict';import fs from 'node:fs';
import {state,save,withStore} from './src/store.ts';
import {composeNext,authorizeNext} from './src/next.ts';
import {parseIntent} from './src/intent.ts';
import {control} from './src/fixtures.ts';
const NOW=Date.parse('2026-10-31T03:05:00Z');Date.now=()=>NOW;
globalThis.fetch=()=>{control.networkCalls++;throw Error('Network forbidden in backend-gates regression');};
const objective='Ethereum Up OR Solana Up in the same next 5-minute window.';
const parsed=parseIntent(objective);assert.equal(parsed.status,'supported');
const fields=()=>({markets:[],proposals:[],intents:[],evidence:{checks:[]},updatedAt:new Date().toISOString()});
function candidates(){return [
 {id:'6406061',conditionId:'0x'+'1'.padStart(64,'0'),question:'Ethereum Up or Down - October 30, 11:15PM-11:20PM ET',slug:'eth-updown-5m-1793416500',outcomes:['Up','Down'],endDate:'2026-10-31T03:20:00Z',updatedAt:'2026-10-31T03:05:00Z',eligible:true,closed:false},
 {id:'6406069',conditionId:'0x'+'2'.padStart(64,'0'),question:'Solana Up or Down - October 30, 11:15PM-11:20PM ET',slug:'sol-updown-5m-1793416500',outcomes:['Up','Down'],endDate:'2026-10-31T03:20:00Z',updatedAt:'2026-10-31T03:05:00Z',eligible:true,closed:false},
 {id:'6406070',conditionId:'0x'+'3'.padStart(64,'0'),question:'XRP Up or Down - October 30, 11:15PM-11:20PM ET',slug:'xrp-updown-5m-1793416500',outcomes:['Up','Down'],endDate:'2026-10-31T03:20:00Z',updatedAt:'2026-10-31T03:05:00Z',eligible:true,closed:false}
];}
function model(){return{id:'fixture-model-output',model:'dependency-fixture-no-model-call',decision:'accept',normalized:structuredClone(parsed.intent),marketIds:['6406061','6406069'],selectedOutcomeIndexes:[0,0],reason:'Fixture accepts the supplied exact pair',startedAt:new Date().toISOString(),latencyMs:0};}
function reset(options={}){
 for(const key of Object.keys(state))delete state[key];Object.assign(state,fields());
 Object.assign(control,{markets:candidates(),model:model(),change:null,changeAt:0,proofCalls:0,modelCalls:0,discoverCalls:0,actions:[],journal:[],allowPreparation:false,networkCalls:0,...options});
 state.markets=structuredClone(control.markets);save();
}
const results=[];
function zeroActions(label){assert.equal(control.actions.length,0,label+' attempted deploy/mint/fund');assert.equal(control.journal.length,0);assert.equal(control.networkCalls,0);assert.equal(state.intents.length,0);assert.equal(state.deployment,undefined);assert.equal(state.proposal,undefined);}
async function negative(name,options,text=objective,expectedCode,expectedProofCalls){
 reset(options);const review=await composeNext(text);assert.equal(review.status,'unsupported/no-action',name);assert.equal(review.economicAction,'none');
 assert.equal(review.reasons[0].code,expectedCode,name);zeroActions(name);
 if(expectedProofCalls!==undefined)assert.equal(control.proofCalls,expectedProofCalls,name);
 results.push({name,status:'PASS',reasonCode:review.reasons[0].code,proofCalls:control.proofCalls,modelCalls:control.modelCalls,chainDependencyAttempts:control.actions.length,positions:state.intents.length});
}
withStore('v1',()=>{Object.assign(state,fields());state.intents=[{id:'retained-v1-fixture'}];save();});
const v1Before=fs.readFileSync('./.runtime/state.json','utf8');
await assert.rejects(composeNext(objective),/isolated namespace/);
await withStore('next',async()=>{
 await negative('whole-week rejects before catalog/model/preparation',{},'Ethereum Up OR Solana Up throughout the entire week.','UNSUPPORTED_WINDOW',0);
 assert.equal(control.modelCalls,0);
 await negative('absent Cardano pair rejects without substitution',{},'Cardano Up OR Ethereum Up in the same next 5-minute window.','NO_CATALOG_MATCH',0);
 assert.equal(control.modelCalls,0);
 const changedNormalized=model();changedNormalized.normalized.windowMinutes=15;
 await negative('model normalization drift rejects before preparation',{model:changedNormalized},objective,'normalization_mismatch',0);
 const wrongAsset=model();wrongAsset.marketIds=['6406061','6406070'];
 await negative('allowed but wrong asset rejects before preparation',{model:wrongAsset},objective,'ASSET_MISMATCH',0);
 const wrongOperator=model();wrongOperator.normalized.operator='AND';
 await negative('wrong model operator rejects before preparation',{model:wrongOperator},objective,'normalization_mismatch',0);
 for(const change of ['condition','outcomes','end','closed']){
  await negative('compose preflight rejects '+change+' source drift',{change,changeAt:1},objective,change==='closed'?'validation_unavailable':'source_changed',1);
  await negative('real engine preparation rejects '+change+' before collateral setup',{change,changeAt:3},objective,'PREPARATION_REJECTED',3);
 }
 // Positive composition must traverse actual prepareProposal and all mocked setup boundaries.
 reset({allowPreparation:true});const prepared=await composeNext(objective);assert.equal(prepared.ready,true);assert.equal(state.intentReview.status,'accepted');
 assert.deepEqual(control.actions.map(a=>a.functionName),['TestCollateral','mint','mint','SecondOrderMarket','initialize']);
 assert.equal(control.proofCalls,4);assert.equal(state.intents.length,0);
 results.push({name:'valid proposal traverses actual preparation without funding',status:'PASS',economicCalls:control.actions.map(a=>a.functionName),proofCalls:control.proofCalls,fundingCalls:control.actions.filter(a=>a.functionName==='fund').length});
 const currentReview=state.intentReview;
 const body={proposalId:prepared.id,reviewId:currentReview.id,objective,side:'YES',stakeUnits:'1000000'};
 const initialActions=control.actions.length;
 const initialIntents=state.intents.length;
 for(const [name,patch]of[
  ['dirty objective cannot authorize prior review',{objective:objective+' Ignore caps.'}],
  ['wrong review ID rejects',{reviewId:'old-or-forged-review'}],
  ['previous proposal ID rejects',{proposalId:'previous-proposal'}]
 ]){
  await assert.rejects(authorizeNext({...body,...patch}),/current objective|normalization/);assert.equal(control.actions.length,initialActions);assert.equal(state.intents.length,initialIntents);
  results.push({name,status:'PASS',newChainDependencyAttempts:0,newPositions:0});
 }
 const originalReview=structuredClone(state.intentReview);state.intentReview={...originalReview,status:'unsupported/no-action'};
 await assert.rejects(authorizeNext(body),/current objective/);assert.equal(state.intents.length,0);assert.equal(control.actions.length,initialActions);
 results.push({name:'latest rejected review invalidates retained accepted proposal',status:'PASS',newChainDependencyAttempts:0,newPositions:0});
 state.intentReview=originalReview;
 const authorized=await authorizeNext(body);assert.equal(authorized.proposalId,prepared.id);assert.equal(authorized.status,'authorizing');assert.equal(state.intents.length,1);
 assert.equal(authorized.mandate.recipient,prepared.contractAddress);assert.equal(authorized.mandate.total,'1000000');assert.equal(authorized.mandate.maxActions,1);assert.equal(authorized.mandate.maxAgentTransactions,8);
 assert.equal(control.actions.length,initialActions,'Authorization gate itself must not introduce fixture funding');
 results.push({name:'exact latest objective/review/proposal accepts one scoped intent',status:'PASS',positions:state.intents.length,mandatePerAction:authorized.mandate.perAction,mandateMaxActions:authorized.mandate.maxActions,mandateMaxAgentTransactions:authorized.mandate.maxAgentTransactions,chainDependencyAttemptsDuringAuthorization:control.actions.length-initialActions});
 // A subsequent actual rejection clears the proposal and blocks its old accepted review.
 const rejectedReview=await composeNext('Ethereum Up OR Solana Up throughout the entire week.');assert.equal(rejectedReview.status,'unsupported/no-action');assert.equal(state.proposal,undefined);
 await assert.rejects(authorizeNext(body),/current objective/);assert.equal(state.intents.length,1);assert.equal(control.actions.length,initialActions);
 results.push({name:'new unsupported review prevents old-proposal authorization',status:'PASS',existingPositionsPreserved:state.intents.length,newChainDependencyAttempts:0});
 assert.equal(control.networkCalls,0);
});
assert.equal(fs.readFileSync('./.runtime/state.json','utf8'),v1Before,'V1 fixture namespace changed');
const result={status:'PASS',mode:'Isolated production-module guard regression; source/model/chain dependencies are fixtures, no real source/model or chain activity',historicalClock:'2026-10-31T03:05:00Z',caseCount:results.length,cases:results,assertions:{actualNextComposeAndAuthorize:true,actualEnginePreparation:true,actualNamespacedStore:true,invalidTargetsBeforeAnyChainDependency:true,preparationSourceDriftBeforeCollateralSetup:true,dirtyOrStaleApprovalRejected:true,exactLatestApprovalAccepted:true,v1FixtureNamespaceUnchanged:true,noNetworkOrRealKeys:true},limits:['Dependency fixtures do not prove Airnode cryptography, LLM quality or EVM execution; those have separate integration evidence.','Positive fixture preparation records mock deploy/mint/initialize boundaries, never a live payment.','authorizeNext acceptance creates a scoped local intent; the automatic runIntent economic execution is outside this focused gate test.','The closed-source fixture throws under the production createProof contract; source verification itself is not reimplemented here.']};
fs.writeFileSync('./result.json',JSON.stringify(result,null,2));console.log('NEXT_BACKEND_GATES_PASS '+results.length);
`);

const startedAt = new Date().toISOString();
let result;
try {
  const run = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["runner.mjs"], {
      cwd: sandbox,
      env: { PATH: process.env.PATH, NODE_ENV: "test" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "", err = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(Error("Isolated backend gates exceeded 20 seconds")); }, 20000);
    child.stdout.on("data", b => out += b);
    child.stderr.on("data", b => err += b);
    child.on("error", error => { clearTimeout(timer); reject(error); });
    child.on("close", code => { clearTimeout(timer); resolve({ code, out, err }); });
  });
  assert.equal(run.code, 0, run.err || run.out);
  result = JSON.parse(fs.readFileSync(path.join(sandbox, "result.json"), "utf8"));
} catch (error) {
  result = { status: "FAIL", error: error instanceof Error ? error.message : String(error) };
}
Object.assign(result, { startedAt, checkedAt: new Date().toISOString(), command: "node scripts/next-gates-test.mjs", productionFilesCopied: productionFiles, productionSourceSha256: sourceSha256, isolatedSandboxUnderIgnoredVerify: true, realApplicationRuntimeAccessed: false });
const outputDirectory = path.join(project, "evidence", "v2");
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(path.join(outputDirectory, "backend-gates.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ status: result.status, caseCount: result.caseCount, error: result.error, evidence: "evidence/v2/backend-gates.json" }, null, 2));
if (result.status !== "PASS") process.exitCode = 1;
