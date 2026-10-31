/** Read-only live V1/V2 isolation checks plus two deliberately malformed cross-namespace HTTP probes. */
import fs from "node:fs";
import path from "node:path";
import { type Address } from "viem";
import { client, marketAbi, TOKEN_ABI } from "../src/chain.ts";
import { root } from "../src/store.ts";
const base = "http://127.0.0.1:3101";
const load = (file: string) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const snapshot = load(".runtime/v1-before-v2.json");
const baseline = load(".runtime/v2-before-baseline.json");
const normalize = (v: any): any => typeof v === "bigint" ? v.toString() : Array.isArray(v) ? v.map(normalize) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, normalize(x)])) : v;
const checks: any[] = [];
function check(name: string, expected: any, actual: any) { const e = normalize(expected), a = normalize(actual); checks.push({ name, status: JSON.stringify(e) === JSON.stringify(a) ? "PASS" : "FAIL", expected: e, actual: a }); }
const hashes = (rows: any[]) => rows.map(t => t.hash.toLowerCase()).sort();
const journal = (next = false) => load(next ? ".runtime/next/transactions.json" : ".runtime/transactions.json");
const journalHashes = (next = false) => hashes(Object.values(journal(next)));
async function api(next: boolean) { const r = await fetch(`${base}/api${next ? "/next" : ""}/state`, { signal: AbortSignal.timeout(15000) }); if (!r.ok) throw Error(`State API ${r.status}`); return r.json(); }
if (await client.getChainId() !== 84532) throw Error("Only Base Sepolia84532 is permitted");
const [v1, v2] = await Promise.all([api(false), api(true)]);
if (!v2.proposal?.contractAddress || !v2.deployment?.tokenAddress) throw Error("No initialized V2 market exists");
const v1Hashes = hashes(snapshot.transactions), v2Hashes = hashes(v2.transactions);
check("V1 initial API transaction hashes equal snapshot", v1Hashes, hashes(v1.transactions));
check("V1 transaction count", 31, v1.transactions.length);
check("V1 hashes equal independent private baseline", baseline.v1TransactionHashes.map((h: string) => h.toLowerCase()).sort(), hashes(v1.transactions));
check("V1 complete intents and deliveries unchanged", snapshot.intents, v1.intents);
check("V1 token unchanged", baseline.v1Token.toLowerCase(), v1.deployment.tokenAddress.toLowerCase());
check("V2 has a distinct collateral token", true, v2.deployment.tokenAddress.toLowerCase() !== baseline.v1Token.toLowerCase());
const oldContracts = v1.intents.map((i: any) => i.contractAddress.toLowerCase());
check("V2 has a distinct market", true, !oldContracts.includes(v2.proposal.contractAddress.toLowerCase()));
check("No shared V1/V2 receipt hash", 0, v2Hashes.filter((h: string) => v1Hashes.includes(h)).length);
check("V2 intent contracts absent from V1", true, v2.intents.every((i: any) => !oldContracts.includes(i.contractAddress.toLowerCase())));
const parallel = await Promise.all(Array.from({ length: 4 }, (_, n) => Promise.all([api(false), api(true)]).then(pair => ({ n, pair }))));
for (const { n, pair } of parallel) { const [a, b] = pair; check(`Parallel read${n} V1 exact hashes`, v1Hashes, hashes(a.transactions)); check(`Parallel read${n} V1 token`, baseline.v1Token.toLowerCase(), a.deployment.tokenAddress.toLowerCase()); check(`Parallel read${n} V2 token`, v2.deployment.tokenAddress.toLowerCase(), b.deployment.tokenAddress.toLowerCase()); check(`Parallel read${n} V2 has no V1 receipts`, 0, hashes(b.transactions).filter((h: string) => v1Hashes.includes(h)).length); }
// Both targets are unknown in the destination namespace. The malformed envelope also prevents any
// signing/write even if namespace lookup were accidentally bypassed by a regression.
const beforeNegative = { v1: journalHashes(false), v2: journalHashes(true) };
const probes = await Promise.all([
  { route: "/api/evidence", target: v2.proposal.contractAddress, expected: "V1 rejects a V2 target" },
  { route: "/api/next/evidence", target: v1.intents[0].contractAddress, expected: "V2 rejects a V1 target" },
].map(async probe => { const r = await fetch(base + probe.route, { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:3101" }, body: JSON.stringify({ marketId: probe.target, sourceIndex: 0, envelope: {} }), signal: AbortSignal.timeout(20000) }); const data = await r.json(); return { route: probe.route, target: probe.target, description: probe.expected, httpStatus: r.status, error: data.error }; }));
const afterNegative = { v1: journalHashes(false), v2: journalHashes(true) };
for (const p of probes) { check(`${p.description}: HTTP400`, 400, p.httpStatus); check(`${p.description}: rejected before envelope/write`, "Unknown market or source", p.error); }
check("Cross-namespace negative calls leave V1 journal hash set unchanged", beforeNegative.v1, afterNegative.v1);
check("Cross-namespace negative calls leave V2 journal hash set unchanged", beforeNegative.v2, afterNegative.v2);
const blockNumber = await client.getBlockNumber();
const token = baseline.v1Token as Address;
const balances = await Promise.all(baseline.balances.map(async (b: any) => { const [collateral, native] = await Promise.all([client.readContract({ address: token, abi: TOKEN_ABI, functionName: "balanceOf", args: [b.address], blockNumber }), client.getBalance({ address: b.address, blockNumber })]); check(`V1 ${b.role} collateral remains unchanged`, b.v1CollateralUnits, collateral); return { role: b.role, address: b.address, v1CollateralUnits: String(collateral), beforeNativeBalanceWei: b.nativeBalanceWei, nativeBalanceWei: native.toString(), nativeDeltaWei: (native - BigInt(b.nativeBalanceWei)).toString() }; }));
const oldMarkets = await Promise.all(oldContracts.map(async (address: string) => { const [m, balance] = await Promise.all([client.readContract({ address: address as Address, abi: marketAbi(), functionName: "marketState", blockNumber }), client.readContract({ address: token, abi: TOKEN_ABI, functionName: "balanceOf", args: [address as Address], blockNumber })]) as any[]; check(`V1 market${address} remains Settled`, 2, Number(m.phase)); check(`V1 market${address} accounted reserve`, "0", m.reserve); check(`V1 market${address} actual collateral balance`, "0", balance); return { contract: address, state: normalize(m), collateralBalanceUnits: String(balance) }; }));
const v2Market = await client.readContract({ address: v2.proposal.contractAddress, abi: marketAbi(), functionName: "marketState", blockNumber }) as any;
check("V2 buyer stake funded", "1000000", v2Market.yesStake);
check("V2 counterparty stake funded", "1000000", v2Market.noStake);
const [finalV1, finalV2] = await Promise.all([api(false), api(true)]);
check("Final V1 complete intents preserved", snapshot.intents, finalV1.intents);
check("Final V1 exact hash set preserved", v1Hashes, hashes(finalV1.transactions));
const report = { status: checks.every(c => c.status === "PASS") ? "PASS" : "FAIL", checkedAt: new Date().toISOString(), command: "node --env-file-if-exists=.env scripts/verify-next-isolation.ts", network: "Base Sepolia", chainId: 84532, pinnedReadBlock: blockNumber.toString(), baselineCheckedAt: baseline.checkedAt, checkCount: checks.length, checks, probes, balances, oldMarkets, v2: { token: v2.deployment.tokenAddress, market: v2.proposal.contractAddress, initialTransactionCount: v2.transactions.length, finalTransactionCount: finalV2.transactions.length, observedChainState: normalize(v2Market) }, journalHashSetsBeforeNegative: beforeNegative, journalHashSetsAfterNegative: afterNegative, trustAndLimits: ["No executor acquisition, wallet signing, token movement or chain write was performed by this verifier.", "Only two authorized malformed cross-namespace HTTP probes were sent; both must reject at unknown-intent lookup before a write.", "V1 and V2 intentionally share the isolated test-role addresses and one global executor queue; native ETH changes reflect V2 gas and do not imply V1 collateral changed.", "On-chain values are read at one pinned block; V2 automation may legitimately advance after that block."] };
fs.mkdirSync(path.join(root, "evidence", "v2"), { recursive: true }); fs.writeFileSync(path.join(root, "evidence", "v2", "isolation-live.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ status: report.status, checkCount: report.checkCount, pinnedReadBlock: report.pinnedReadBlock, v1Transactions: finalV1.transactions.length, v2Transactions: finalV2.transactions.length, v2Phase: Number(v2Market.phase), v2ReserveUnits: v2Market.reserve.toString(), failures: checks.filter(c => c.status === "FAIL") }, null, 2));
if (report.status !== "PASS") process.exitCode = 1;
