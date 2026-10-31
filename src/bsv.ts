import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import express from "express";
import {
  Hash,
  P2PKH,
  PrivateKey,
  PublicKey,
  Random,
  Transaction,
  Utils,
  WalletClient,
  type WalletInterface,
} from "@bsv/sdk";
import { root, withStore, exclusive, evidence, cleanError } from "./store.ts";
import {
  discover,
  createProof,
  settlementProof,
  proofArgs,
  requestFor,
  AIRNODE,
  outcomeHash,
  outcomesOf,
} from "./source.ts";
import { deriveRequestHash } from "./vendor/airnode-v2.ts";
import { proposeIntent } from "./llm.ts";
import {
  parseIntent,
  matchIntent,
  equalIntent,
  ASSET_ALIASES,
} from "./intent.ts";
import {
  artifact,
  client,
  deploy,
  write,
  read,
  transactions,
  reconcile,
} from "./chain.ts";
import {
  BSV_PROTOCOL,
  MAX_FEE,
  MAX_STAKE,
  amount,
  assertTestnet,
  digest,
  vaultScript,
  payoutScript,
  walletSignature,
  privateSignature,
  unlock,
  verifyInput,
  assertOutputs,
  verifyMandateSignature,
} from "./bsv-script.ts";

const directory = path.join(root, ".runtime", "bsv");
const arcURL = "https://arcade-v2-testnet-us-1.bsvblockchain.tech";
// Pinned Toolbox Arcade provider uses /tx + EF. SDK ARC uses /v1/tx and is not interchangeable.
const { Arcade } = createRequire(import.meta.url)(
  "@bsv/wallet-toolbox/out/src/services/providers/Arcade",
);
async function broadcast(tx: Transaction) {
  return new Arcade(arcURL).postRawTx(tx.toHexEF(), [tx.id("hex")]);
}
export const buyerWallet = new WalletClient("auto", "localhost");
const now = () => Math.floor(Date.now() / 1000);
const json = (x: any) =>
  JSON.stringify(x, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2);
function local(name: string, value?: any) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const p = path.join(directory, name);
  if (value !== undefined) {
    fs.writeFileSync(p + ".tmp", json(value), { mode: 0o600 });
    fs.renameSync(p + ".tmp", p);
  }
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : undefined;
}
function secrets() {
  let s = local("roles.json");
  if (!s) {
    s = {
      testOnly: true,
      network: "testnet",
      project: "second-order",
      attestor: PrivateKey.fromRandom().toHex(),
      counterparty: PrivateKey.fromRandom().toHex(),
    };
    local("roles.json", s);
  }
  if (!s.testOnly || s.network !== "testnet" || s.project !== "second-order")
    throw Error("Invalid BSV test role scope");
  return s;
}
function attestor() {
  return PrivateKey.fromHex(secrets().attestor);
}
let counterpartySetup: any;
export async function counterparty(): Promise<WalletInterface> {
  if (!counterpartySetup) {
    const { Setup } = await import("@bsv/wallet-toolbox");
    const s = secrets(),
      key = PrivateKey.fromHex(s.counterparty),
      identityKey = key.toPublicKey().toString();
    counterpartySetup = await Setup.createWalletSQLite({
      env: {
        chain: "test",
        identityKey,
        identityKey2: identityKey,
        taalApiKey: "",
        devKeys: {},
        mySQLConnection: "{}",
        filePath: directory,
      },
      rootKeyHex: key.toHex(),
      filePath: path.join(directory, "counterparty.sqlite"),
      databaseName: "second_order_bsv_test",
    });
  }
  return counterpartySetup.wallet;
}
async function walletBalance(w: WalletInterface) {
  if (w === buyerWallet) return null;
  const r = await w.listOutputs({ basket: "default", limit: 1000 });
  return r.outputs.reduce((n: any, o: any) => n + o.satoshis, 0);
}
async function connected() {
  const { network } = await buyerWallet.getNetwork({});
  assertTestnet(network);
  if (!(await buyerWallet.isAuthenticated({})).authenticated)
    throw Error("Unlock BSV Desktop testnet wallet");
  const { publicKey } = await buyerWallet.getPublicKey({ identityKey: true });
  return {
    network,
    identity: publicKey,
    authenticated: true,
    balanceSatoshis: null,
    balanceNote:
      "Standard wallet balance is private; createAction performs wallet coin selection. No default-basket access requested.",
    checkedAt: new Date().toISOString(),
  };
}
function trace(
  j: any,
  action: string,
  status: string,
  message: string,
  txid?: string,
) {
  j.steps ??= [];
  j.steps.push({
    at: new Date().toISOString(),
    action,
    status,
    message,
    ...(txid ? { txid } : {}),
  });
  persist(j);
}
function persist(j: any) {
  local("intent.json", j);
  const pub = publicIntent(j);
  evidence("intent.json", pub);
}
function publicIntent(j: any) {
  if (!j) return null;
  const { fundings, mandateSignature, ...rest } = j;
  const { beef: payoutBeef, ...payout } = rest.payout || {};
  return {
    ...rest,
    ...(rest.payout ? { payout } : {}),
    fundings: fundings?.map((f: any) => {
      const { beef, refundRaw, refundBeef, ...safe } = f;
      return safe;
    }),
    mandateSignature: mandateSignature
      ? "verified wallet signature"
      : undefined,
  };
}
async function receivePayout(j: any) {
  if (!j.payout || j.payout.received) return;
  const entry = j.payout,
    role = entry.winner,
    w = role === "buyer" ? buyerWallet : await counterparty();
  assertTestnet((await w.getNetwork({})).network);
  const expectedKey = (
    await w.getPublicKey({
      protocolID: BSV_PROTOCOL,
      keyID: `${j.id} payout`,
      counterparty: "anyone",
      forSelf: true,
    })
  ).publicKey;
  if (expectedKey !== j.manifest[`${role}PayoutKey`])
    throw Error("Receiving wallet does not own the fixed payout key");
  let records = await w.listOutputs({
    basket: "secondorderbsvpayout",
    include: "locking scripts",
    limit: 1000,
  });
  const owns = (o: any) =>
    o.outpoint === `${entry.txid}.0` &&
    o.satoshis === entry.satoshis &&
    o.lockingScript === j.manifest[`${role}PayoutScript`];
  if (!records.outputs.some(owns)) {
    const tx = Transaction.fromAtomicBEEF(entry.beef);
    await w.internalizeAction({
      tx: tx.toAtomicBEEF(),
      outputs: [
        {
          outputIndex: 0,
          protocol: "basket insertion",
          insertionRemittance: {
            basket: "secondorderbsvpayout",
            customInstructions: JSON.stringify({
              keyID: `${j.id} payout`,
              protocolID: BSV_PROTOCOL,
            }),
          },
        },
      ],
      description: "BSV derivative payout",
    });
    records = await w.listOutputs({
      basket: "secondorderbsvpayout",
      include: "locking scripts",
      limit: 1000,
    });
  }
  if (!records.outputs.some(owns))
    throw Error(
      "Payout is on-chain but receiving wallet registration requires reconciliation",
    );
  entry.received = true;
  entry.receivingBasket = "secondorderbsvpayout";
  entry.receiptVerifiedAt = new Date().toISOString();
  persist(j);
}
function view() {
  const j = local("intent.json");
  return {
    network: "BSV testnet",
    route: "/bsv",
    wallet: local("wallet-status.json") || null,
    proposal: local("proposal.json") || null,
    intent: publicIntent(j),
    limits: {
      maxStakeSatoshis: MAX_STAKE,
      maxFeeSatoshis: MAX_FEE,
      apiFee: 0,
      automaticTopup: false,
    },
    trust: {
      mode: "Original API3 EVM approval + trusted BSV attestor",
      nativeAPI3: false,
      script:
        "Attestor AND one participant signature; SIGHASH_ALL output binding",
      risk: "Attestor can censor; attestor and one participant can collude. API3/EVM correctness is not enforced natively by BSV Script.",
      currentKeyTopology:
        "This test backend holds both attestor and seeded counterparty keys. Multiple signatures do not prove independent control; BSV non-custodial qualification is BLOCKED for this topology.",
      refund:
        "A fully signed fixed-output time-locked refund is saved before each funding broadcast. No CLTV/CSV guarantee.",
    },
    qualification: {
      nonCustodial:
        "BLOCKED: backend controls attestor and seeded counterparty",
      wallet:
        local("wallet-status.json")?.network === "testnet" ? "PASS" : "PENDING",
      realCollateral: j?.fundings?.some(
        (f: any) => f.broadcast?.status === "success",
      )
        ? "PASS"
        : "PENDING",
      settlement: j?.status === "Paid" ? "PASS" : "PENDING",
      api3Approval: j?.approvalAddress ? "DEPLOYED" : "PENDING",
      video: "PENDING",
    },
    updatedAt: new Date().toISOString(),
  };
}

export async function composeBSV(objective: string) {
  if (
    local("intent.json") &&
    !["Paid", "Refunded"].includes(local("intent.json").status)
  )
    throw Error("Finish or refund the current BSV intent first");
  const p = await buildBSVProposal(objective);
  local("proposal.json", p);
  evidence("proposal.json", p);
  return p;
}
export async function buildBSVProposal(
  objective: string,
  prioritizeRequestedAssets = false,
) {
  const parsed = parseIntent(objective);
  if (parsed.status !== "supported")
    throw Error(parsed.reasons.map((x) => x.message).join(" "));
  const listing = await discover(
    prioritizeRequestedAssets
      ? parsed.intent.legs.flatMap((l) => [...ASSET_ALIASES[l.asset]])
      : undefined,
  );
  const markets = listing.markets;
  const pairs: any[] = [];
  for (let a = 0; a < markets.length; a++)
    for (let b = a + 1; b < markets.length; b++)
      for (const x of [0, 1])
        for (const y of [0, 1]) {
          const m = matchIntent(
            parsed.intent,
            {
              marketIds: [markets[a].id, markets[b].id],
              selectedOutcomeIndexes: [x, y],
              operator: parsed.intent.operator,
            },
            markets,
          );
          if (m.status === "matched") pairs.push(m.matches);
        }
  if (!pairs.length)
    throw Error(
      "No exact future two-market window in the bounded catalog. No payment or deployment.",
    );
  const model = await proposeIntent(objective, markets, pairs);
  if (
    model.decision !== "accept" ||
    !equalIntent(parsed.intent, model.normalized)
  )
    throw Error("Model did not preserve the exact objective; no action");
  const p: any = {
    id: crypto.randomUUID(),
    objective,
    marketIds: model.marketIds,
    selectedOutcomeIndexes: model.selectedOutcomeIndexes,
    operator: model.normalized!.operator,
    normalizedIntent: model.normalized,
    model: model.model,
    modelRecord: model,
    createdAt: new Date().toISOString(),
  };
  const checked = matchIntent(parsed.intent, p, markets);
  if (checked.status !== "matched")
    throw Error(checked.reasons.map((x) => x.message).join(" "));
  p.matches = checked.matches;
  p.sources = p.marketIds.map((id: string) => markets.find((m) => m.id === id));
  p.deadline =
    Math.max(...p.sources.map((m: any) => Date.parse(m.endDate) / 1000)) + 1200;
  p.tradeClosesAt =
    Math.min(...p.sources.map((m: any) => Date.parse(m.endDate) / 1000)) - 45;
  return p;
}
async function prepareSidecar(j: any) {
  if (j.approvalAddress && j.initializationTx) return;
  if (
    j.approvalAddress &&
    transactions().some((t: any) => t.id === `${j.id}:approval-initialize`)
  ) {
    const receipt = await reconcile(`${j.id}:approval-initialize`);
    if (receipt) {
      j.initializationTx = receipt.transactionHash;
      persist(j);
      return;
    }
  }
  const proofs = [],
    sources = [];
  for (let i = 0; i < 2; i++) {
    const s = j.proposal.sources[i],
      p = await createProof(s.id);
    if (
      p.data.conditionId !== s.conditionId ||
      outcomeHash(outcomesOf(p.data.outcomes)) !== outcomeHash(s.outcomes) ||
      Date.parse(p.data.endDate) !== Date.parse(s.endDate)
    )
      throw Error("Source changed before BSV exposure");
    proofs.push(proofArgs(p.response));
    sources.push({
      marketId: s.id,
      conditionId: s.conditionId,
      outcomesHash: outcomeHash(s.outcomes),
      createRequestHash: deriveRequestHash(requestFor(s.id)),
      settlementRequestHash: deriveRequestHash(requestFor(s.id, true)),
      signer: AIRNODE,
      selectedOutcome: j.proposal.selectedOutcomeIndexes[i],
      endTime: BigInt(Date.parse(s.endDate) / 1000),
    });
  }
  if (!j.approvalAddress) {
    const deployment = await deploy(
      `${j.id}:approval-deploy`,
      "BSVBasketApproval",
      [
        sources,
        j.proposal.operator === "OR",
        `0x${j.manifestHash}`,
        BigInt(j.proposal.tradeClosesAt),
        BigInt(j.proposal.deadline),
      ],
    );
    j.approvalAddress = deployment.contractAddress;
    j.approvalDeploymentTx = deployment.transactionHash;
    persist(j);
  }
  const r = await write(
    `${j.id}:approval-initialize`,
    "deployer",
    j.approvalAddress,
    artifact("BSVBasketApproval").abi,
    "initialize",
    [proofs],
  );
  j.initializationTx = r.transactionHash;
  j.createProofs = proofs;
  persist(j);
  evidence("approval.json", {
    manifestHash: j.manifestHash,
    contract: j.approvalAddress,
    deployment: j.approvalDeploymentTx,
    initialization: r.transactionHash,
    originalSignatureConsumer: true,
    trust:
      "BSV attestor reads EVM state; BSV Script does not verify EVM consensus",
  });
}
async function broadcastRecorded(entry: any, tx: Transaction, j: any) {
  const networkCheck = async () => {
    const r = await fetch(`${arcURL}/tx/${tx.id("hex")}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return false;
    const d: any = await r.json();
    entry.networkReceipt = {
      txid: d.txid,
      txStatus: d.txStatus,
      blockHeight: d.blockHeight,
      checkedAt: new Date().toISOString(),
    };
    entry.networkAccepted =
      d.txid === tx.id("hex") &&
      [
        "ACCEPTED_BY_NETWORK",
        "SEEN_ON_NETWORK",
        "SEEN_MULTIPLE_NODES",
        "MINED",
        "IMMUTABLE",
      ].includes(d.txStatus);
    persist(j);
    return entry.networkAccepted;
  };
  if (entry.broadcast?.status === "success") {
    if (!entry.networkAccepted && !(await networkCheck()))
      throw Error(
        "Broadcast acknowledged; waiting for network acceptance of the same saved transaction",
      );
    return entry.broadcast;
  }
  if (entry.broadcastStarted) {
    const r = await fetch(`${arcURL}/tx/${tx.id("hex")}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (r.ok) {
      const d: any = await r.json();
      if (
        d.txid === tx.id("hex") &&
        String(d.txStatus || "").includes("REJECT")
      )
        throw Error("Recorded transaction rejected; inspect before retry");
      if (
        d.txid === tx.id("hex") &&
        [
          "ACCEPTED_BY_NETWORK",
          "SEEN_ON_NETWORK",
          "SEEN_MULTIPLE_NODES",
          "MINED",
          "IMMUTABLE",
        ].includes(d.txStatus)
      ) {
        entry.broadcast = {
          status: "success",
          txid: tx.id("hex"),
          message: "Reconciled exact Arcade transaction",
        };
        entry.networkAccepted = true;
        entry.networkReceipt = {
          txid: d.txid,
          txStatus: d.txStatus,
          checkedAt: new Date().toISOString(),
        };
        persist(j);
        return entry.broadcast;
      }
    }
    throw Error(
      "Unknown broadcast outcome; no replacement transaction or new charge",
    );
  }
  entry.broadcastStarted = new Date().toISOString();
  entry.txid = tx.id("hex");
  persist(j);
  const r = await broadcast(tx);
  entry.broadcast = r;
  persist(j);
  if (r.status !== "success")
    throw Error(
      "Arcade rejected transaction; inspect the exact saved hash before retry",
    );
  if (!(await networkCheck()))
    throw Error(
      "Broadcast acknowledged; waiting for network acceptance of the same saved transaction",
    );
  return r;
}
async function fundRole(j: any, role: "buyer" | "counterparty") {
  let f = j.fundings.find((x: any) => x.role === role);
  if (f?.refundReadyBeforeFunding) {
    const tx = Transaction.fromAtomicBEEF(f.beef);
    await broadcastRecorded(f, tx, j);
    return;
  }
  if (f && !f.beef)
    throw Error(
      "Wallet action outcome unknown; inspect the saved action intent before any new signature",
    );
  if (now() >= j.proposal.tradeClosesAt)
    throw Error("Funding window closed; no new stake");
  const w = role === "buyer" ? buyerWallet : await counterparty();
  assertTestnet((await w.getNetwork({})).network);
  const available = await walletBalance(w);
  if (available !== null && available < j.manifest.stakeSatoshis + MAX_FEE)
    throw Error(`${role} test wallet needs stake plus fee; no auto top-up`);
  const script = j.manifest.vaultScript;
  // Signed funding remains unbroadcast until a fully signed, exact-output refund exists.
  if (!f) {
    f = {
      role,
      actionState: "creating",
      actionStartedAt: new Date().toISOString(),
    };
    j.fundings.push(f);
    persist(j);
    const action = await w.createAction({
      description: "Fund bounded BSV basket",
      outputs: [
        {
          lockingScript: script,
          satoshis: j.manifest.stakeSatoshis,
          outputDescription: `${role} basket collateral`,
          basket: "secondorderbsv",
          customInstructions: JSON.stringify({ intentId: j.id, role }),
        },
      ],
      options: {
        randomizeOutputs: false,
        noSend: true,
        acceptDelayedBroadcast: false,
      },
    });
    if (!action.tx || !action.txid)
      throw Error("Wallet did not return signed unbroadcast collateral");
    f.beef = Array.from(action.tx);
    f.txid = action.txid;
    f.actionState = "signed-unbroadcast";
    persist(j);
  }
  const funding = Transaction.fromAtomicBEEF(f.beef);
  const index = funding.outputs.findIndex(
    (o) =>
      o.lockingScript.toHex() === script &&
      o.satoshis === j.manifest.stakeSatoshis,
  );
  if (index < 0) throw Error("Wallet changed collateral output");
  if (
    funding.outputs.filter((o) => o.lockingScript.toHex() === script).length !==
    1
  )
    throw Error("Duplicate collateral output");
  const fundingFee =
    funding.inputs.reduce(
      (n, i) =>
        n + (i.sourceTransaction?.outputs[i.sourceOutputIndex].satoshis ?? 0),
      0,
    ) - funding.outputs.reduce((n, o) => n + (o.satoshis ?? 0), 0);
  if (fundingFee < 0 || fundingFee > MAX_FEE)
    throw Error("Funding fee exceeds guard; nothing broadcast");
  const refund = new Transaction();
  refund.lockTime = j.proposal.deadline;
  refund.addInput({
    sourceTransaction: funding,
    sourceTXID: funding.id("hex"),
    sourceOutputIndex: index,
    sequence: 0xfffffffe,
  });
  const payout =
    role === "buyer"
      ? j.manifest.buyerPayoutScript
      : j.manifest.counterpartyPayoutScript;
  refund.addOutput({
    lockingScript: payoutScript(
      role === "buyer"
        ? j.manifest.buyerPayoutKey
        : j.manifest.counterpartyPayoutKey,
    ),
    satoshis: j.manifest.stakeSatoshis - MAX_FEE,
  });
  refund.inputs[0].unlockingScript = unlock(
    await walletSignature(w, refund, 0, j.manifest[`${role}KeyID`]),
    privateSignature(refund, 0, attestor()),
  );
  assertOutputs(refund, [
    { script: payout, satoshis: j.manifest.stakeSatoshis - MAX_FEE },
  ]);
  if (!verifyInput(refund, 0))
    throw Error("Refund Script verification failed; collateral not broadcast");
  Object.assign(f, {
    role,
    txid: funding.id("hex"),
    outputIndex: index,
    satoshis: j.manifest.stakeSatoshis,
    refundRaw: refund.toHex(),
    refundTxid: refund.id("hex"),
    refundBeef: refund.toAtomicBEEF(),
    refundReadyBeforeFunding: true,
    refundLockTime: refund.lockTime,
    fundingPreparedAt: new Date().toISOString(),
  });
  persist(j);
  await broadcastRecorded(f, funding, j);
  trace(
    j,
    `${role} collateral`,
    "confirmed",
    "Real testnet collateral accepted; fixed-output refund saved first",
    f.txid,
  );
}
async function authorizeBSV(body: any) {
  const old = local("intent.json");
  if (old && !["Paid", "Refunded"].includes(old.status))
    throw Error("Existing BSV intent must reconcile; no second mandate");
  const p = local("proposal.json");
  if (!p || p.id !== body.proposalId || p.objective !== body.objective)
    throw Error("Proposal/objective changed; review again");
  if (now() >= p.tradeClosesAt - 30)
    throw Error("Proposal window is closing; get a fresh proposal");
  const stake = amount(Number(body.stakeSatoshis), 3000);
  if (body.side !== "YES" && body.side !== "NO")
    throw Error("Choose YES or NO");
  const status = await connected();
  local("wallet-status.json", status);
  const cp = await counterparty();
  assertTestnet((await cp.getNetwork({})).network);
  if (Number(await walletBalance(cp)) < stake + MAX_FEE)
    throw Error(
      "Separate test counterparty needs stake plus fees. No collateral or EVM setup was started.",
    );
  const id = crypto.randomUUID(),
    buyerKeyID = `${id} buyer`,
    counterpartyKeyID = `${id} counterparty`;
  const buyerKey = (
      await buyerWallet.getPublicKey({
        protocolID: BSV_PROTOCOL,
        keyID: buyerKeyID,
        counterparty: "anyone",
        forSelf: true,
      })
    ).publicKey,
    counterpartyKey = (
      await cp.getPublicKey({
        protocolID: BSV_PROTOCOL,
        keyID: counterpartyKeyID,
        counterparty: "anyone",
        forSelf: true,
      })
    ).publicKey;
  const buyerPayoutKey = (
      await buyerWallet.getPublicKey({
        protocolID: BSV_PROTOCOL,
        keyID: `${id} payout`,
        counterparty: "anyone",
        forSelf: true,
      })
    ).publicKey,
    counterpartyPayoutKey = (
      await cp.getPublicKey({
        protocolID: BSV_PROTOCOL,
        keyID: `${id} payout`,
        counterparty: "anyone",
        forSelf: true,
      })
    ).publicKey;
  const manifest: any = {
    version: 1,
    id,
    network: "testnet",
    objective: p.objective,
    proposalId: p.id,
    marketIds: p.marketIds,
    selectedOutcomeIndexes: p.selectedOutcomeIndexes,
    operator: p.operator,
    sources: p.sources.map((s: any) => ({
      id: s.id,
      conditionId: s.conditionId,
      outcomesHash: outcomeHash(s.outcomes),
      createRequestHash: deriveRequestHash(requestFor(s.id)),
      settlementRequestHash: deriveRequestHash(requestFor(s.id, true)),
    })),
    stakeSatoshis: stake,
    buyerSide: body.side,
    perActionCap: stake,
    totalCollateralCap: stake,
    maxFundingActions: 1,
    maxFeeSatoshis: MAX_FEE,
    maxApiFee: 0,
    tradeClosesAt: p.tradeClosesAt,
    deadline: p.deadline,
    automationExpiresAt: p.deadline + 600,
    buyerIdentity: status.identity,
    buyerKey,
    counterpartyKey,
    buyerKeyID,
    counterpartyKeyID,
    buyerPayoutKey,
    counterpartyPayoutKey,
    buyerPayoutScript: payoutScript(buyerPayoutKey).toHex(),
    counterpartyPayoutScript: payoutScript(counterpartyPayoutKey).toHex(),
    attestorKey: attestor().toPublicKey().toString(),
    trust: "mandatory attestor plus participant; not native API3 verification",
  };
  const hash = digest(manifest);
  manifest.vaultScript = vaultScript(
    manifest.attestorKey,
    buyerKey,
    counterpartyKey,
    hash,
  ).toHex();
  const sig = await buyerWallet.createSignature({
    hashToDirectlySign: Hash.hash256(
      Utils.toArray(JSON.stringify(manifest), "utf8"),
    ),
    protocolID: BSV_PROTOCOL,
    keyID: buyerKeyID,
    counterparty: "anyone",
  });
  if (!verifyMandateSignature(manifest, Utils.toHex(sig.signature), buyerKey))
    throw Error("Mandate signature mismatch");
  const j: any = {
    id,
    status: "Authorized",
    createdAt: new Date().toISOString(),
    proposal: p,
    manifest,
    manifestHash: hash,
    mandateSignature: Utils.toHex(sig.signature),
    fundings: [],
    steps: [],
    sourceApprovals: [],
  };
  persist(j);
  await prepareSidecar(j);
  await runBSV();
  return view();
}
async function terminalApproval(j: any) {
  const abi = artifact("BSVBasketApproval").abi;
  for (let i = 0; i < 2; i++) {
    const operation = `${j.id}:source-${i}`;
    if (await read(j.approvalAddress, abi, "finalSource", [BigInt(i)])) {
      if (!j.sourceApprovals[i]) {
        const existing = transactions().find((t: any) => t.id === operation);
        if (existing) {
          j.sourceApprovals[i] = {
            hash: (existing as any).hash,
            response: j.pendingSourceProofs?.[i],
          };
          persist(j);
        }
      }
      continue;
    }
    try {
      if (transactions().some((t: any) => t.id === operation)) {
        const receipt = await reconcile(operation);
        if (receipt) {
          j.sourceApprovals[i] = {
            hash: receipt.transactionHash,
            response: j.pendingSourceProofs?.[i],
          };
          persist(j);
          continue;
        }
      }
      const p = await settlementProof(j.proposal.marketIds[i]);
      j.pendingSourceProofs ??= [];
      j.pendingSourceProofs[i] = p.response;
      persist(j);
      const r = await write(
        `${j.id}:source-${i}`,
        "deployer",
        j.approvalAddress,
        abi,
        "submit",
        [i, proofArgs(p.response)],
      );
      j.sourceApprovals[i] = { hash: r.transactionHash, response: p.response };
      persist(j);
      trace(
        j,
        `Source ${i ? "B" : "A"} approval`,
        "confirmed",
        "Original signed response changed EVM approval state",
        r.transactionHash,
      );
    } catch (e) {
      j.waitingReason = cleanError(e);
      persist(j);
    }
  }
  if (await read(j.approvalAddress, abi, "settled"))
    return {
      settled: true,
      result: await read(j.approvalAddress, abi, "result"),
    };
  return { settled: false };
}
function validateExecution(j: any) {
  const { vaultScript: script, ...core } = j.manifest;
  if (
    digest(core) !== j.manifestHash ||
    !verifyMandateSignature(j.manifest, j.mandateSignature, j.manifest.buyerKey)
  )
    throw Error("Manifest or signed mandate changed");
  amount(j.manifest.stakeSatoshis, 3000);
  if (
    j.manifest.network !== "testnet" ||
    j.manifest.maxFeeSatoshis !== MAX_FEE ||
    j.manifest.maxFundingActions !== 1 ||
    j.manifest.totalCollateralCap !== j.manifest.stakeSatoshis
  )
    throw Error("Mandate limits changed");
  if (
    script !==
      vaultScript(
        j.manifest.attestorKey,
        j.manifest.buyerKey,
        j.manifest.counterpartyKey,
        j.manifestHash,
      ).toHex() ||
    j.manifest.attestorKey !== attestor().toPublicKey().toString()
  )
    throw Error("Vault signing policy changed");
  for (const role of ["buyer", "counterparty"])
    if (
      payoutScript(j.manifest[`${role}PayoutKey`]).toHex() !==
      j.manifest[`${role}PayoutScript`]
    )
      throw Error("Beneficiary changed");
  if (
    j.manifest.deadline !== j.proposal.deadline ||
    j.manifest.tradeClosesAt !== j.proposal.tradeClosesAt ||
    j.manifest.proposalId !== j.proposal.id ||
    j.manifest.objective !== j.proposal.objective
  )
    throw Error("Basket policy changed");
  if (
    JSON.stringify(j.manifest.marketIds) !==
      JSON.stringify(j.proposal.marketIds) ||
    JSON.stringify(j.manifest.selectedOutcomeIndexes) !==
      JSON.stringify(j.proposal.selectedOutcomeIndexes) ||
    j.manifest.operator !== j.proposal.operator
  )
    throw Error("Approved source selection changed");
  for (let i = 0; i < 2; i++) {
    const s = j.proposal.sources[i],
      fixed = j.manifest.sources[i];
    if (
      s.id !== fixed.id ||
      s.conditionId.toLowerCase() !== fixed.conditionId.toLowerCase() ||
      outcomeHash(s.outcomes) !== fixed.outcomesHash ||
      deriveRequestHash(requestFor(s.id)) !== fixed.createRequestHash ||
      deriveRequestHash(requestFor(s.id, true)) !==
        fixed.settlementRequestHash ||
      Date.parse(s.endDate) / 1000 !== j.manifest.tradeClosesAt + 45
    )
      throw Error("Pinned source identity or observation window changed");
  }
}
export async function runBSV() {
  const j = local("intent.json");
  if (!j) return view();
  if (["Paid", "Refunded"].includes(j.status)) {
    if (j.status === "Paid") await receivePayout(j);
    if (j.error || j.waitingReason) {
      delete j.error;
      delete j.waitingReason;
      persist(j);
    }
    return view();
  }
  try {
    validateExecution(j);
    if (now() >= j.manifest.automationExpiresAt)
      throw Error(
        "Automation expired; use the saved fixed-output refund, no new signing",
      );
    const status = await connected();
    if (status.identity !== j.manifest.buyerIdentity)
      throw Error("Connected wallet differs from fixed payer");
    if (now() >= j.proposal.deadline) {
      for (const f of j.fundings) {
        if (f.refunded) continue;
        const tx = Transaction.fromAtomicBEEF(f.refundBeef);
        const record = f.refundBroadcast || {};
        f.refundBroadcast = record;
        await broadcastRecorded(record, tx, j);
        f.refunded = true;
        trace(
          j,
          `${f.role} refund`,
          "confirmed",
          "Previously signed time-locked refund broadcast",
          tx.id("hex"),
        );
      }
      j.status = "Refunded";
      persist(j);
      return view();
    }
    await prepareSidecar(j);
    if (
      !(await read(
        j.approvalAddress,
        artifact("BSVBasketApproval").abi,
        "initialized",
      )) ||
      String(
        await read(
          j.approvalAddress,
          artifact("BSVBasketApproval").abi,
          "manifestHash",
        ),
      ).toLowerCase() !== `0x${j.manifestHash}`
    )
      throw Error(
        "Original proof approval missing or bound to another manifest",
      );
    const fixedSources: any[] = await Promise.all(
      [0n, 1n].map((i) =>
        read(j.approvalAddress, artifact("BSVBasketApproval").abi, "source", [
          i,
        ]),
      ),
    );
    for (let i = 0; i < 2; i++) {
      const s = fixedSources[i],
        m = j.manifest.sources[i];
      if (
        s.marketId !== m.id ||
        s.conditionId.toLowerCase() !== m.conditionId.toLowerCase() ||
        s.outcomesHash !== m.outcomesHash ||
        s.createRequestHash !== m.createRequestHash ||
        s.settlementRequestHash !== m.settlementRequestHash ||
        s.signer.toLowerCase() !== AIRNODE.toLowerCase() ||
        s.selectedOutcome !== j.manifest.selectedOutcomeIndexes[i] ||
        Number(s.endTime) !== j.manifest.tradeClosesAt + 45
      )
        throw Error(
          "Deployed API3 approval does not match the signed BSV basket",
        );
    }
    for (const role of ["buyer", "counterparty"] as const)
      await fundRole(j, role);
    j.status = "Waiting for sources";
    persist(j);
    const approved = await terminalApproval(j);
    if (!approved.settled) return view();
    const winner =
      approved.result === (j.manifest.buyerSide === "YES")
        ? "buyer"
        : "counterparty";
    const winnerWallet =
      winner === "buyer" ? buyerWallet : await counterparty();
    let entry = j.payout;
    if (!entry) {
      const tx = new Transaction();
      for (const f of j.fundings) {
        const source = Transaction.fromAtomicBEEF(f.beef);
        tx.addInput({
          sourceTransaction: source,
          sourceTXID: f.txid,
          sourceOutputIndex: f.outputIndex,
          sequence: 0xffffffff,
        });
      }
      const value = 2 * j.manifest.stakeSatoshis - MAX_FEE;
      tx.addOutput({
        lockingScript: payoutScript(j.manifest[`${winner}PayoutKey`]),
        satoshis: value,
      });
      assertOutputs(tx, [
        { script: j.manifest[`${winner}PayoutScript`], satoshis: value },
      ]);
      for (let i = 0; i < tx.inputs.length; i++) {
        tx.inputs[i].unlockingScript = unlock(
          await walletSignature(
            winnerWallet,
            tx,
            i,
            j.manifest[`${winner}KeyID`],
          ),
          privateSignature(tx, i, attestor()),
        );
        if (!verifyInput(tx, i))
          throw Error("Settlement Script validation failed");
      }
      entry = j.payout = {
        winner,
        satoshis: value,
        beef: tx.toAtomicBEEF(),
        txid: tx.id("hex"),
        approvalAddress: j.approvalAddress,
        sourceTransactions: j.sourceApprovals.map((s: any) => s.hash),
      };
      persist(j);
    }
    const tx = Transaction.fromAtomicBEEF(entry.beef);
    await broadcastRecorded(entry, tx, j);
    j.result = approved.result;
    await receivePayout(j);
    j.status = "Paid";
    delete j.error;
    delete j.waitingReason;
    trace(
      j,
      "Derivative payout",
      "confirmed",
      `${entry.satoshis} testnet satoshis paid to the fixed ${winner}`,
      entry.txid,
    );
    persist(j);
    evidence("live-settlement.json", publicIntent(j));
    return view();
  } catch (e) {
    j.error = cleanError(e);
    j.status = j.fundings?.length ? "Needs reconciliation" : "Blocked";
    persist(j);
    throw e;
  }
}

export const bsvRouter = express.Router();
const route = (f: (body: any) => Promise<any>) => async (req: any, res: any) =>
  withStore("bsv", () =>
    exclusive(async () => {
      try {
        res.json(await f(req.body || {}));
      } catch (e) {
        res.status(400).json({ error: cleanError(e), state: view() });
      }
    }),
  );
bsvRouter.get("/state", (_, res) => withStore("bsv", () => res.json(view())));
bsvRouter.get("/refund/:role", (req, res) => {
  const j = local("intent.json"),
    f = j?.fundings?.find((x: any) => x.role === req.params.role);
  if (!f?.refundReadyBeforeFunding) {
    res.status(404).json({ error: "No signed refund prepared" });
    return;
  }
  res.set(
    "Content-Disposition",
    `attachment; filename="second-order-${req.params.role}-refund.json"`,
  );
  res.json({
    network: "testnet",
    intent: j.id,
    fundingTxid: f.txid,
    refundTxid: f.refundTxid,
    earliestTime: f.refundLockTime,
    rawTransaction: f.refundRaw,
    atomicBeef: f.refundBeef,
    feeSatoshis: MAX_FEE,
    claim:
      "Fixed complete transaction signed before funding; network availability and unspent input still required",
  });
});
bsvRouter.post(
  "/connect",
  route(async () => {
    const s = await connected();
    local("wallet-status.json", s);
    evidence("wallet-gate.json", s);
    return view();
  }),
);
bsvRouter.post(
  "/propose",
  route(async (b) => {
    if (typeof b.objective !== "string" || b.objective.length > 1000)
      throw Error("Provide bounded objective");
    await composeBSV(b.objective);
    return view();
  }),
);
bsvRouter.post("/authorize", route(authorizeBSV));
bsvRouter.post("/run", route(runBSV));
bsvRouter.post(
  "/counterparty",
  route(async () => {
    const w = await counterparty();
    const key = (await w.getPublicKey({ identityKey: true })).publicKey;
    return {
      network: (await w.getNetwork({})).network,
      identity: key,
      balanceSatoshis: await walletBalance(w),
      role: "Separate seeded test role, not an independent human customer",
    };
  }),
);
bsvRouter.post(
  "/counterparty/fund",
  route(async (b) => {
    if (b.satoshis !== 10000 || b.confirm !== true)
      throw Error(
        "Only one explicitly confirmed 10,000-test-satoshi setup allocation is allowed",
      );
    await connected();
    const cp = await counterparty();
    assertTestnet((await cp.getNetwork({})).network);
    const identity = (await cp.getPublicKey({ identityKey: true })).publicKey;
    let seed = local("counterparty-allocation.json");
    if (!seed) {
      const prefix = Utils.toBase64(Random(16)),
        suffix = Utils.toBase64(Random(16)),
        protocolID: [2, string] = [2, "3241645161d8"];
      const recipient = (
        await buyerWallet.getPublicKey({
          protocolID,
          keyID: `${prefix} ${suffix}`,
          counterparty: identity,
          forSelf: false,
        })
      ).publicKey;
      const lockingScript = new P2PKH()
        .lock(PublicKey.fromString(recipient).toAddress())
        .toHex();
      const r = await buyerWallet.createAction({
        description: "Seed BSV test counterparty",
        outputs: [
          {
            lockingScript,
            satoshis: 10000,
            outputDescription: "Isolated test counterparty",
          },
        ],
        options: {
          randomizeOutputs: false,
          noSend: true,
          acceptDelayedBroadcast: false,
        },
      });
      if (!r.tx || !r.txid)
        throw Error("Wallet did not return a signed allocation");
      const tx = Transaction.fromAtomicBEEF(r.tx);
      const index = tx.outputs.findIndex(
        (o) =>
          o.lockingScript.toHex() === lockingScript && o.satoshis === 10000,
      );
      if (index < 0) throw Error("Allocation output changed");
      const fee =
        tx.inputs.reduce(
          (n, i) =>
            n +
            (i.sourceTransaction?.outputs[i.sourceOutputIndex].satoshis ?? 0),
          0,
        ) - tx.outputs.reduce((n, o) => n + (o.satoshis ?? 0), 0);
      if (fee < 0 || fee > MAX_FEE)
        throw Error("Allocation fee over 1,000 sat cap; not broadcast");
      seed = {
        identity,
        txid: r.txid,
        beef: Array.from(r.tx),
        outputIndex: index,
        satoshis: 10000,
        feeSatoshis: fee,
        prefix,
        suffix,
        senderIdentityKey: (
          await buyerWallet.getPublicKey({ identityKey: true })
        ).publicKey,
        status: "signed",
        createdAt: new Date().toISOString(),
      };
      local("counterparty-allocation.json", seed);
    }
    if (seed.identity !== identity)
      throw Error("Counterparty identity changed; no new allocation");
    const tx = Transaction.fromAtomicBEEF(seed.beef);
    if (!seed.broadcast) {
      const result = await broadcast(tx);
      seed.broadcast = result;
      local("counterparty-allocation.json", seed);
      if (result.status !== "success")
        throw Error(
          "Allocation broadcast not accepted; reconcile exact saved tx",
        );
    }
    if (seed.broadcast.status !== "success")
      throw Error("Existing allocation needs reconciliation; no new action");
    await cp.internalizeAction({
      tx: seed.beef,
      outputs: [
        {
          outputIndex: seed.outputIndex,
          protocol: "wallet payment",
          paymentRemittance: {
            derivationPrefix: seed.prefix,
            derivationSuffix: seed.suffix,
            senderIdentityKey: seed.senderIdentityKey,
          },
        },
      ],
      description: "Receive test role allocation",
    });
    seed.status = "received";
    local("counterparty-allocation.json", seed);
    const result = {
      network: "testnet",
      txid: seed.txid,
      recipientIdentity: identity,
      satoshis: 10000,
      feeSatoshis: seed.feeSatoshis,
      status: seed.status,
      balanceSatoshis: await walletBalance(cp),
      purpose:
        "Test setup only; not derivative collateral or agent payment qualification",
    };
    evidence("counterparty-allocation.json", result);
    return result;
  }),
);
bsvRouter.post(
  "/verify",
  route(async (b) => {
    const j = local("intent.json");
    if (!j?.approvalAddress) throw Error("No BSV approval deployment yet");
    if (b.index !== 0 && b.index !== 1)
      throw Error("Source index must be zero or one");
    const r = await client.readContract({
      address: j.approvalAddress,
      abi: artifact("BSVBasketApproval").abi,
      functionName: "verifyProof",
      args: [b.index, proofArgs(b.envelope), b.terminal === true],
    });
    return {
      valid: true,
      sourceUpdatedAt: String(r),
      method: "deployed EVM eth_call; no BSV fund movement",
      contract: j.approvalAddress,
    };
  }),
);
