import {
  BigNumber,
  ECDSA,
  Hash,
  LockingScript,
  OP,
  P2PKH,
  PrivateKey,
  PublicKey,
  Signature,
  Spend,
  Transaction,
  TransactionSignature,
  UnlockingScript,
  Utils,
  type WalletInterface,
} from "@bsv/sdk";

export const BSV_PROTOCOL: [1, string] = [1, "second order bsv"];
export const SCOPE =
  TransactionSignature.SIGHASH_ALL | TransactionSignature.SIGHASH_FORKID;
export const MAX_STAKE = 10000,
  MAX_FEE = 1000;
export function digest(value: unknown) {
  return Utils.toHex(Hash.sha256(Utils.toArray(JSON.stringify(value), "utf8")));
}
export function assertTestnet(network: string) {
  if (network !== "testnet")
    throw Error(
      "Only BSV testnet is authorized. No mainnet action was signed.",
    );
}
export function amount(value: unknown, min = 1, max = MAX_STAKE) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  )
    throw Error("Integer satoshi amount exceeds the mandate");
  return value;
}
export function vaultScript(
  attestor: string,
  buyer: string,
  counterparty: string,
  manifestHash: string,
) {
  const keys = [attestor, buyer, counterparty];
  if (new Set(keys).size !== 3)
    throw Error("Three distinct role keys required");
  keys.forEach((k) => PublicKey.fromString(k));
  if (!/^[0-9a-f]{64}$/.test(manifestHash))
    throw Error("Invalid manifest hash");
  // Script enforces mandatory attestor + one participant; oracle truth remains an attestor trust assumption.
  return new LockingScript()
    .writeOpCode(OP.OP_FALSE)
    .writeOpCode(OP.OP_IF)
    .writeBin(Utils.toArray(manifestHash, "hex"))
    .writeOpCode(OP.OP_ENDIF)
    .writeBin(Utils.toArray(attestor, "hex"))
    .writeOpCode(OP.OP_CHECKSIGVERIFY)
    .writeOpCode(OP.OP_1)
    .writeBin(Utils.toArray(buyer, "hex"))
    .writeBin(Utils.toArray(counterparty, "hex"))
    .writeOpCode(OP.OP_2)
    .writeOpCode(OP.OP_CHECKMULTISIG);
}
export function payoutScript(key: string) {
  return new P2PKH().lock(PublicKey.fromString(key).toAddress());
}
export function signingHash(tx: Transaction, index: number) {
  const input = tx.inputs[index],
    source = input.sourceTransaction?.outputs[input.sourceOutputIndex];
  if (!source || source.satoshis === undefined)
    throw Error("Full source transaction required");
  return Hash.hash256(
    TransactionSignature.format({
      sourceTXID: input.sourceTXID || input.sourceTransaction!.id("hex"),
      sourceOutputIndex: input.sourceOutputIndex,
      sourceSatoshis: source.satoshis,
      transactionVersion: tx.version,
      otherInputs: tx.inputs.filter((_, i) => i !== index),
      inputIndex: index,
      outputs: tx.outputs,
      inputSequence: input.sequence ?? 0xffffffff,
      subscript: source.lockingScript,
      lockTime: tx.lockTime,
      scope: SCOPE,
    }),
  );
}
export function privateSignature(
  tx: Transaction,
  index: number,
  key: PrivateKey,
) {
  const s = ECDSA.sign(new BigNumber(signingHash(tx, index)), key, true);
  return new TransactionSignature(s.r, s.s, SCOPE).toChecksigFormat();
}
export async function walletSignature(
  wallet: WalletInterface,
  tx: Transaction,
  index: number,
  keyID: string,
) {
  const { signature } = await wallet.createSignature({
    hashToDirectlySign: signingHash(tx, index),
    protocolID: BSV_PROTOCOL,
    keyID,
    counterparty: "anyone",
  });
  const s = Signature.fromDER(signature);
  return new TransactionSignature(s.r, s.s, SCOPE).toChecksigFormat();
}
export function unlock(participantSig: number[], attestorSig: number[]) {
  return new UnlockingScript()
    .writeOpCode(OP.OP_0)
    .writeBin(participantSig)
    .writeBin(attestorSig);
}
export function verifyInput(tx: Transaction, index: number) {
  const input = tx.inputs[index],
    s = input.sourceTransaction!.outputs[input.sourceOutputIndex];
  return new Spend({
    sourceTXID: input.sourceTXID || input.sourceTransaction!.id("hex"),
    sourceOutputIndex: input.sourceOutputIndex,
    sourceSatoshis: s.satoshis!,
    lockingScript: s.lockingScript,
    transactionVersion: tx.version,
    otherInputs: tx.inputs.filter((_, i) => i !== index),
    outputs: tx.outputs,
    inputIndex: index,
    unlockingScript: input.unlockingScript!,
    inputSequence: input.sequence ?? 0xffffffff,
    lockTime: tx.lockTime,
  }).validate();
}
export function assertOutputs(
  tx: Transaction,
  expected: { script: string; satoshis: number }[],
  feeCap = MAX_FEE,
) {
  if (tx.outputs.length !== expected.length)
    throw Error("Unexpected payout/change output");
  expected.forEach((e, i) => {
    if (
      tx.outputs[i].lockingScript.toHex() !== e.script ||
      tx.outputs[i].satoshis !== e.satoshis
    )
      throw Error("Output recipient or amount changed");
  });
  const ins = tx.inputs.reduce(
      (s, i) =>
        s + (i.sourceTransaction?.outputs[i.sourceOutputIndex].satoshis ?? 0),
      0,
    ),
    outs = tx.outputs.reduce((s, o) => s + (o.satoshis ?? 0), 0);
  if (ins - outs < 0 || ins - outs > feeCap) throw Error("Fee exceeds mandate");
}
export function verifyMandateSignature(
  manifest: unknown,
  signature: string,
  key: string,
) {
  return ECDSA.verify(
    new BigNumber(
      Hash.hash256(Utils.toArray(JSON.stringify(manifest), "utf8")),
    ),
    Signature.fromDER(Utils.toArray(signature, "hex")),
    PublicKey.fromString(key),
  );
}
