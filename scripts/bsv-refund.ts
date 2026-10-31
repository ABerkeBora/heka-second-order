import fs from "node:fs";
import { createRequire } from "node:module";
import { Transaction } from "@bsv/sdk";
import { verifyInput } from "../src/bsv-script.ts";
const file = process.argv[2];
if (!file)
  throw Error(
    "Download /api/bsv/refund/buyer and provide its JSON path. This only broadcasts an already signed testnet refund.",
  );
const r = JSON.parse(fs.readFileSync(file, "utf8"));
if (r.network !== "testnet" || !r.atomicBeef || r.feeSatoshis !== 1000)
  throw Error("Unexpected refund scope");
const tx = Transaction.fromAtomicBEEF(r.atomicBeef);
if (
  tx.id("hex") !== r.refundTxid ||
  tx.inputs.length !== 1 ||
  tx.outputs.length !== 1 ||
  tx.inputs[0].sourceTXID !== r.fundingTxid ||
  tx.lockTime !== r.earliestTime ||
  tx.inputs[0].sequence !== 0xfffffffe ||
  tx.toHex() !== r.rawTransaction
)
  throw Error("Refund binding mismatch");
if (Math.floor(Date.now() / 1000) <= tx.lockTime)
  throw Error("Refund deadline has not passed; nothing broadcast");
if (!verifyInput(tx, 0)) throw Error("Refund signatures invalid");
const fee =
  tx.inputs[0].sourceTransaction!.outputs[tx.inputs[0].sourceOutputIndex]
    .satoshis! - tx.outputs[0].satoshis!;
if (fee !== 1000) throw Error("Refund fee changed");
const { Arcade } = createRequire(import.meta.url)(
  "@bsv/wallet-toolbox/out/src/services/providers/Arcade",
);
const receipt = await new Arcade(
  "https://arcade-v2-testnet-us-1.bsvblockchain.tech",
).postRawTx(tx.toHexEF(), [tx.id("hex")]);
console.log(
  JSON.stringify({
    network: "testnet",
    txid: tx.id("hex"),
    status: receipt.status,
    networkStatus: receipt.data,
    satoshis: tx.outputs[0].satoshis,
    feeSatoshis: fee,
  }),
);
