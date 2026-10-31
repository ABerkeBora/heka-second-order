/** Deterministic isolated RPC fault test. Never imports the application's live runtime. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { keccak256, encodeFunctionData, parseAbi, parseTransaction } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const verifyDir = path.join(project, '.verify');
fs.mkdirSync(verifyDir, { recursive: true });
if (!fs.existsSync(path.join(verifyDir, '.gitignore'))) fs.writeFileSync(path.join(verifyDir, '.gitignore'), '*\n');
const sandbox = fs.mkdtempSync(path.join(verifyDir, 'recovery-sandbox-'));
fs.mkdirSync(path.join(sandbox, 'src'));
for (const name of ['chain.ts', 'store.ts']) fs.copyFileSync(path.join(project, 'src', name), path.join(sandbox, 'src', name));
fs.writeFileSync(path.join(sandbox, 'package.json'), '{"private":true,"type":"module"}\n');
fs.symlinkSync(path.join(project, 'node_modules'), path.join(sandbox, 'node_modules'), 'dir');
const fixtureKey = '0x' + '1'.padStart(64, '0'); // Public, universally known test fixture; never used against a live chain here.
const fixtureAccount = privateKeyToAccount(fixtureKey);
const walletFile = path.join(sandbox, 'fake-wallets.json');
fs.writeFileSync(walletFile, JSON.stringify({ testOnly: true, chainId: 84532, project: 'second-order', roles: Object.fromEntries(['deployer', 'buyer', 'counterparty'].map(role => [role, { address: fixtureAccount.address, privateKey: fixtureKey }])) }), { mode: 0o600 });
const id = 'recovery-fixture:buyer:approve';
const target = '0x1111111111111111111111111111111111111111';
const recipient = '0x2222222222222222222222222222222222222222';
const abi = parseAbi(['function approve(address,uint256) returns(bool)']);
const calldata = encodeFunctionData({ abi, functionName: 'approve', args: [recipient, 0n] });
const changedCalldata = encodeFunctionData({ abi, functionName: 'approve', args: [recipient, 1n] });
const counters = {};
const rawAttempts = [];
const accepted = new Map();
let allowBroadcast = false;
const blockHash = '0x' + 'ab'.repeat(32);
const block = { number: '0x1', hash: blockHash, parentHash: '0x' + '00'.repeat(32), nonce: '0x0000000000000000', sha3Uncles: '0x' + '00'.repeat(32), logsBloom: '0x' + '00'.repeat(256), transactionsRoot: '0x' + '00'.repeat(32), stateRoot: '0x' + '00'.repeat(32), receiptsRoot: '0x' + '00'.repeat(32), miner: '0x' + '00'.repeat(20), difficulty: '0x0', totalDifficulty: '0x0', extraData: '0x', size: '0x100', gasLimit: '0x1c9c380', gasUsed: '0x0', timestamp: '0x6b000000', baseFeePerGas: '0x3b9aca00', transactions: [], uncles: [] };
function rpc(method, params = []) {
  counters[method] = (counters[method] || 0) + 1;
  if (method === 'eth_chainId') return '0x14a34';
  if (method === 'eth_getTransactionCount') return '0x0';
  if (method === 'eth_getBlockByNumber') return block;
  if (method === 'eth_blockNumber') return '0x1';
  if (method === 'eth_maxPriorityFeePerGas' || method === 'eth_gasPrice') return '0x3b9aca00';
  if (method === 'eth_estimateGas') return '0xc350';
  if (method === 'eth_call') return '0x' + '00'.repeat(32); // OP L1/operator-fee oracle returns zero in this fixture.
  if (method === 'eth_getTransactionReceipt') return accepted.get(params[0])?.receipt || null;
  if (method === 'eth_getTransactionByHash') return null;
  if (method === 'eth_sendRawTransaction') {
    const raw = params[0]; const hash = keccak256(raw); rawAttempts.push({ raw, hash, allowed: allowBroadcast });
    if (!allowBroadcast) throw { code: -32000, message: 'Deliberate isolated RPC broadcast fault; transaction was not executed' };
    if (!accepted.has(hash)) {
      const parsed = parseTransaction(raw);
      assert.equal(parsed.chainId, 84532); assert.equal(parsed.nonce, 0); assert.equal(parsed.to.toLowerCase(), target.toLowerCase()); assert.equal(parsed.data, calldata);
      accepted.set(hash, { raw, executions: 1, receipt: { transactionHash: hash, transactionIndex: '0x0', blockHash, blockNumber: '0x1', from: fixtureAccount.address, to: target, cumulativeGasUsed: '0xc350', gasUsed: '0xc350', contractAddress: null, logs: [], logsBloom: '0x' + '00'.repeat(256), status: '0x1', effectiveGasPrice: '0x3b9aca00', type: '0x2', l1Fee: '0x0' } });
    }
    return hash;
  }
  throw { code: -32601, message: `Unexpected mock RPC method ${method}` };
}
const server = http.createServer(async (req, res) => {
  let body = ''; for await (const chunk of req) body += chunk;
  const requests = JSON.parse(body); const processRequest = ({ id: requestId, method, params }) => { try { return { jsonrpc: '2.0', id: requestId, result: rpc(method, params) }; } catch (error) { return { jsonrpc: '2.0', id: requestId, error: { code: error.code || -32603, message: error.message || String(error) } }; } };
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(Array.isArray(requests) ? requests.map(processRequest) : processRequest(requests)));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const rpcUrl = `http://127.0.0.1:${server.address().port}`;
fs.writeFileSync(path.join(sandbox, 'runner.mjs'), `
import assert from 'node:assert/strict';
import {send,reconcile} from './src/chain.ts';
const id=${JSON.stringify(id)}; const tx={to:${JSON.stringify(target)},data:${JSON.stringify(calldata)}};
if(process.argv[2]==='fault') {
  try { await send(id,'buyer',tx); throw Error('Fault unexpectedly accepted'); }
  catch(error) { if(!String(error.message).includes('Deliberate isolated RPC broadcast fault')) throw error; console.log('EXPECTED_BROADCAST_FAULT_AFTER_JOURNAL_PERSIST'); process.kill(process.pid,'SIGKILL'); }
} else {
  const first=await reconcile(id); assert.equal(first.status,'success');
  const second=await reconcile(id); assert.equal(second.transactionHash,first.transactionHash);
  await assert.rejects(send(id,'buyer',{...tx,data:${JSON.stringify(changedCalldata)}}),/arguments changed/);
  console.log(JSON.stringify({status:'PASS',transactionHash:first.transactionHash,repeatedReceiptSameHash:true,changedArgumentsRejected:true}));
}
`);
function child(mode) { return new Promise((resolve, reject) => { const proc = spawn(process.execPath, ['runner.mjs', mode], { cwd: sandbox, env: { PATH: process.env.PATH, RPC_URL: rpcUrl, WALLET_FILE: walletFile, NODE_ENV: 'test' }, stdio: ['ignore', 'pipe', 'pipe'] }); let output = '', errors = ''; proc.stdout.on('data', b => output += b); proc.stderr.on('data', b => errors += b); proc.on('error', reject); const timeout = setTimeout(() => { proc.kill('SIGKILL'); reject(Error('Isolated recovery child exceeded 40 seconds')); }, 40000); proc.on('close', (code, signal) => { clearTimeout(timeout); resolve({ code, signal, output: output.trim(), errors: errors.trim() }); }); }); }
let result;
try {
  const first = await child('fault');
  assert.equal(first.signal, 'SIGKILL', first.errors || first.output); assert.match(first.output, /EXPECTED_BROADCAST_FAULT_AFTER_JOURNAL_PERSIST/);
  const journalFile = path.join(sandbox, '.runtime', 'transactions.json');
  const before = JSON.parse(fs.readFileSync(journalFile, 'utf8'))[id]; assert.equal(before.status, 'prepared'); assert.equal(before.hash, keccak256(before.raw)); assert.equal(accepted.size, 0); assert.ok(fs.existsSync(path.join(sandbox, '.runtime', 'executor.lock')), 'SIGKILL must leave stale lock for restart recovery');
  const beforeRestartCounters = { ...counters }; allowBroadcast = true;
  const second = await child('restart'); assert.equal(second.code, 0, second.errors || second.output);
  const after = JSON.parse(fs.readFileSync(journalFile, 'utf8'))[id];
  assert.equal(after.raw, before.raw); assert.equal(after.hash, before.hash); assert.equal(after.fingerprint, before.fingerprint); assert.equal(after.createdAt, before.createdAt); assert.equal(after.status, 'success');
  assert.equal(accepted.size, 1); assert.equal([...accepted.values()].reduce((n, entry) => n + entry.executions, 0), 1);
  assert.ok(rawAttempts.length >= 2); assert.ok(rawAttempts.every(attempt => attempt.raw === before.raw && attempt.hash === before.hash));
  for (const method of ['eth_getTransactionCount', 'eth_estimateGas', 'eth_getBlockByNumber', 'eth_maxPriorityFeePerGas', 'eth_call']) assert.equal(counters[method] || 0, beforeRestartCounters[method] || 0, `Restart unexpectedly prepared another transaction (${method})`);
  assert.ok(!fs.existsSync(path.join(sandbox, '.runtime', 'executor.lock')), 'Successful process exit must release lock');
  result = { status: 'PASS', checkedAt: new Date().toISOString(), command: 'node scripts/recovery-test.mjs', mode: 'Isolated local mocked RPC fault/restart; not a live-chain transaction', productionFilesCopied: ['src/chain.ts', 'src/store.ts'], productionSourceSha256: Object.fromEntries(['chain.ts', 'store.ts'].map(name => [`src/${name}`, createHash('sha256').update(fs.readFileSync(path.join(sandbox, 'src', name))).digest('hex')])), transactionHash: before.hash, action: 'Mock approve zero tokens to a public fixture address', assertions: { persistedBeforeRejectedBroadcast: true, firstProcessKilled: first.signal, stalePidLockRecovered: true, identicalRawBytesAcrossRestart: true, identicalHashAcrossRestart: true, acceptedUniqueHashes: accepted.size, acceptedEconomicExecutions: 1, noNewNonceOrPreparationOnRestart: true, repeatedReconcileReturnsSameReceipt: true, changedArgumentsRejected: true, successfulExitReleasesLock: true }, broadcastAttempts: rawAttempts.length, rejectedBroadcastAttempts: rawAttempts.filter(a => !a.allowed).length, acceptedBroadcastAttempts: rawAttempts.filter(a => a.allowed).length, rpcCounters: counters, limits: ['Mock RPC returns zero L1/operator fees; this test does not validate live fee estimation.', 'One known public fixture key is used only in the private sandbox; no real funds are accessed.', 'No real wallet, app .runtime, source APIs, live RPC, or port 3101 is used.', 'This proves executor journal recovery in this fault case, not chain reorg handling.'] };
  fs.mkdirSync(path.join(project, 'evidence'), { recursive: true }); fs.writeFileSync(path.join(project, 'evidence', 'recovery-test.json'), JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result, null, 2));
} finally { await new Promise(resolve => server.close(resolve)); }
