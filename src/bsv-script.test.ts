import test from "node:test";
import assert from "node:assert/strict";
import {
  PrivateKey,
  ProtoWallet,
  Transaction,
  type WalletInterface,
} from "@bsv/sdk";
import {
  BSV_PROTOCOL,
  walletSignature,
  vaultScript,
  payoutScript,
  privateSignature,
  unlock,
  verifyInput,
  assertOutputs,
  assertTestnet,
  amount,
  digest,
} from "./bsv-script.ts";
const a = PrivateKey.fromHex("11".repeat(32)),
  b = PrivateKey.fromHex("22".repeat(32)),
  c = PrivateKey.fromHex("33".repeat(32)),
  wrong = PrivateKey.fromHex("44".repeat(32));
function scenario() {
  const manifest = digest({
    test: true,
    claim: "Local synthetic test, not live qualification",
  });
  const source = new Transaction();
  source.addOutput({
    lockingScript: vaultScript(
      a.toPublicKey().toString(),
      b.toPublicKey().toString(),
      c.toPublicKey().toString(),
      manifest,
    ),
    satoshis: 10000,
  });
  const tx = new Transaction();
  tx.addInput({
    sourceTransaction: source,
    sourceTXID: source.id("hex"),
    sourceOutputIndex: 0,
    sequence: 0xffffffff,
  });
  tx.addOutput({
    lockingScript: payoutScript(b.toPublicKey().toString()),
    satoshis: 9000,
  });
  return tx;
}
function signed(key = b) {
  const tx = scenario();
  tx.inputs[0].unlockingScript = unlock(
    privateSignature(tx, 0, key),
    privateSignature(tx, 0, a),
  );
  return tx;
}
test("mandatory attestor and buyer signatures unlock actual compiled Script interpreter", () =>
  assert.equal(verifyInput(signed(), 0), true));
test("counterparty can co-sign so loser participation is not needed", () =>
  assert.equal(verifyInput(signed(c), 0), true));
test("attestor plus a nonparticipant cannot unlock collateral", () =>
  assert.throws(() => verifyInput(signed(wrong), 0)));
test("participant alone cannot impersonate attestor", () => {
  const tx = scenario();
  tx.inputs[0].unlockingScript = unlock(
    privateSignature(tx, 0, b),
    privateSignature(tx, 0, c),
  );
  assert.throws(() => verifyInput(tx, 0));
});
test("SIGHASH_ALL blocks edited payout amount", () => {
  const tx = signed();
  tx.outputs[0].satoshis = 8000;
  assert.throws(() => verifyInput(tx, 0));
});
test("SIGHASH_ALL blocks redirected beneficiary", () => {
  const tx = signed();
  tx.outputs[0].lockingScript = payoutScript(wrong.toPublicKey().toString());
  assert.throws(() => verifyInput(tx, 0));
});
test("SIGHASH_ALL blocks an added drain output", () => {
  const tx = signed();
  tx.addOutput({
    lockingScript: payoutScript(wrong.toPublicKey().toString()),
    satoshis: 1,
  });
  assert.throws(() => verifyInput(tx, 0));
});
test("SIGHASH_ALL blocks different outpoint and replay to another pool", () => {
  const tx = signed();
  tx.inputs[0].sourceOutputIndex = 1;
  assert.throws(() => verifyInput(tx, 0));
});
test("fixed-output attestor guard rejects fee or output changes", () => {
  const tx = signed();
  assertOutputs(tx, [
    { script: tx.outputs[0].lockingScript.toHex(), satoshis: 9000 },
  ]);
  assert.throws(() =>
    assertOutputs(tx, [
      { script: tx.outputs[0].lockingScript.toHex(), satoshis: 9001 },
    ]),
  );
  tx.outputs[0].satoshis = 8999;
  assert.throws(() =>
    assertOutputs(tx, [
      { script: tx.outputs[0].lockingScript.toHex(), satoshis: 8999 },
    ]),
  );
});
test("refund lockTime and sequence are part of signatures, not CLTV", () => {
  const tx = scenario();
  tx.lockTime = 1793430000;
  tx.inputs[0].sequence = 0xfffffffe;
  tx.inputs[0].unlockingScript = unlock(
    privateSignature(tx, 0, b),
    privateSignature(tx, 0, a),
  );
  assert.equal(verifyInput(tx, 0), true);
  tx.lockTime = 0;
  assert.throws(() => verifyInput(tx, 0));
});
test("manifest commitment prevents substitution of pool terms", () => {
  const first = vaultScript(
    a.toPublicKey().toString(),
    b.toPublicKey().toString(),
    c.toPublicKey().toString(),
    digest({ side: "YES" }),
  );
  const second = vaultScript(
    a.toPublicKey().toString(),
    b.toPublicKey().toString(),
    c.toPublicKey().toString(),
    digest({ side: "NO" }),
  );
  assert.notEqual(first.toHex(), second.toHex());
});
test("only testnet and capped integer satoshis are accepted", () => {
  assertTestnet("testnet");
  assert.throws(() => assertTestnet("mainnet"));
  assert.throws(() => assertTestnet("teratestnet"));
  assert.equal(amount(5000), 5000);
  for (const n of [NaN, 1.2, -1, 10001, "5000"]) assert.throws(() => amount(n));
});
test("BRC100 derived-key signature validates the full custom input without identity-key signing", async () => {
  const wallet = new ProtoWallet(b),
    keyID = "fixture derived input";
  const pub = (
    await wallet.getPublicKey({
      protocolID: BSV_PROTOCOL,
      keyID,
      counterparty: "anyone",
      forSelf: true,
    })
  ).publicKey;
  assert.notEqual(pub, b.toPublicKey().toString());
  const source = new Transaction();
  source.addOutput({
    lockingScript: vaultScript(
      a.toPublicKey().toString(),
      pub,
      c.toPublicKey().toString(),
      digest({ test: "derived-key fixture" }),
    ),
    satoshis: 10000,
  });
  const tx = new Transaction();
  tx.addInput({
    sourceTransaction: source,
    sourceTXID: source.id("hex"),
    sourceOutputIndex: 0,
  });
  tx.addOutput({ lockingScript: payoutScript(pub), satoshis: 9000 });
  tx.inputs[0].unlockingScript = unlock(
    await walletSignature(wallet as WalletInterface, tx, 0, keyID),
    privateSignature(tx, 0, a),
  );
  assert.equal(verifyInput(tx, 0), true);
});
