/** Read-only V2 policy/code verification. Writes only its scoped public evidence report. */
import fs from "node:fs";
import { keccak256, toHex, parseAbi, type Address, type Hex } from "viem";
import { withStore, state, evidence, storeNamespace } from "../src/store.ts";
import { client, artifact, marketAbi } from "../src/chain.ts";
import { AIRNODE, requestFor, outcomeHash } from "../src/source.ts";
import { deriveRequestHash } from "../src/vendor/airnode-v2.ts";
import { parseIntent, equalIntent, matchIntent } from "../src/intent.ts";

await withStore("next", async () => {
  const p = state.proposal;
  if (!p?.ready || !p.contractAddress || !p.policy)
    throw Error("No initialized V2 market exists; compose and initialize it first.");
  if ((await client.getChainId()) !== 84532)
    throw Error("Only Base Sepolia84532 may be verified.");
  const contract = p.contractAddress as Address;
  const abi = marketAbi();
  const checks: { name: string; status: "PASS" | "FAIL"; expected: any; actual: any }[] = [];
  const normalize = (v: any): any =>
    typeof v === "bigint" ? v.toString() : Array.isArray(v) ? v.map(normalize) :
      v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, normalize(x)])) : v;
  function check(name: string, expected: any, actual: any) {
    const e = normalize(expected), a = normalize(actual);
    const same = typeof e === "string" && typeof a === "string" && /^0x[0-9a-f]+$/i.test(e) && /^0x[0-9a-f]+$/i.test(a)
      ? e.toLowerCase() === a.toLowerCase() : JSON.stringify(e) === JSON.stringify(a);
    checks.push({ name, status: same ? "PASS" : "FAIL", expected: e, actual: a });
  }
  const read = (functionName: string, args: readonly unknown[] = []) =>
    client.readContract({ address: contract, abi, functionName, args });
  check("Active namespace", "next", storeNamespace());
  const policy = await read("policy") as any;
  check("Collateral is this namespace's token", state.deployment?.tokenAddress, await read("collateral"));
  for (const field of ["operatorIsOr", "tradeClosesAt", "deadline", "maxEnvelopeAge", "maxSourceAge"])
    check(`Immutable policy.${field}`, p.policy[field], policy[field]);
  check("Operator matches normalized intent", p.normalizedIntent.operator === "OR", policy.operatorIsOr);
  check("Source count", 2, policy.sources.length);
  for (let i = 0; i < 2; i++) {
    const expected = p.policy.sources[i], actual = policy.sources[i];
    for (const field of ["marketId", "conditionId", "outcomesHash", "createRequestHash", "settlementRequestHash", "signer", "selectedOutcome", "endTime"])
      check(`Source${i}.${field}`, expected[field], actual[field]);
    check(`Source${i}.proposalId`, p.marketIds[i], actual.marketId);
    check(`Source${i}.selectedIndex`, p.selectedOutcomeIndexes[i], actual.selectedOutcome);
    check(`Source${i}.trustedSigner`, AIRNODE, actual.signer);
    check(`Source${i}.independentCreateRequestHash`, deriveRequestHash(requestFor(actual.marketId)), actual.createRequestHash);
    check(`Source${i}.independentSettlementRequestHash`, deriveRequestHash(requestFor(actual.marketId, true)), actual.settlementRequestHash);
    const source = p.sourceMarkets.find((m: any) => m.id === actual.marketId);
    check(`Source${i}.recordCondition`, source.conditionId, actual.conditionId);
    check(`Source${i}.semanticOutcomeHash`, outcomeHash(source.outcomes), actual.outcomesHash);
    check(`Source${i}.absoluteEndTime`, String(Math.floor(Date.parse(source.endDate) / 1000)), actual.endTime);
  }
  check("Distinct source IDs", true, policy.sources[0].marketId !== policy.sources[1].marketId);
  check("Distinct source conditions", true, policy.sources[0].conditionId.toLowerCase() !== policy.sources[1].conditionId.toLowerCase());
  const recordedReview = p.intentReview;
  check("Captured review accepted", "accepted", recordedReview?.status);
  check("Captured review binds proposal", p.id, recordedReview?.proposalId);
  const parsed = parseIntent(recordedReview?.objective);
  check("Captured objective supported", "supported", parsed.status);
  if (parsed.status === "supported") {
    check("Model normalization equals independent objective", true, equalIntent(parsed.intent, p.normalizedIntent));
    // Reconstruct the decision at its recorded time; a finished window is not represented as upcoming today.
    const decisionTime = Date.parse(recordedReview.decidedAt || recordedReview.createdAt);
    const result = matchIntent(parsed.intent, p, p.sourceMarkets, decisionTime);
    check("Recorded assets/event/directions/window match at decision", "matched", result.status);
  }
  const receipt = await client.getTransactionReceipt({ hash: p.deploymentTx });
  check("Deployment receipt success", "success", receipt.status);
  check("Deployment receipt contract", contract, receipt.contractAddress);
  const block = await client.getBlock({ blockNumber: receipt.blockNumber });
  check("Immutable createdAt equals deployment block", block.timestamp, await read("createdAt"));
  const initialization = await client.getTransactionReceipt({ hash: p.initializationTx });
  check("Initialization receipt success", "success", initialization.status);
  function maskImmutables(code: Hex, references: Record<string, { start: number; length: number }[]> = {}): Hex {
    let result = code.slice(2);
    for (const ref of Object.values(references).flat())
      result = result.slice(0, ref.start * 2) + "0".repeat(ref.length * 2) + result.slice((ref.start + ref.length) * 2);
    return `0x${result}`;
  }
  const marketArtifact = artifact("SecondOrderMarket");
  const actualCode = await client.getBytecode({ address: contract });
  if (!actualCode) throw Error("No bytecode at the recorded V2 contract");
  check("Deployed market code matches compiled artifact, immutable ranges masked",
    keccak256(maskImmutables(marketArtifact.deployedBytecode.object, marketArtifact.deployedBytecode.immutableReferences)),
    keccak256(maskImmutables(actualCode, marketArtifact.deployedBytecode.immutableReferences)));
  const token = state.deployment!.tokenAddress as Address;
  const tokenCode = await client.getBytecode({ address: token });
  const tokenArtifact = artifact("TestCollateral");
  check("Collateral bytecode matches compiled TestCollateral", keccak256(tokenArtifact.deployedBytecode.object), tokenCode ? keccak256(tokenCode) : null);
  const tokenAbi = parseAbi(["function decimals() view returns(uint8)", "function symbol() view returns(string)"]);
  check("SOU decimals", 6, await client.readContract({ address: token, abi: tokenAbi, functionName: "decimals" }));
  check("SOU symbol", "SOU", await client.readContract({ address: token, abi: tokenAbi, functionName: "symbol" }));
  const observedState = normalize(await read("marketState"));
  const report = { status: checks.every(c => c.status === "PASS") ? "PASS" : "FAIL", checkedAt: new Date().toISOString(),
    mode: "Read-only public RPC contract/policy verification; no key access or transaction submission", namespace: storeNamespace(),
    chainId: 84532, contract, token, proposalId: p.id, reviewId: recordedReview?.id,
    deploymentTransaction: p.deploymentTx, initializationTransaction: p.initializationTx,
    contractExplorer: `https://sepolia.basescan.org/address/${contract}`, checkCount: checks.length, checks, observedState,
    limits: ["Code/policy equality does not prove upstream truth or profitable outcomes.", "Observed market state is recorded without claiming an uncompleted settlement or payout.", "Objective matching is reconstructed at the saved review time, not asserted as a new future position."] };
  evidence("contract-verification.json", report);
  console.log(JSON.stringify({ status: report.status, namespace: report.namespace, contract, checkCount: report.checkCount, failures: checks.filter(c => c.status === "FAIL") }, null, 2));
  if (report.status !== "PASS") process.exitCode = 1;
});
