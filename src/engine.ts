import fs from "node:fs";
import path from "node:path";
import {
  type Address,
  keccak256,
  toHex,
  encodePacked,
  decodeEventLog,
  parseAbiItem,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { state, save, step, evidence, cleanError, root } from "./store.ts";
import {
  discover,
  createProof,
  settlementProof,
  requestFor,
  proofArgs,
  outcomeHash,
  AIRNODE,
  MAX_ENVELOPE_AGE,
  MAX_SOURCE_AGE,
} from "./source.ts";
import { deriveRequestHash } from "./vendor/airnode-v2.ts";
import { propose } from "./llm.ts";
import {
  address,
  client,
  deploy,
  write,
  read,
  marketAbi,
  TOKEN_ABI,
  transactions,
  reconcile,
} from "./chain.ts";
export const config = {
  tokenSymbol: "SOU",
  tokenDecimals: 6,
  stakeUnits: "1000000",
  maxStakeUnits: "5000000",
  gasCapWei: "300000000000000",
  totalGasCapWei: "1500000000000000",
  expirySeconds: 3600,
  maxActions: 1,
  apiFeeUnits: "0",
  recipientPolicy: "Only the immutable market shown in this proposal",
};
export async function discoverMarkets() {
  const result = await discover();
  state.markets = result.markets;
  state.discovery = {
    checkedAt: result.checkedAt,
    requestHash: result.requestHash,
  };
  state.error = undefined;
  save();
  return result;
}
export async function setupCollateral() {
  if (!state.deployment?.tokenAddress) {
    const receipt = await deploy("setup:collateral", "TestCollateral");
    state.deployment = {
      tokenAddress: receipt.contractAddress,
      network: "Base Sepolia",
      chainId: 84532,
      transactionHash: receipt.transactionHash,
    };
    save();
  }
  for (const role of ["buyer", "counterparty"])
    await write(
      `setup:mint:${role}`,
      "deployer",
      state.deployment.tokenAddress,
      TOKEN_ABI,
      "mint",
      [address(role), 5000000n],
    );
  state.deployment.complete = true;
  save();
  evidence("deployment.json", state.deployment);
  return state.deployment;
}
export async function compose(objective: string) {
  if (
    state.markets.filter(
      (m) => m.eligible && Date.parse(m.endDate) > Date.now() + 180000,
    ).length < 2
  )
    await discoverMarkets();
  const proposal: any = await propose(objective, state.markets);
  proposal.sourceMarkets = proposal.marketIds.map((id: string) =>
    state.markets.find((m) => m.id === id),
  );
  state.proposal = proposal;
  state.proposals.push(proposal);
  save();
  try {
    await prepareProposal(proposal);
    return proposal;
  } catch (error) {
    proposal.error = cleanError(error);
    save();
    throw error;
  }
}
export async function prepareProposal(proposal: any) {
  if (proposal.ready && proposal.revision === 2) return;
  if (proposal.contractAddress && proposal.revision !== 2) {
    proposal.previousDeployments = [
      ...(proposal.previousDeployments || []),
      {
        address: proposal.contractAddress,
        transactionHash: proposal.deploymentTx,
        reason: "Unfunded initial revision, replaced before mandate",
      },
    ];
    delete proposal.contractAddress;
    proposal.ready = false;
  }
  await setupCollateral();
  const recovered = await reconcile(`proposal:${proposal.id}:initialize-v2`);
  if (recovered) {
    proposal.initializationTx = recovered.transactionHash;
    proposal.ready = true;
    proposal.revision = 2;
    proposal.error = undefined;
    save();
    evidence(`policy-${proposal.id}.json`, proposal);
    return;
  }
  proposal.revision = 2;
  save();
  const sourceProofs = [];
  const sources = [];
  for (let i = 0; i < 2; i++) {
    const id = proposal.marketIds[i];
    const { response, data } = await createProof(id);
    sourceProofs.push(proofArgs(response));
    const m =
      proposal.sourceMarkets?.find((m: any) => m.id === id) ||
      state.markets.find((m) => m.id === id);
    sources.push({
      marketId: id,
      conditionId: data.conditionId,
      outcomesHash: outcomeHash(m.outcomes),
      createRequestHash: deriveRequestHash(requestFor(id)),
      settlementRequestHash: deriveRequestHash(requestFor(id, true)),
      signer: AIRNODE,
      selectedOutcome: proposal.selectedOutcomeIndexes[i],
      endTime: BigInt(Math.floor(Date.parse(data.endDate) / 1000)),
    });
  }
  const endTimes = sources.map((s) => Number(s.endTime));
  const policy = {
    sources,
    operatorIsOr: proposal.operator === "OR",
    tradeClosesAt: BigInt(Math.min(...endTimes) - 45),
    deadline: BigInt(Math.max(...endTimes) + 1800),
    maxEnvelopeAge: MAX_ENVELOPE_AGE,
    maxSourceAge: MAX_SOURCE_AGE,
  };
  proposal.policy = JSON.parse(
    JSON.stringify(policy, (_, v) =>
      typeof v === "bigint" ? v.toString() : v,
    ),
  );
  proposal.policyHash = keccak256(toHex(JSON.stringify(proposal.policy)));
  save();
  const receipt = await deploy(
    `proposal:${proposal.id}:deploy-v2`,
    "SecondOrderMarket",
    [state.deployment!.tokenAddress, policy],
  );
  proposal.contractAddress = receipt.contractAddress;
  proposal.deploymentTx = receipt.transactionHash;
  save();
  const init = await write(
    `proposal:${proposal.id}:initialize-v2`,
    "deployer",
    receipt.contractAddress!,
    marketAbi(),
    "initialize",
    [sourceProofs],
  );
  proposal.initializationTx = init.transactionHash;
  proposal.ready = true;
  proposal.revision = 2;
  proposal.error = undefined;
  save();
  evidence(`policy-${proposal.id}.json`, proposal);
}
export async function authorize(
  proposalId: string,
  side: string,
  stakeUnits: string,
) {
  const p = state.proposals.find((p) => p.id === proposalId);
  if (!p?.ready || !p.contractAddress)
    throw Error("Compose an initialized market first");
  if (side !== "YES" && side !== "NO") throw Error("Choose YES or NO");
  if (
    !/^\d+$/.test(stakeUnits) ||
    BigInt(stakeUnits) < 1n ||
    BigInt(stakeUnits) > BigInt(config.maxStakeUnits)
  )
    throw Error(
      "Stake must be an integer between 1 and 5000000 SOU base units",
    );
  if (Date.now() / 1000 >= Number(p.policy.tradeClosesAt) - 10)
    throw Error("This basket has closed for funding; compose a new one");
  const existing = state.intents.find((i) => i.proposalId === proposalId);
  if (existing) return existing;
  const intent = {
    id: crypto.randomUUID(),
    proposalId,
    proposal: p,
    sourceMarkets:
      p.sourceMarkets ||
      p.marketIds.map((id: string) => state.markets.find((m) => m.id === id)),
    marketId: p.contractAddress,
    contractAddress: p.contractAddress,
    status: "authorizing",
    side,
    stakeUnits,
    createdAt: new Date().toISOString(),
    steps: [],
    sources: p.marketIds.map((id: string) => ({
      id,
      status: "Awaiting finality",
    })),
    mandate: {
      network: "Base Sepolia",
      chainId: 84532,
      asset: state.deployment!.tokenAddress,
      tokenSymbol: "SOU",
      recipient: p.contractAddress,
      beneficiary: address("buyer"),
      payer: address("buyer"),
      side,
      perAction: stakeUnits,
      total: stakeUnits,
      maxActions: 1,
      expiresAt: Math.min(
        Number(p.policy.tradeClosesAt),
        Math.floor(Date.now() / 1000) + 3600,
      ),
      fundingExpiresAt: Math.min(
        Number(p.policy.tradeClosesAt),
        Math.floor(Date.now() / 1000) + 3600,
      ),
      automationExpiresAt: Number(p.policy.deadline) + 600,
      maxAgentTransactions: 8,
      gasCapWei: config.gasCapWei,
      totalGasCapWei: config.totalGasCapWei,
      apiFeeUnits: "0",
      limits:
        "Spend, recipient, beneficiary, expiry and intent enforced on chain; gas caps enforced in local executor",
    },
  };
  state.intents.unshift(intent);
  step(
    intent,
    "Mandate accepted",
    "One immutable market, one position, fixed beneficiary. No new authorization is needed for bounded funding and delivery.",
  );
  save();
  return intent;
}
async function fundingSteps(intent: any) {
  const p = state.proposals.find((p) => p.id === intent.proposalId);
  const contract = p.contractAddress as Address;
  const abi = marketAbi();
  const amount = BigInt(intent.stakeUnits);
  for (const role of ["buyer", "counterparty"]) {
    const recoveredFund = await reconcile(`${intent.id}:${role}:fund`);
    if (recoveredFund) {
      await syncIntent(intent);
      recordTx(
        intent,
        role === "buyer"
          ? "Agent funded position"
          : "Counterparty funded opposite side",
        recoveredFund,
      );
      continue;
    }
    const existing = (await read(contract, abi, "stakes", [address(role)])) as [
      bigint,
      boolean,
    ];
    if (existing[0] > 0n) continue;
    const side =
      role === "buyer" ? intent.side === "YES" : intent.side !== "YES";
    const expiry = BigInt(intent.mandate.expiresAt);
    const receiptA = await write(
      `${intent.id}:${role}:authorize`,
      role,
      contract,
      abi,
      "authorize",
      [address(role), side, amount, amount, 1, expiry],
    );
    recordTx(intent, `${role} mandate`, receiptA);
    const receiptB = await write(
      `${intent.id}:${role}:approve`,
      role,
      state.deployment!.tokenAddress,
      TOKEN_ABI,
      "approve",
      [contract, amount],
    );
    recordTx(intent, `${role} allowance`, receiptB);
    const prior = await reconcile(`${intent.id}:${role}:fund`);
    if (prior) {
      await syncIntent(intent);
      recordTx(
        intent,
        role === "buyer"
          ? "Agent funded position"
          : "Counterparty funded opposite side",
        prior,
      );
      continue;
    }
    const fresh = await Promise.all(
      p.marketIds.map((id: string) => createProof(id)),
    );
    intent.status = "funding";
    save();
    const fundId = keccak256(toHex(`${intent.id}:${role}:fund`));
    const receiptC = await write(
      `${intent.id}:${role}:fund`,
      role,
      contract,
      abi,
      "fund",
      [fundId, amount, fresh.map((f) => proofArgs(f.response))],
    );
    await syncIntent(intent);
    recordTx(
      intent,
      role === "buyer"
        ? "Agent funded position"
        : "Counterparty funded opposite side",
      receiptC,
    );
  }
  intent.status = "waiting";
  save();
}
function recordTx(intent: any, action: string, r: any) {
  if (!intent.steps.some((s: any) => s.txHash === r.transactionHash))
    step(
      intent,
      action,
      "Confirmed on Base Sepolia",
      r.status === "success" ? "confirmed" : "rejected",
      r.transactionHash,
    );
}
export async function syncIntent(intent: any) {
  const contract = intent.contractAddress as Address;
  const m = (await read(contract, marketAbi(), "marketState")) as any;
  intent.buyerStakeUnits = (
    (await read(contract, marketAbi(), "stakes", [address("buyer")])) as any
  )[0].toString();
  intent.reserveUnits = m.reserve.toString();
  intent.yesStakeUnits = m.yesStake.toString();
  intent.noStakeUnits = m.noStake.toString();
  intent.phase = Number(m.phase);
  intent.result = Number(m.phase) === 2 ? (m.result ? "YES" : "NO") : null;
  intent.sources = intent.sources.map((s: any, i: number) => ({
    ...s,
    message: m.sourceFinal[i] ? undefined : s.message,
    status: m.sourceFinal[i]
      ? "Final — " +
        (m.sourceSelectedWon[i]
          ? "selected outcome won"
          : "selected outcome lost")
      : "Awaiting finality",
  }));
  intent.buyerBalanceUnits = (
    (await read(state.deployment!.tokenAddress, TOKEN_ABI, "balanceOf", [
      address("buyer"),
    ])) as bigint
  ).toString();
  intent.counterpartyBalanceUnits = (
    (await read(state.deployment!.tokenAddress, TOKEN_ABI, "balanceOf", [
      address("counterparty"),
    ])) as bigint
  ).toString();
  save();
  return m;
}
export async function runIntent(intent: any) {
  try {
    const pExpiry = state.proposals.find((p) => p.id === intent.proposalId);
    if (
      Math.floor(Date.now() / 1000) >=
      (intent.mandate.automationExpiresAt ||
        Number(pExpiry.policy.deadline) + 600)
    ) {
      const expiredState = await syncIntent(intent);
      const stakes = (await Promise.all(
        ["buyer", "counterparty"].map((role) =>
          read(intent.contractAddress, marketAbi(), "stakes", [address(role)]),
        ),
      )) as any[];
      const delivered =
        [2, 3].includes(Number(expiredState.phase)) &&
        stakes.every((s) => s[0] === 0n || s[1]);
      intent.status = delivered
        ? Number(expiredState.phase) === 3
          ? "refunded"
          : "claimed"
        : "delegation expired";
      intent.error = delivered
        ? undefined
        : "Delegation expired. No new transaction will be signed. Permissionless claim/refund remains available through the judge script.";
      save();
      return intent;
    }
    let m = await syncIntent(intent);
    if (
      Number(m.phase) === 1 &&
      (intent.status === "authorizing" ||
        intent.status === "funding" ||
        intent.status === "recoverable")
    ) {
      await fundingSteps(intent);
      m = await syncIntent(intent);
    }
    const p = state.proposals.find((p) => p.id === intent.proposalId);
    if (Number(m.phase) === 1) {
      if (Math.floor(Date.now() / 1000) >= Number(p.policy.deadline)) {
        const r = await write(
          `${intent.id}:void`,
          "buyer",
          intent.contractAddress,
          marketAbi(),
          "voidExpired",
        );
        recordTx(intent, "Agent voided expired basket", r);
      } else {
        for (let i = 0; i < 2; i++) {
          if (m.sourceFinal[i]) continue;
          try {
            const prior = await reconcile(`${intent.id}:settlement:${i}`);
            if (prior) {
              recordTx(intent, `Agent submitted source ${i + 1}`, prior);
              continue;
            }
            const { response, data } = await settlementProof(p.marketIds[i]);
            evidence(`settlement-${intent.id}-${i}.json`, {
              request: requestFor(p.marketIds[i], true),
              response,
              data,
            });
            const r = await write(
              `${intent.id}:settlement:${i}`,
              "buyer",
              intent.contractAddress,
              marketAbi(),
              "submitEvidence",
              [i, proofArgs(response)],
            );
            await syncIntent(intent);
            recordTx(intent, `Agent submitted source ${i + 1}`, r);
            intent.sources[i].updatedAt = data.updatedAt;
          } catch (error) {
            intent.sources[i].lastCheck = new Date().toISOString();
            intent.sources[i].message = cleanError(error);
          }
        }
      }
      m = await syncIntent(intent);
    }
    if (Number(m.phase) === 2 || Number(m.phase) === 3) {
      for (const role of ["buyer", "counterparty"]) {
        const label =
          Number(m.phase) === 3
            ? role === "buyer"
              ? "Agent returned buyer stake"
              : "Counterparty recovered stake"
            : role === "buyer"
              ? "Agent delivered buyer result"
              : "Counterparty collected result";
        const priorClaim = await reconcile(`${intent.id}:claim:${role}`);
        if (priorClaim) {
          recordTx(intent, label, priorClaim);
          recordClaim(intent, role, priorClaim);
          continue;
        }
        const stake = (await read(
          intent.contractAddress,
          marketAbi(),
          "stakes",
          [address(role)],
        )) as any;
        if (stake[0] > 0n && !stake[1]) {
          const receipt = await write(
            `${intent.id}:claim:${role}`,
            role,
            intent.contractAddress,
            marketAbi(),
            "claim",
            [address(role)],
          );
          await syncIntent(intent);
          recordTx(intent, label, receipt);
          recordClaim(intent, role, receipt);
        } else if (stake[1] && !intent.deliveries?.[role]) {
          const deployRecord = transactions().find(
            (t) => t.id === `proposal:${intent.proposalId}:deploy-v2`,
          );
          const logs = await client.getLogs({
            address: intent.contractAddress,
            event: parseAbiItem(
              "event Claimed(address indexed payer,address indexed beneficiary,uint256 amount,bool refund)",
            ),
            args: { payer: address(role) },
            fromBlock: BigInt(deployRecord?.blockNumber || 0),
            toBlock: "latest",
          });
          for (const log of logs)
            recordClaim(intent, role, {
              transactionHash: log.transactionHash,
              logs: [log],
            });
        }
      }
      intent.status = Number(m.phase) === 3 ? "refunded" : "claimed";
      await syncIntent(intent);
      evidence(`intent-${intent.id}.json`, intent);
    }
    intent.error = undefined;
    save();
    return intent;
  } catch (error) {
    intent.error = cleanError(error);
    intent.status = ["authorizing", "funding"].includes(intent.status)
      ? "recoverable"
      : intent.status;
    save();
    throw error;
  }
}
function recordClaim(intent: any, role: string, receipt: any) {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== intent.contractAddress.toLowerCase())
      continue;
    try {
      const decoded = decodeEventLog({
        abi: marketAbi(),
        data: log.data,
        topics: log.topics,
      }) as any;
      if (
        decoded.eventName === "Claimed" &&
        decoded.args.payer.toLowerCase() === address(role).toLowerCase()
      ) {
        intent.deliveries ||= {};
        intent.deliveries[role] = {
          amountUnits: decoded.args.amount.toString(),
          beneficiary: decoded.args.beneficiary,
          payer: decoded.args.payer,
          refund: decoded.args.refund,
          transactionHash: receipt.transactionHash,
        };
        if (role === "buyer")
          intent.payoutUnits = decoded.args.amount.toString();
        save();
      }
    } catch {}
  }
}
export async function submitEvidence(
  contract: string,
  sourceIndex: number,
  envelope: any,
) {
  const intent = state.intents.find(
    (i) => i.contractAddress.toLowerCase() === contract.toLowerCase(),
  );
  if (!intent || ![0, 1].includes(sourceIndex))
    throw Error("Unknown market or source");
  const { timestamp, data, signature } = envelope;
  if (
    typeof data !== "string" ||
    typeof timestamp !== "string" ||
    !/^\d+$/.test(timestamp) ||
    typeof signature !== "string" ||
    !/^0x[0-9a-fA-F]{130}$/.test(signature) ||
    data.length > 12000
  )
    throw Error("Malformed envelope");
  const key = keccak256(
    toHex(JSON.stringify([sourceIndex, timestamp, data, signature])),
  );
  const r = await write(
    `${intent.id}:judge:${key}`,
    "deployer",
    intent.contractAddress,
    marketAbi(),
    "submitEvidence",
    [sourceIndex, proofArgs(envelope)],
  );
  recordTx(intent, "Submitted external evidence", r);
  await syncIntent(intent);
  return { txHash: r.transactionHash };
}
function revertName(error: any): string | undefined {
  const e =
    typeof error?.walk === "function"
      ? error.walk((v: any) => v.name === "ContractFunctionRevertedError")
      : error;
  return e?.data?.errorName;
}
export async function tamperChecks(intent: any) {
  const p = state.proposals.find((p) => p.id === intent.proposalId);
  const abi = marketAbi();
  const before = await read(intent.contractAddress, abi, "marketState");
  const checks: any[] = [];
  const savedPath = path.join(root, "evidence", `open-proof-${intent.id}.json`);
  const open = await createProof(p.marketIds[0]).catch((error) => {
    if (!fs.existsSync(savedPath)) throw error;
    const response = JSON.parse(fs.readFileSync(savedPath, "utf8")).response;
    return { response, data: JSON.parse(response.data) };
  });
  const proof = proofArgs(open.response);
  evidence(`open-proof-${intent.id}.json`, {
    request: requestFor(p.marketIds[0]),
    response: open.response,
  });
  const wrong = await createProof(p.marketIds[1]).catch((error) => {
    const response = intent.sourceMarkets?.find(
      (m: any) => m.id === p.marketIds[1],
    )?.createEnvelope;
    if (!response) throw error;
    return { response, data: JSON.parse(response.data) };
  });
  const arbitrary = privateKeyToAccount(generatePrivateKey());
  const digest = keccak256(
    encodePacked(
      ["bytes32", "uint256", "bytes"],
      [p.policy.sources[0].createRequestHash, proof.timestamp, proof.data],
    ),
  );
  const signature = await arbitrary.signMessage({ message: { raw: digest } });
  const tests: any[] = [
    {
      name: "Edited value",
      proof: {
        ...proof,
        data: toHex(open.response.data.replace("false", "true")),
      },
      expected: "NotSignedByAirnode",
    },
    {
      name: "Different request",
      proof: proofArgs(wrong.response),
      expected: "NotSignedByAirnode",
    },
    {
      name: "Wrong signer",
      proof: { ...proof, signature },
      expected: "NotSignedByAirnode",
    },
  ];
  const discovered = JSON.parse(
    fs.readFileSync(
      path.join(root, "evidence", "latest-discovery.json"),
      "utf8",
    ),
  );
  const old =
    intent.sourceMarkets?.find((m: any) => m.id === p.marketIds[0])
      ?.createEnvelope ||
    discovered.markets.find((m: any) => m.id === p.marketIds[0])
      ?.createEnvelope;
  if (
    old &&
    Number(old.timestamp) + MAX_ENVELOPE_AGE < Math.floor(Date.now() / 1000)
  ) {
    tests.push({
      name: "Stale real response",
      proof: proofArgs(old),
      expected: "ResponseTooOld",
    });
  } else
    checks.push({
      name: "Stale real response",
      status: "PENDING",
      message:
        "Wait until a saved authentic same-request envelope exceeds the immutable 300-second age, then retry",
    });
  for (const test of tests) {
    try {
      await client.readContract({
        address: intent.contractAddress,
        abi,
        functionName: "validateOpenProof",
        args: [0, test.proof],
      });
      checks.push({
        name: test.name,
        status: "FAIL",
        message: "Unexpectedly accepted",
      });
    } catch (error) {
      const actual = revertName(error);
      checks.push({
        name: test.name,
        status: actual === test.expected ? "PASS" : "FAIL",
        message: `Expected ${test.expected}; contract returned ${actual || cleanError(error)}`,
        mode: "RPC call to deployed shared proof guard; no transaction broadcast",
      });
    }
  }
  if (intent.phase === 1 && Date.now() / 1000 < Number(p.policy.tradeClosesAt))
    for (const [name, id, amount, expected] of [
      [
        "Duplicate intent",
        keccak256(toHex(`${intent.id}:buyer:fund`)),
        BigInt(intent.stakeUnits),
        "DuplicateIntent",
      ],
      [
        "Over budget",
        keccak256(toHex(`${intent.id}:over-budget`)),
        BigInt(intent.stakeUnits) + 1n,
        "BudgetExceeded",
      ],
    ] as const) {
      try {
        await client.simulateContract({
          address: intent.contractAddress,
          abi,
          functionName: "fund",
          args: [id, amount, [proof, proofArgs(wrong.response)]],
          account: address("buyer"),
        });
        checks.push({ name, status: "FAIL", message: "Unexpected acceptance" });
      } catch (error) {
        const actual = revertName(error);
        checks.push({
          name,
          status: actual === expected ? "PASS" : "FAIL",
          message: `Expected ${expected}; contract returned ${actual || cleanError(error)}`,
          mode: "RPC simulation on deployed funding path",
        });
      }
    }
  if (
    !(intent.phase === 1 && Date.now() / 1000 < Number(p.policy.tradeClosesAt))
  )
    for (const name of ["Duplicate intent", "Over budget"]) {
      const previous = state.evidence.checks.find((c: any) => c.name === name);
      if (previous)
        checks.push({
          ...previous,
          mode: "Recorded funding-phase RPC check; current trading window has ended",
        });
    }
  const after = await read(intent.contractAddress, abi, "marketState");
  checks.push({
    name: "Protected state unchanged",
    status:
      JSON.stringify(before, (_, v) =>
        typeof v === "bigint" ? v.toString() : v,
      ) ===
      JSON.stringify(after, (_, v) =>
        typeof v === "bigint" ? v.toString() : v,
      )
        ? "PASS"
        : "FAIL",
    message:
      "Reserve and source state compared before and after read-only rejection checks",
  });
  state.evidence = {
    checks,
    marketId: intent.contractAddress,
    checkedAt: new Date().toISOString(),
  } as any;
  save();
  evidence(`rejections-${intent.id}.json`, {
    marketId: intent.contractAddress,
    intentId: intent.id,
    network: "Base Sepolia",
    chainId: 84532,
    checkedAt: new Date().toISOString(),
    checks,
    before,
    after,
  });
  return checks;
}
export function publicState() {
  let addresses: any = {};
  try {
    addresses = {
      buyerAddress: address("buyer"),
      counterpartyAddress: address("counterparty"),
      deployerAddress: address("deployer"),
    };
  } catch {}
  return {
    ...state,
    markets: state.markets.map(({ createEnvelope, ...m }) => {
      const valid =
        m.eligible &&
        Date.parse(m.endDate) > Date.now() &&
        Date.now() - Date.parse(m.updatedAt) <= MAX_SOURCE_AGE * 1000;
      return {
        ...m,
        eligible: valid,
        eligibilityReason: valid
          ? undefined
          : m.eligibilityReason ||
            "Source window ended or snapshot is stale. Refresh for current markets.",
      };
    }),
    proposals: undefined,
    network: {
      name: "Base Sepolia",
      chainId: 84532,
      explorer: "https://sepolia.basescan.org",
    },
    config: {
      ...config,
      ...addresses,
      tokenAddress: state.deployment?.tokenAddress,
      contractAddress: state.proposal?.contractAddress,
    },
    transactions: transactions(),
  };
}
