import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import express from "express";
import {
  Hash,
  LockingScript,
  Transaction,
  TransactionSignature,
  UnlockingScript,
  Utils,
} from "@bsv/sdk";
import {
  encodePacked,
  hashMessage,
  keccak256,
  recoverPublicKey,
  toHex,
} from "viem";
import { root, withStore, exclusive, evidence, cleanError } from "./store.ts";
import { buyerWallet, counterparty, buildBSVProposal } from "./bsv.ts";
import {
  BSV_PROTOCOL,
  assertTestnet,
  payoutScript,
  walletSignature,
  verifyInput,
  digest,
  verifyMandateSignature,
} from "./bsv-script.ts";
import { signed, createProof } from "./source.ts";
const require = createRequire(import.meta.url);
const {
  createPolymarketOutcome,
  requestFor,
  hashRequest,
} = require("../native/pm-followon/consumer-helper.cjs");
const {
  Arcade,
} = require("@bsv/wallet-toolbox/out/src/services/providers/Arcade");
const dir = path.join(root, ".runtime/bsv-native");
const now = () => Math.floor(Date.now() / 1000);
const json = (v: any) =>
  JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x), 2);
export function nativeRead(name: string) {
  const p = path.join(dir, name);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : undefined;
}
function put(name: string, v: any) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(dir, name + ".tmp"), json(v), { mode: 0o600 });
  fs.renameSync(path.join(dir, name + ".tmp"), path.join(dir, name));
}
const timing =
  "Fixed source/signature observation window; source may lead signature by 30s, signature may lag source by 900s. No current-chain-time freshness or absolute settlement expiry. After refund maturity, first valid settlement/refund wins.";
function publicJob(j: any) {
  if (!j) return null;
  const { buyerSource, cpSource, sponsorSource, fundingPlan, policy, ...safe } =
    j;
  return {
    ...safe,
    policy,
    buyerSource: buyerSource
      ? {
          txid: buyerSource.txid,
          vout: buyerSource.vout,
          satoshis: 5000,
          fee: buyerSource.fee,
          accepted: buyerSource.accepted,
        }
      : null,
    cpSource: cpSource
      ? { txid: cpSource.txid, vout: cpSource.vout, satoshis: 9000 }
      : null,
    sponsorSource: sponsorSource
      ? { txid: sponsorSource.txid, vout: sponsorSource.vout, satoshis: 26000 }
      : null,
  };
}
function save(j: any) {
  j.updatedAt = new Date().toISOString();
  put("intent.json", j);
  evidence("intent.json", publicJob(j));
  evidence(`intent-${j.id}.json`, publicJob(j));
}
function step(j: any, action: string, message: string, txid?: string) {
  j.steps ??= [];
  j.steps.push({
    at: new Date().toISOString(),
    action,
    message,
    ...(txid ? { txid } : {}),
  });
  save(j);
}
export function nativeState() {
  return {
    route: "/bsv/native",
    network: "BSV testnet",
    mode: "Native original API3 signatures + fixed-output Bitcoin Script",
    timing,
    proposal: nativeRead("proposal.json") || null,
    intent: publicJob(nativeRead("intent.json")),
    wallet: nativeRead("wallet.json") || null,
    limits: {
      stakeSatoshis: 5000,
      poolSatoshis: 10000,
      initialBuyerFeeCap: 1000,
      fundingFeeSatoshis: 13000,
      settlementFeeCap: 1000,
      dataFeeSatoshis: 0,
    },
    resourceGate: nativeRead("resource-gate.json") || {
      status: "BLOCKED",
      reason:
        "Real 5 MB native claim rejected by public nodes: Operation limit exceeded / too-long-validation-time. This 12 MB two-source guard has no successful public-network payout evidence. Do not lock a new pool.",
    },
    qualification: {
      nativeScript:
        "Compiled consumer 12/12 + SDK interoperability PASS; deployed proof shown separately",
      network: nativeRead("intent.json")?.funding?.accepted
        ? "PASS"
        : "PENDING",
      originalSignatureSettlement:
        nativeRead("intent.json")?.status === "Paid" ? "PASS" : "PENDING",
    },
    updatedAt: new Date().toISOString(),
  };
}
export async function nativeConnect() {
  assertTestnet((await buyerWallet.getNetwork({})).network);
  if (!(await buyerWallet.isAuthenticated({})).authenticated)
    throw Error("Unlock standard BSV Desktop testnet wallet");
  const s = {
    network: "testnet",
    identity: (await buyerWallet.getPublicKey({ identityKey: true })).publicKey,
    balance:
      "Private; wallet performs coin selection without default-basket access",
    checkedAt: new Date().toISOString(),
  };
  put("wallet.json", s);
  return s;
}
export async function nativeCompose(objective: string) {
  const prior = nativeRead("intent.json");
  if (
    prior &&
    prior.status !== "Preview; node execution blocked" &&
    !["Paid", "Refunded"].includes(prior.status)
  )
    throw Error("Existing native mandate is frozen; reconcile it first");
  const p = await buildBSVProposal(objective, true);
  p.observationDeadline =
    Math.max(...p.sources.map((s: any) => Date.parse(s.endDate) / 1000)) + 1200;
  p.refundAfter = p.observationDeadline + 600;
  put("proposal.json", p);
  evidence("proposal.json", p);
  return p;
}
let guardCache: { hash: string; guard: any } | undefined;
export function nativeGuard(policy: any) {
  const hash = digest(policy);
  if (guardCache?.hash === hash) return guardCache.guard;
  const guard = createPolymarketOutcome(policy);
  guardCache = { hash, guard };
  return guard;
}
function sourceTx(source: any) {
  const tx = Transaction.fromAtomicBEEF(source.beef || source.sourceBeef);
  if (tx.id("hex") !== source.txid) throw Error("Saved source txid mismatch");
  return tx;
}
function sourceFee(tx: Transaction) {
  return (
    tx.inputs.reduce(
      (n, i) =>
        n + (i.sourceTransaction?.outputs[i.sourceOutputIndex].satoshis ?? NaN),
      0,
    ) - tx.outputs.reduce((n, o) => n + (o.satoshis ?? NaN), 0)
  );
}
async function reconcile(tx: Transaction) {
  const txid = tx.id("hex");
  const r = await fetch(
    `https://api.whatsonchain.com/v1/bsv/test/tx/${txid}/hex`,
    { signal: AbortSignal.timeout(15000) },
  );
  if (r.ok) {
    const raw = (await r.text()).replace(/^"|"$/g, "").trim();
    if (raw === tx.toHex())
      return {
        accepted: true,
        source: "WhatsOnChain exact raw transaction",
        checkedAt: new Date().toISOString(),
      };
  }
  const a = await fetch(
    `https://arcade-v2-testnet-us-1.bsvblockchain.tech/tx/${txid}`,
    { signal: AbortSignal.timeout(10000) },
  );
  if (a.ok) {
    const v: any = await a.json();
    if (
      v.txid === txid &&
      [
        "ACCEPTED_BY_NETWORK",
        "SEEN_ON_NETWORK",
        "SEEN_MULTIPLE_NODES",
        "MINED",
        "IMMUTABLE",
      ].includes(v.txStatus)
    )
      return {
        accepted: true,
        source: "Arcade network status",
        status: v.txStatus,
        checkedAt: new Date().toISOString(),
      };
  }
  return { accepted: false, checkedAt: new Date().toISOString() };
}
async function publishSmall(tx: Transaction, entry: any, j: any) {
  if (entry.accepted) return;
  entry.txid = tx.id("hex");
  if (!entry.broadcastStarted) {
    entry.broadcastStarted = new Date().toISOString();
    save(j);
    entry.response = await new Arcade(
      "https://arcade-v2-testnet-us-1.bsvblockchain.tech",
    ).postRawTx(tx.toHexEF(), [tx.id("hex")]);
    save(j);
  }
  const r = await reconcile(tx);
  entry.accepted = r.accepted;
  entry.network = r;
  save(j);
  if (!r.accepted)
    throw Error(
      "Exact saved transaction awaits network reconciliation. No replacement or repeated charge.",
    );
}
async function p2pkhSign(
  tx: Transaction,
  index: number,
  w: any,
  keyID: string,
) {
  assertTestnet((await w.getNetwork({})).network);
  const signature = await walletSignature(w, tx, index, keyID);
  const pub = (
    await w.getPublicKey({
      protocolID: BSV_PROTOCOL,
      keyID,
      counterparty: "anyone",
      forSelf: true,
    })
  ).publicKey;
  tx.inputs[index].unlockingScript = new UnlockingScript()
    .writeBin(signature)
    .writeBin(Utils.toArray(pub, "hex"));
  if (!verifyInput(tx, index))
    throw Error("Full-output participant signature invalid");
}
export async function nativePrepare(input: any) {
  const preview = input.previewOnly === true;
  if (!preview) {
    const gate = nativeRead("resource-gate.json");
    if (gate?.status !== "PASS" || !gate?.acceptedNativeClaimTxid)
      throw Error(
        "Native public-node execution gate BLOCKED. No wallet action or funding is allowed until a real accepted native claim is independently evidenced.",
      );
  }
  await nativeConnect();
  let j = nativeRead("intent.json");
  if (
    j &&
    !["Paid", "Refunded", "Preview; node execution blocked"].includes(j.status)
  ) {
    if (j.proposal.id !== input.proposalId)
      throw Error("An existing frozen mandate cannot be substituted");
    return prepareFunding(j);
  }
  const p = nativeRead("proposal.json");
  if (
    !p ||
    p.id !== input.proposalId ||
    input.stakeSatoshis !== 5000 ||
    input.acceptFixedObservationWindow !== true
  )
    throw Error(
      "Explicit exact 5,000-test-sat mandate and fixed observation-window acceptance required",
    );
  if (now() >= p.tradeClosesAt - 60)
    throw Error("Not enough future time for new funding; no wallet action");
  const cp = await counterparty();
  assertTestnet((await cp.getNetwork({})).network);
  const oldFile = path.join(root, ".runtime/bsv/intent.json");
  const old = fs.existsSync(oldFile)
    ? JSON.parse(fs.readFileSync(oldFile, "utf8"))
    : null;
  const cpSource =
    nativeRead("counterparty-source.json") ||
    (old?.status === "Paid" &&
    old.payout?.winner === "counterparty" &&
    old.payout?.satoshis === 9000
      ? {
          txid: old.payout.txid,
          vout: 0,
          satoshis: 9000,
          beef: old.payout.beef,
          keyID: `${old.id} payout`,
          provenance:
            "Already-won counterparty cash from preserved attestor pilot; no old collateral/policy changed",
        }
      : null);
  if (!preview && !cpSource)
    throw Error(
      "Fund separate counterparty source with native bootstrap; no EVM prerequisite",
    );
  const sponsor = nativeRead("fee-sponsor-public.json");
  if (
    !preview &&
    (!sponsor ||
      sponsor.network !== "testnet" ||
      sponsor.satoshis !== 26000 ||
      sponsor.requiredReturnSatoshis !== 13000)
  )
    throw Error("Explicit bounded public testnet fee sponsor source missing");
  const id = crypto.randomUUID(),
    keyID = `native ${id} payout`;
  const buyerKey = (
    await buyerWallet.getPublicKey({
      protocolID: BSV_PROTOCOL,
      keyID,
      counterparty: "anyone",
      forSelf: true,
    })
  ).publicKey;
  const cpKey = (
    await cp.getPublicKey({
      protocolID: BSV_PROTOCOL,
      keyID,
      counterparty: "anyone",
      forSelf: true,
    })
  ).publicKey;
  const buyerScript = payoutScript(buyerKey).toHex(),
    cpScript = payoutScript(cpKey).toHex();
  const creation = [];
  for (const s of p.sources) {
    const proof = await createProof(s.id);
    if (
      proof.data.conditionId !== s.conditionId ||
      Date.parse(proof.data.endDate) !== Date.parse(s.endDate) ||
      JSON.stringify(JSON.parse(proof.data.outcomes)) !==
        JSON.stringify(s.outcomes)
    )
      throw Error("Source policy changed before mandate");
    creation.push(proof);
  }
  const e = creation[0].response,
    packed = keccak256(
      encodePacked(
        ["bytes32", "uint256", "bytes"],
        [e.requestHash, BigInt(e.timestamp), toHex(e.data)],
      ),
    );
  const airnodePublicKey = await recoverPublicKey({
    hash: hashMessage({ raw: packed }),
    signature: e.signature,
  });
  const policy = {
    legs: creation.map((c: any, i: number) => ({
      marketId: p.sources[i].id,
      conditionId: c.data.conditionId,
      outcomesString: c.data.outcomes,
      selectedOutcome: p.selectedOutcomeIndexes[i],
      endsAt: Date.parse(c.data.endDate) / 1000,
    })),
    airnodePublicKey,
    isOr: p.operator === "OR",
    observationDeadline: p.observationDeadline,
    collateralSatoshis: 10000,
    yesRecipientScript: buyerScript,
    noRecipientScript: cpScript,
    refundAfter: p.refundAfter,
    refundBuyerScript: buyerScript,
    refundCounterpartyScript: cpScript,
    buyerStakeSatoshis: 5000,
  };
  const guard = nativeGuard(policy);
  fs.writeFileSync(
    path.join(dir, "locking-script.bin"),
    Buffer.from(guard.lockingHex, "hex"),
    { mode: 0o600 },
  );
  const mandate = {
    id,
    proposalId: p.id,
    objective: p.objective,
    policyHash: digest(policy),
    scriptSHA256: guard.info.lockingScriptSha256,
    stakeSatoshis: 5000,
    feeCapSatoshis: 1000,
    repeat: false,
    initialDelegation: true,
    beneficiary: buyerScript,
  };
  if (preview) {
    j = {
      id,
      status: "Preview; node execution blocked",
      proposal: p,
      policy,
      keyID,
      buyerKey,
      counterpartyKey: cpKey,
      mandate,
      mandateSignatureVerified: false,
      creationProofs: creation.map((c: any) => c.response),
      script: guard.info,
      steps: [],
      createdAt: new Date().toISOString(),
      timing,
    };
    save(j);
    step(
      j,
      "Policy preview",
      "Real fresh source policy and derived recipients compiled. No wallet signature, no buyer preparation, no new pool, no claim of network executability.",
    );
    return nativeState();
  }
  const mandateData = Utils.toArray(JSON.stringify(mandate), "utf8");
  const sig = await buyerWallet.createSignature({
    data: mandateData,
    protocolID: BSV_PROTOCOL,
    keyID,
    counterparty: "anyone",
  });
  if (!verifyMandateSignature(mandate, Utils.toHex(sig.signature), buyerKey))
    throw Error("Mandate signature did not verify");
  j = {
    id,
    status: "Mandated",
    proposal: p,
    policy,
    keyID,
    buyerKey,
    counterpartyKey: cpKey,
    mandate,
    mandateSignatureVerified: true,
    creationProofs: creation.map((c: any) => c.response),
    script: guard.info,
    cpSource,
    sponsorSource: sponsor,
    steps: [],
    createdAt: new Date().toISOString(),
    timing,
  };
  save(j);
  step(
    j,
    "Agent mandate",
    "Exact future sources, 5,000-sat stake, wallet-derived beneficiary, fee cap and one-shot plan accepted",
  );
  return prepareFunding(j);
}
async function prepareFunding(j: any) {
  if (j.fundingPlan) {
    return nativeState();
  }
  if (now() >= j.proposal.tradeClosesAt)
    throw Error(
      "Funding cutoff reached; no new action. Prepared self-output stays buyer-owned.",
    );
  const guard = nativeGuard(j.policy);
  if (!j.buyerSource) {
    if (j.buyerAction)
      throw Error(
        "Buyer wallet action outcome uncertain; reconcile the saved action, no retry charge",
      );
    j.buyerAction = { state: "requested", at: new Date().toISOString() };
    save(j);
    const action = await buyerWallet.createAction({
      description: "Prepare bounded native BSV prediction stake",
      outputs: [
        {
          lockingScript: j.policy.refundBuyerScript,
          satoshis: 5000,
          outputDescription: "Self-owned native prediction stake",
          basket: "secondordernative",
          customInstructions: JSON.stringify({
            protocolID: BSV_PROTOCOL,
            keyID: j.keyID,
            counterparty: "anyone",
          }),
        },
      ],
      options: {
        signAndProcess: false,
        randomizeOutputs: false,
        acceptDelayedBroadcast: false,
      },
    });
    if (!action.signableTransaction)
      throw Error("Wallet did not return signable preparation");
    const candidate = Transaction.fromAtomicBEEF(action.signableTransaction.tx);
    const fee = sourceFee(candidate);
    if (!Number.isSafeInteger(fee) || fee < 0 || fee > 1000)
      throw Error("Buyer preparation fee exceeds 1,000 test sats");
    j.buyerAction = {
      state: "prepared",
      reference: action.signableTransaction.reference,
    };
    save(j);
    const signed = await buyerWallet.signAction({
      reference: action.signableTransaction.reference,
      spends: {},
      options: { noSend: true },
    });
    if (!signed.tx || !signed.txid)
      throw Error("Wallet sign result uncertain; reconcile original reference");
    const tx = Transaction.fromAtomicBEEF(signed.tx),
      vout = tx.outputs.findIndex(
        (o) =>
          o.satoshis === 5000 &&
          o.lockingScript.toHex() === j.policy.refundBuyerScript,
      );
    if (vout < 0) throw Error("Exact self-owned stake output missing");
    j.buyerSource = {
      txid: signed.txid,
      vout,
      satoshis: 5000,
      beef: Array.from(signed.tx),
      fee,
      keyID: j.keyID,
    };
    save(j);
  }
  const buyer = sourceTx(j.buyerSource);
  await publishSmall(buyer, j.buyerSource, j);
  // Notify the standard wallet of the already-broadcast noSend transaction; this must not create a new payment.
  if (!j.buyerSource.walletReconciled) {
    try {
      await buyerWallet.signAction({
        reference: j.buyerAction.reference,
        spends: {},
        options: { sendWith: [j.buyerSource.txid] },
      });
      j.buyerSource.walletReconciled = true;
    } catch (e) {
      j.buyerSource.walletReconciliationNote = cleanError(e);
    }
    save(j);
  }
  const sources = [
    j.buyerSource,
    j.cpSource,
    { ...j.sponsorSource, beef: j.sponsorSource.sourceBeef },
  ];
  const tx = new Transaction();
  for (const s of sources) {
    const t = sourceTx(s),
      o = t.outputs[s.vout];
    if (o.satoshis !== s.satoshis) throw Error("Source amount mismatch");
    tx.addInput({
      sourceTransaction: t,
      sourceTXID: s.txid,
      sourceOutputIndex: s.vout,
      sequence: 0xffffffff,
    });
  }
  tx.addOutput({
    lockingScript: LockingScript.fromHex(guard.lockingHex),
    satoshis: 10000,
  });
  tx.addOutput({
    lockingScript: LockingScript.fromHex(j.policy.refundCounterpartyScript),
    satoshis: 4000,
  });
  tx.addOutput({
    lockingScript: LockingScript.fromHex(j.sponsorSource.returnLockingScript),
    satoshis: 13000,
  });
  if (sourceFee(tx) !== 13000) throw Error("Funding fee mismatch");
  await p2pkhSign(tx, 0, buyerWallet, j.keyID);
  await p2pkhSign(tx, 1, await counterparty(), j.cpSource.keyID);
  const plan = {
    network: "testnet",
    id: j.id,
    createdAt: new Date().toISOString(),
    fundBefore: j.proposal.tradeClosesAt,
    policy: j.policy,
    script: j.script,
    mandate: j.mandate,
    sponsorInputIndex: 2,
    returnOutputIndex: 2,
    feeSatoshis: 13000,
    partialRaw: tx.toHex(),
    sources: sources.map((s: any, inputIndex: number) => ({
      inputIndex,
      txid: s.txid,
      vout: s.vout,
      satoshis: s.satoshis,
      beef: s.beef,
    })),
    expectedOutputs: [
      { satoshis: 10000, scriptSHA256: j.script.lockingScriptSha256 },
      { satoshis: 4000, lockingScript: j.policy.refundCounterpartyScript },
      { satoshis: 13000, lockingScript: j.sponsorSource.returnLockingScript },
    ],
  };
  put("funding-plan.json", plan);
  j.fundingPlan = {
    file: ".runtime/bsv-native/funding-plan.json",
    partialSHA256: Utils.toHex(
      Hash.sha256(Utils.toArray(plan.partialRaw, "hex")),
    ),
    feeSatoshis: 13000,
    preparedAt: plan.createdAt,
  };
  j.status = "Awaiting sponsor signature";
  save(j);
  step(
    j,
    "Native plan frozen",
    "Buyer and counterparty signed all exact outputs. Fee sponsor must independently validate and sign input 2. No large funding broadcast yet.",
  );
  return nativeState();
}
export async function nativeImportFunding() {
  const j = nativeRead("intent.json");
  if (!j?.fundingPlan) throw Error("Prepare frozen native funding first");
  const signed = nativeRead("funding-signed.json");
  if (!signed?.raw) throw Error("Independent sponsor signature missing");
  const plan = nativeRead("funding-plan.json"),
    tx = Transaction.fromHex(signed.raw),
    partial = Transaction.fromHex(plan.partialRaw);
  if (tx.inputs.length !== 3 || tx.outputs.length !== 3)
    throw Error("Funding shape changed");
  for (let i = 0; i < 3; i++) {
    if (
      tx.inputs[i].sourceTXID !== partial.inputs[i].sourceTXID ||
      tx.inputs[i].sourceOutputIndex !== partial.inputs[i].sourceOutputIndex ||
      tx.inputs[i].sequence !== partial.inputs[i].sequence ||
      tx.outputs[i].satoshis !== partial.outputs[i].satoshis ||
      tx.outputs[i].lockingScript.toHex() !==
        partial.outputs[i].lockingScript.toHex()
    )
      throw Error("Frozen transaction changed");
    tx.inputs[i].sourceTransaction = sourceTx(plan.sources[i]);
    if (!verifyInput(tx, i)) throw Error("Funding input signature invalid");
  }
  if (
    tx.version !== partial.version ||
    tx.lockTime !== partial.lockTime ||
    sourceFee(tx) !== 13000
  )
    throw Error("Funding fee/version/locktime changed");
  if (j.funding?.txid && j.funding.txid !== tx.id("hex"))
    throw Error("Existing canonical funding cannot change");
  j.funding = {
    ...(j.funding || {}),
    txid: tx.id("hex"),
    rawBytes: tx.toBinary().length,
    scriptBytes: j.script.lockingScriptBytes,
    feeSatoshis: 13000,
  };
  put("funding-beef.json", { beef: tx.toAtomicBEEF() });
  save(j);
  const r = await reconcile(tx);
  j.funding.accepted = r.accepted;
  j.funding.network = r;
  j.status = r.accepted ? "Observing" : "Prepared; network pending";
  save(j);
  return nativeState();
}
function nativePreimage(tx: Transaction, guard: any) {
  const i = tx.inputs[0];
  return Utils.toHex(
    TransactionSignature.format({
      sourceTXID: i.sourceTXID!,
      sourceOutputIndex: i.sourceOutputIndex,
      sourceSatoshis: 10000,
      transactionVersion: tx.version,
      otherInputs: tx.inputs.slice(1),
      inputIndex: 0,
      outputs: tx.outputs,
      inputSequence: i.sequence ?? 0xffffffff,
      subscript: LockingScript.fromHex(guard.postSeparatorScriptHex),
      lockTime: tx.lockTime,
      scope: 0x41,
    }),
  );
}
export async function nativeRun(rawEnvelopes?: any[]) {
  const j = nativeRead("intent.json");
  if (!j) return nativeState();
  if (["Paid", "Refunded"].includes(j.status)) return nativeState();
  if (!j.funding?.accepted) {
    if (nativeRead("funding-signed.json")) return nativeImportFunding();
    return nativeState();
  }
  if (now() < Math.max(...j.policy.legs.map((l: any) => l.endsAt)))
    return nativeState();
  try {
    const envelopes =
      rawEnvelopes ||
      (await Promise.all(
        j.policy.legs.map((l: any) => signed(requestFor(l.marketId))),
      ));
    j.lastObservedAt = new Date().toISOString();
    const results = envelopes.map((e: any, i: number) => {
      if (
        e.requestHash.toLowerCase() !==
        hashRequest(requestFor(j.policy.legs[i].marketId)).toLowerCase()
      )
        throw Error("Wrong native request");
      const d = JSON.parse(e.data);
      if (d.c !== true || d.s !== "resolved")
        throw Error("Waiting for closed resolved sources");
      const p = JSON.parse(d.p);
      if (p.length !== 2 || !["1,0", "0,1"].includes(p.join(",")))
        throw Error("Non-terminal outcome prices");
      return p[j.policy.legs[i].selectedOutcome] === "1";
    });
    const result = j.policy.isOr
        ? results.some(Boolean)
        : results.every(Boolean),
      winner = result ? "buyer" : "counterparty",
      guard = nativeGuard(j.policy);
    if (!j.payout) {
      const funding = Transaction.fromAtomicBEEF(
        nativeRead("funding-beef.json").beef,
      );
      const tx = new Transaction();
      tx.addInput({
        sourceTransaction: funding,
        sourceTXID: j.funding.txid,
        sourceOutputIndex: 0,
        sequence: 0xffffffff,
      });
      tx.addInput({
        sourceTransaction: funding,
        sourceTXID: j.funding.txid,
        sourceOutputIndex: 1,
        sequence: 0xffffffff,
      });
      tx.addOutput({
        lockingScript: LockingScript.fromHex(
          result ? j.policy.yesRecipientScript : j.policy.noRecipientScript,
        ),
        satoshis: 10000,
      });
      tx.addOutput({
        lockingScript: LockingScript.fromHex(j.policy.refundCounterpartyScript),
        satoshis: 3500,
      });
      const preimageHex = nativePreimage(tx, guard);
      const unlockingHex = guard.unlock({
        envelopes,
        preimageHex,
        changeAmount: 3500,
        changePublicKeyHash: j.policy.refundCounterpartyScript.slice(6, 46),
      });
      tx.inputs[0].unlockingScript = UnlockingScript.fromHex(unlockingHex);
      await p2pkhSign(tx, 1, await counterparty(), j.keyID);
      // Actual compiled Script gate on the complete transaction, independent of friendly helper checks.
      const {
        verifyRaw,
      } = require("../native/pm-followon/consumer-helper.cjs");
      if (!verifyRaw)
        throw Error("Compiled Script transaction verifier not installed");
      const verification = verifyRaw({
        policy: j.policy,
        rawTransaction: tx.toHex(),
        inputIndex: 0,
        sourceSatoshis: 10000,
      });
      if (!verification.success)
        throw Error("Native Script rejected: " + verification.error);
      j.result = result ? "YES" : "NO";
      j.results = results;
      j.proofs = envelopes;
      j.payout = {
        txid: tx.id("hex"),
        winner,
        satoshis: 10000,
        feeSatoshis: 500,
        compiledScriptVerification: verification,
        at: new Date().toISOString(),
      };
      put("payout.json", { raw: tx.toHex(), beef: tx.toAtomicBEEF() });
      evidence("settlement-proofs.json", {
        policy: j.policy,
        envelopes,
        verification,
      });
      save(j);
    }
    const tx = Transaction.fromAtomicBEEF(nativeRead("payout.json").beef);
    await publishSmall(tx, j.payout, j);
    j.status = "Paid";
    delete j.error;
    save(j);
    step(
      j,
      "Native Script payout",
      "Two original API3 signatures and fixed winner output verified by actual Bitcoin Script; full 10,000-sat pool paid",
      j.payout.txid,
    );
  } catch (e) {
    j.error = cleanError(e);
    j.status = j.payout ? "Needs reconciliation" : "Observing";
    save(j);
  }
  return nativeState();
}
/** Native contract refund: fixed paired stakes, actual non-final nLockTime, separate fee input. */
export async function nativeRefund() {
  const j = nativeRead("intent.json");
  if (!j?.funding?.accepted) throw Error("No accepted native pool to refund");
  if (j.status === "Paid")
    throw Error("Native pool already paid; no double spend");
  if (j.status === "Refunded") return nativeState();
  if (now() < j.policy.refundAfter)
    throw Error("Native refund has not matured");
  if (j.payout)
    throw Error(
      "Reconcile the saved payout before attempting a competing refund",
    );
  const guard = nativeGuard(j.policy);
  if (!j.refund) {
    const funding = Transaction.fromAtomicBEEF(
      nativeRead("funding-beef.json").beef,
    );
    const tx = new Transaction();
    tx.lockTime = j.policy.refundAfter;
    for (const sourceOutputIndex of [0, 1])
      tx.addInput({
        sourceTransaction: funding,
        sourceTXID: j.funding.txid,
        sourceOutputIndex,
        sequence: 0xfffffffe,
      });
    tx.addOutput({
      lockingScript: LockingScript.fromHex(j.policy.refundBuyerScript),
      satoshis: 5000,
    });
    tx.addOutput({
      lockingScript: LockingScript.fromHex(j.policy.refundCounterpartyScript),
      satoshis: 5000,
    });
    tx.addOutput({
      lockingScript: LockingScript.fromHex(j.policy.refundCounterpartyScript),
      satoshis: 3500,
    });
    tx.inputs[0].unlockingScript = UnlockingScript.fromHex(
      guard.unlock({
        refund: true,
        envelopes: [],
        preimageHex: nativePreimage(tx, guard),
        changeAmount: 3500,
        changePublicKeyHash: j.policy.refundCounterpartyScript.slice(6, 46),
      }),
    );
    await p2pkhSign(tx, 1, await counterparty(), j.keyID);
    const { verifyRaw } = require("../native/pm-followon/consumer-helper.cjs");
    const verification = verifyRaw({
      policy: j.policy,
      rawTransaction: tx.toHex(),
      inputIndex: 0,
      sourceSatoshis: 10000,
    });
    if (!verification.success)
      throw Error("Native refund Script rejected: " + verification.error);
    j.refund = {
      txid: tx.id("hex"),
      buyerSatoshis: 5000,
      counterpartySatoshis: 5000,
      feeSatoshis: 500,
      compiledScriptVerification: verification,
      at: new Date().toISOString(),
    };
    put("refund.json", { raw: tx.toHex(), beef: tx.toAtomicBEEF() });
    save(j);
  }
  const tx = Transaction.fromAtomicBEEF(nativeRead("refund.json").beef);
  await publishSmall(tx, j.refund, j);
  j.status = "Refunded";
  delete j.error;
  save(j);
  step(
    j,
    "Native paired refund",
    "Mature fixed 5,000/5,000-sat paired refund accepted; external fee input pays 500 sats",
    j.refund.txid,
  );
  return nativeState();
}
export const bsvNativeRouter = express.Router();
const route = (f: (r: any) => Promise<any>) => (req: any, res: any) =>
  withStore("bsv-native", async () => {
    try {
      res.json(await exclusive(() => f(req)));
    } catch (e) {
      res.status(400).json({ error: cleanError(e), state: nativeState() });
    }
  });
bsvNativeRouter.get("/state", (_, res) => res.json(nativeState()));
bsvNativeRouter.post(
  "/connect",
  route(() => nativeConnect()),
);
bsvNativeRouter.post(
  "/propose",
  route((r) => nativeCompose(String(r.body.objective || ""))),
);
bsvNativeRouter.post(
  "/prepare",
  route((r) => nativePrepare(r.body)),
);
bsvNativeRouter.post(
  "/fund",
  route(() => nativeImportFunding()),
);
bsvNativeRouter.post(
  "/run",
  route((r) => nativeRun(r.body.envelopes)),
);

bsvNativeRouter.post(
  "/refund",
  route(() => nativeRefund()),
);
