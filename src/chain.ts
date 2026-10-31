import fs from "node:fs";
import path from "node:path";
import {
  createPublicClient,
  createWalletClient,
  http,
  toHex,
  encodeFunctionData,
  encodeDeployData,
  keccak256,
  parseAbi,
  parseTransaction,
  type Address,
  type Hex,
  type Abi,
  type TransactionReceipt,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { estimateL1Fee, estimateOperatorFee } from "viem/op-stack";
import { root, runtime, evidence, state } from "./store.ts";
export const client = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.RPC_URL || "https://sepolia.base.org", {
    timeout: 20000,
    retryCount: 2,
  }),
});
export const TOKEN_ABI = parseAbi([
  "function mint(address,uint256)",
  "function approve(address,uint256) returns(bool)",
  "function balanceOf(address) view returns(uint256)",
  "function allowance(address,address) view returns(uint256)",
]);
export function artifact(name: string) {
  return JSON.parse(
    fs.readFileSync(
      path.join(root, "out", `${name}.sol`, `${name}.json`),
      "utf8",
    ),
  );
}
export const marketAbi = () => artifact("SecondOrderMarket").abi as Abi;
let _roles: any;
export function roles() {
  if (_roles) return _roles;
  const file = process.env.WALLET_FILE;
  if (!file) throw Error("Set WALLET_FILE to the isolated test wallet JSON");
  if ((fs.statSync(file).mode & 0o077) !== 0)
    throw Error("Wallet file must be private (0600)");
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  if (
    j.testOnly !== true ||
    j.chainId !== 84532 ||
    j.project !== "second-order"
  )
    throw Error("Wallet is not scoped to Second Order Base Sepolia");
  for (const r of ["deployer", "buyer", "counterparty"]) {
    const account = privateKeyToAccount(j.roles[r].privateKey);
    if (account.address.toLowerCase() !== j.roles[r].address.toLowerCase())
      throw Error("Wallet role address mismatch");
  }
  return (_roles = j.roles);
}
export const address = (role: string) => roles()[role].address as Address;
const journalFile = path.join(runtime, "transactions.json");
const journal: Record<string, any> = fs.existsSync(journalFile)
  ? JSON.parse(fs.readFileSync(journalFile, "utf8"))
  : {};
function persist() {
  fs.writeFileSync(
    journalFile + ".tmp",
    JSON.stringify(
      journal,
      (_, v) => (typeof v === "bigint" ? v.toString() : v),
      2,
    ),
    { mode: 0o600 },
  );
  fs.renameSync(journalFile + ".tmp", journalFile);
}
export function transactions() {
  return Object.values(journal).map(({ raw, ...rest }) => rest);
}
let ownsLock = false;
function acquireLock() {
  if (ownsLock) return;
  const lock = path.join(runtime, "executor.lock");
  try {
    const pid = Number(fs.readFileSync(lock, "utf8"));
    try {
      process.kill(pid, 0);
      throw Error("Another Second Order executor is running; use its HTTP API");
    } catch (e: any) {
      if (e.code !== "ESRCH") throw e;
    }
    fs.unlinkSync(lock);
  } catch (e: any) {
    if (e.code !== "ENOENT") throw e;
  }
  fs.writeFileSync(lock, String(process.pid), { flag: "wx", mode: 0o600 });
  ownsLock = true;
  process.on("exit", () => {
    try {
      fs.unlinkSync(lock);
    } catch {}
  });
}
function checkDelegationTime(id: string) {
  const scope = state.intents.find((i) => i.id === id.split(":")[0]);
  if (!scope) return;
  const proposal = state.proposals.find((p) => p.id === scope.proposalId);
  const expiry =
    scope.mandate.automationExpiresAt ||
    (proposal ? Number(proposal.policy.deadline) + 600 : 0);
  if (!expiry || Math.floor(Date.now() / 1000) >= expiry)
    throw Error("Delegation expired; only receipt reconciliation is allowed");
}
export async function send(
  id: string,
  role: string,
  tx: { to?: Address; data: Hex },
  cap = 300000000000000n,
): Promise<TransactionReceipt> {
  acquireLock();
  if ((await client.getChainId()) !== 84532)
    throw Error("Only Base Sepolia is allowed");
  const fingerprint = keccak256(
    toHex(
      JSON.stringify({ role, to: tx.to?.toLowerCase() || null, data: tx.data }),
    ),
  );
  let entry = journal[id];
  if (entry) {
    const existingFingerprint = entry.fingerprint;
    if (existingFingerprint && existingFingerprint !== fingerprint)
      throw Error(
        "Intent transaction arguments changed; refusing to reuse journal entry",
      );
    if (!existingFingerprint) {
      const old = await client.getTransaction({ hash: entry.hash });
      if (
        old.input !== tx.data ||
        (old.to?.toLowerCase() || null) !== (tx.to?.toLowerCase() || null) ||
        entry.role !== role
      )
        throw Error("Legacy transaction journal mismatch");
      entry.fingerprint = fingerprint;
      persist();
    }
  }
  if (!entry) {
    checkDelegationTime(id);
    const account = privateKeyToAccount(roles()[role].privateKey);
    const wallet = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(process.env.RPC_URL || "https://sepolia.base.org"),
    });
    const prepared = await wallet.prepareTransactionRequest({
      ...tx,
      account,
      chain: baseSepolia,
      type: "eip1559",
    });
    const [l1Fee, operatorFee] = await Promise.all([
      estimateL1Fee(client, { ...prepared, account }),
      estimateOperatorFee(client, { ...prepared, account }),
    ]);
    const maximum =
      prepared.gas * (prepared.maxFeePerGas ?? prepared.gasPrice ?? 0n) +
      2n * (l1Fee + operatorFee);
    const group = id.split(":")[0];
    const reserved = Object.values(journal)
      .filter((e) => e.role === role && e.id.startsWith(group + ":"))
      .reduce((sum, e) => sum + BigInt(e.maxGasCostWei), 0n);
    if (
      !["setup", "proposal"].includes(group) &&
      Object.values(journal).filter(
        (e) => e.role === role && e.id.startsWith(group + ":"),
      ).length >= 8
    )
      throw Error("Delegation maximum transaction count exhausted");
    if (
      !["setup", "proposal"].includes(group) &&
      reserved + maximum > 1500000000000000n
    )
      throw Error("Total intent gas budget exhausted; no top-up");
    if (maximum > cap) throw Error("Action exceeds the app-enforced gas cap");
    checkDelegationTime(id);
    const raw = await wallet.signTransaction(prepared);
    entry = journal[id] = {
      id,
      fingerprint,
      role,
      from: account.address,
      to: tx.to || null,
      hash: keccak256(raw),
      raw,
      maxGasCostWei: maximum.toString(),
      status: "prepared",
      createdAt: new Date().toISOString(),
    };
    persist();
  }
  let receipt = await client
    .getTransactionReceipt({ hash: entry.hash })
    .catch(() => null);
  if (!receipt) {
    checkDelegationTime(id);
    try {
      await client.sendRawTransaction({ serializedTransaction: entry.raw });
      entry.status = "submitted";
      persist();
    } catch (error) {
      const exists = await client
        .getTransaction({ hash: entry.hash })
        .catch(() => null);
      if (!exists) throw error;
    }
    receipt = await client.waitForTransactionReceipt({
      hash: entry.hash,
      timeout: 55000,
      pollingInterval: 1500,
    });
  }
  entry.status = receipt.status;
  entry.blockNumber = receipt.blockNumber.toString();
  entry.gasUsed = receipt.gasUsed.toString();
  entry.effectiveGasPrice = receipt.effectiveGasPrice.toString();
  const rawReceipt = (await client.request({
    method: "eth_getTransactionReceipt",
    params: [entry.hash],
  })) as any;
  entry.l1FeeWei = BigInt(rawReceipt.l1Fee || "0").toString();
  entry.gasCostWei = (
    receipt.gasUsed * receipt.effectiveGasPrice +
    BigInt(entry.l1FeeWei)
  ).toString();
  entry.contractAddress = receipt.contractAddress;
  entry.confirmedAt = new Date().toISOString();
  persist();
  evidence("transactions.json", transactions());
  if (receipt.status !== "success")
    throw Error(`Transaction reverted: ${entry.hash}`);
  return receipt;
}
export async function write(
  id: string,
  role: string,
  contract: Address,
  abi: Abi,
  functionName: string,
  args: readonly unknown[] = [],
  cap?: bigint,
) {
  return send(
    id,
    role,
    { to: contract, data: encodeFunctionData({ abi, functionName, args }) },
    cap,
  );
}
export async function deploy(
  id: string,
  contract: string,
  args: readonly unknown[] = [],
) {
  const a = artifact(contract);
  return send(
    id,
    "deployer",
    {
      data: encodeDeployData({ abi: a.abi, bytecode: a.bytecode.object, args }),
    },
    1000000000000000n,
  );
}
export const read = (
  contract: Address,
  abi: Abi,
  functionName: string,
  args: readonly unknown[] = [],
) => client.readContract({ address: contract, abi, functionName, args });

export async function reconcile(id: string) {
  const entry = journal[id];
  if (!entry) return null;
  const tx = parseTransaction(entry.raw);
  return send(id, entry.role, {
    to: tx.to ?? undefined,
    data: tx.data || "0x",
  });
}

export const acquireExecutor = acquireLock;
