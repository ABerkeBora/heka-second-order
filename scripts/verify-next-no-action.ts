// Read actual local API and Base Sepolia state around unsupported goals. Never sends a chain transaction.
import fs from "node:fs";
import assert from "node:assert/strict";
import { client, address, TOKEN_ABI } from "../src/chain.ts";
const base = "http://localhost:3101";
async function snapshot() {
  const [v1, v2] = await Promise.all([
    fetch(`${base}/api/state`).then((r) => r.json()),
    fetch(`${base}/api/next/state`).then((r) => r.json()),
  ]);
  const balances = [];
  for (const role of ["deployer", "buyer", "counterparty"]) {
    const who = address(role);
    balances.push({
      role,
      address: who,
      nativeWei: String(await client.getBalance({ address: who })),
      v1CollateralUnits: v1.deployment?.tokenAddress
        ? String(
            await client.readContract({
              address: v1.deployment.tokenAddress,
              abi: TOKEN_ABI,
              functionName: "balanceOf",
              args: [who],
            }),
          )
        : null,
      v2CollateralUnits: v2.deployment?.tokenAddress
        ? String(
            await client.readContract({
              address: v2.deployment.tokenAddress,
              abi: TOKEN_ABI,
              functionName: "balanceOf",
              args: [who],
            }),
          )
        : null,
    });
  }
  return {
    v1TransactionHashes: v1.transactions.map((t: any) => t.hash),
    v1Positions: v1.intents,
    v1Token: v1.deployment?.tokenAddress || null,
    v2TransactionHashes: v2.transactions.map((t: any) => t.hash),
    v2Positions: v2.intents,
    v2Token: v2.deployment?.tokenAddress || null,
    balances,
  };
}
const cases = [];
for (const [name, objective] of [
  [
    "unsupported whole-week condition",
    "Ethereum Up OR Solana Up throughout the entire week.",
  ],
  [
    "event absent from actual discovered catalog",
    "Cardano Up OR Ethereum Up in the same next 5-minute window.",
  ],
]) {
  const before = await snapshot();
  assert.equal(
    before.v2TransactionHashes.length,
    0,
    "Run no-action evidence before the first accepted V2 deployment",
  );
  const response = await fetch(`${base}/api/next/propose`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ objective }),
  });
  assert.equal(response.status, 200);
  const review = await response.json();
  assert.equal(review.status, "unsupported/no-action");
  const after = await snapshot();
  assert.deepEqual(
    after,
    before,
    "Unsupported objective changed protected chain/position state",
  );
  const denied = await fetch(`${base}/api/next/authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      proposalId: "no-accepted-v2-proposal",
      reviewId: review.id,
      objective,
      side: "YES",
      stakeUnits: "1000000",
    }),
  });
  assert.equal(denied.status, 400);
  assert.deepEqual(await snapshot(), before);
  cases.push({
    name,
    objective,
    review,
    before,
    after,
    authorizationHttpStatus: denied.status,
    assertions: {
      rejectedBeforeAnyDeploymentMintApprovalOrFund: true,
      v1ReceiptsPositionsAndCollateralUnchanged: true,
      v2TransactionsPositionsAndCollateralUnchanged: true,
      nativeBalancesUnchanged: true,
      staleOrUnsupportedAuthorizationBlocked: true,
    },
  });
}
const record = {
  checkedAt: new Date().toISOString(),
  network: "Base Sepolia84532 read-only comparison around real HTTP requests",
  status: "PASS",
  cases,
};
fs.mkdirSync("evidence/v2", { recursive: true });
fs.writeFileSync(
  "evidence/v2/no-action-live.json",
  JSON.stringify(record, null, 2) + "\n",
);
console.log({
  status: record.status,
  cases: cases.map((c) => ({
    name: c.name,
    reason: c.review.reasons,
    model: c.review.model?.name || "deterministic checks rejected before model",
  })),
});
