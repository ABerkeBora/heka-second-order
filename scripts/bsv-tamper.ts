import fs from "node:fs";
import { encodePacked, keccak256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { client, artifact } from "../src/chain.ts";
import { signed, requestFor, proofArgs } from "../src/source.ts";
import { withStore, evidence } from "../src/store.ts";
await withStore("bsv", async () => {
  const j = JSON.parse(fs.readFileSync(".runtime/bsv/intent.json", "utf8"));
  const address = j.approvalAddress,
    abi = artifact("BSVBasketApproval").abi;
  if (!address) throw Error("No BSV sidecar deployed");
  const fresh = await signed(requestFor(j.proposal.marketIds[0]));
  const other = await signed(requestFor(j.proposal.marketIds[1]));
  const stale = j.proposal.sources[0].createEnvelope;
  if (Date.now() / 1000 - Number(stale.timestamp) <= 300)
    throw Error("Genuine unchanged stale proof not yet old enough");
  const edited = {
    ...fresh,
    data: JSON.stringify({
      ...JSON.parse(fresh.data),
      closed: !JSON.parse(fresh.data).closed,
    }),
  };
  const wrong = {
    ...fresh,
    signature: await privateKeyToAccount(
      ("0x" + "11".repeat(32)) as `0x${string}`,
    ).signMessage({
      message: {
        raw: keccak256(
          encodePacked(
            ["bytes32", "uint256", "bytes"],
            [
              fresh.requestHash as `0x${string}`,
              BigInt(fresh.timestamp),
              toHex(fresh.data),
            ],
          ),
        ),
      },
    }),
  };
  const state = async () => ({
    initialized: await client.readContract({
      address,
      abi,
      functionName: "initialized",
    }),
    finalA: await client.readContract({
      address,
      abi,
      functionName: "finalSource",
      args: [0n],
    }),
    finalB: await client.readContract({
      address,
      abi,
      functionName: "finalSource",
      args: [1n],
    }),
    settled: await client.readContract({
      address,
      abi,
      functionName: "settled",
    }),
  });
  const before = await state();
  await client.readContract({
    address,
    abi,
    functionName: "verifyProof",
    args: [0, proofArgs(fresh), false],
  });
  const cases = [];
  for (const [name, envelope, expected] of [
    ["edited", edited, "NotSignedByAirnode"],
    ["stale", stale, "ResponseTooOld"],
    ["wrong-request", other, "NotSignedByAirnode"],
    ["wrong-signer", wrong, "NotSignedByAirnode"],
  ] as const) {
    try {
      await client.readContract({
        address,
        abi,
        functionName: "verifyProof",
        args: [0, proofArgs(envelope), false],
      });
      throw Error(`${name} unexpectedly accepted`);
    } catch (e: any) {
      if (!String(e.message).includes(expected)) throw e;
      cases.push({ name, expectedError: expected, status: "PASS", envelope });
    }
  }
  const after = await state();
  if (JSON.stringify(before) !== JSON.stringify(after))
    throw Error("Approval state changed during read-only tests");
  const report = {
    checkedAt: new Date().toISOString(),
    status: "PASS",
    network: "Base Sepolia",
    contract: address,
    method: "Deployed verifyProof eth_call; no BSV/ETH broadcast",
    validCase: { status: "PASS", response: fresh },
    cases,
    before,
    after,
    approvalStateUnchanged: true,
    broadcastTransactions: false,
    trust:
      "Original API3 EVM verification. Not native BSV verification and not independent signer custody.",
  };
  evidence("tamper-live.json", report);
  console.log(
    JSON.stringify({
      status: report.status,
      contract: address,
      cases: cases.map(({ envelope, ...r }) => r),
      broadcastTransactions: false,
    }),
  );
});
