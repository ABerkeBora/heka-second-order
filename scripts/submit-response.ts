// Submit unchanged envelope bytes to the fixed market; off-chain signer checks are intentionally skipped.
// Stop the app first: one executor process owns its private transaction journal.
import fs from "node:fs";
import {
  acquireExecutor,
  address,
  write,
  marketAbi,
  client,
} from "../src/chain.ts";
import { proofArgs } from "../src/source.ts";
import { state } from "../src/store.ts";
const [file, component = "0", action = "settlement"] = process.argv.slice(2);
if (!file)
  throw Error(
    "Usage: node --env-file=.env scripts/submit-response.ts response.json [0|1] [settlement|validate-open|claim|refund]",
  );
const envelope = ["claim", "refund"].includes(action)
  ? null
  : JSON.parse(fs.readFileSync(file, "utf8"));
const response = envelope?.response || envelope;
const market =
  process.env.MARKET_ADDRESS ||
  state.intents[0]?.contractAddress ||
  state.proposal?.contractAddress;
if (!market) throw Error("Set MARKET_ADDRESS");
const index = Number(component);
if (![0, 1].includes(index)) throw Error("Component must be 0 or 1");
const abi = marketAbi();
if (action === "validate-open") {
  const updated = await client.readContract({
    address: market,
    abi,
    functionName: "validateOpenProof",
    args: [index, proofArgs(response)],
  });
  console.log({ accepted: true, sourceUpdatedAt: String(updated) });
} else {
  acquireExecutor();
  let functionName = "submitEvidence";
  let args: any[] = [];
  if (action === "claim") {
    functionName = "claim";
    args = [address("buyer")];
  } else if (action === "refund") {
    functionName = "voidExpired";
    args = [];
  } else if (action === "settlement") args = [index, proofArgs(response)];
  else throw Error("Unknown action");
  const r = await write(
    `judge:${crypto.randomUUID()}`,
    "deployer",
    market,
    abi,
    functionName,
    args,
  );
  console.log({
    transactionHash: r.transactionHash,
    status: r.status,
    explorer: `https://sepolia.basescan.org/tx/${r.transactionHash}`,
  });
}
