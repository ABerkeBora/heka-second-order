import fs from "node:fs";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
export const root = path.resolve(import.meta.dirname, "..");
// The executor/PID lock remains global: both namespaces share funded test roles and nonces.
export const runtime = path.join(root, ".runtime");
export type StoreNamespace = "v1" | "next" | "bsv" | "bsv-native";
const context = new AsyncLocalStorage<StoreNamespace>();
export function storeNamespace(): StoreNamespace {
  return context.getStore() || "v1";
}
export function withStore<T>(namespace: StoreNamespace, fn: () => T): T {
  if (
    namespace !== "v1" &&
    namespace !== "next" &&
    namespace !== "bsv" &&
    namespace !== "bsv-native"
  )
    throw Error("Unknown Second Order store namespace");
  return context.run(namespace, fn);
}
export function runtimePath(): string {
  return storeNamespace() === "v1"
    ? runtime
    : path.join(runtime, storeNamespace());
}
export function evidenceDirectory(): string {
  return storeNamespace() === "v1"
    ? path.join(root, "evidence")
    : path.join(
        root,
        "evidence",
        storeNamespace() === "next" ? "v2" : storeNamespace(),
      );
}
export type AppState = {
  markets: any[];
  proposal?: any;
  proposals: any[];
  intents: any[];
  evidence: { checks: any[] };
  deployment?: any;
  updatedAt: string;
  error?: string;
  discovery?: any;
  intentReview?: any;
};
const states = new Map<StoreNamespace, AppState>();
function currentState(): AppState {
  const namespace = storeNamespace();
  let loaded = states.get(namespace);
  if (loaded) return loaded;
  const file = path.join(runtimePath(), "state.json");
  loaded = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : {
        markets: [],
        proposals: [],
        intents: [],
        evidence: { checks: [] },
        updatedAt: new Date().toISOString(),
      };
  if (loaded!.proposal)
    loaded!.proposals = loaded!.proposals.map((p) =>
      p.id === loaded!.proposal.id ? loaded!.proposal : p,
    );
  states.set(namespace, loaded!);
  return loaded!;
}
// Existing engine imports keep working while each request/async continuation resolves its own state.
export const state: AppState = new Proxy({} as AppState, {
  get: (_target, key) => Reflect.get(currentState(), key),
  set: (_target, key, value) => Reflect.set(currentState(), key, value),
  deleteProperty: (_target, key) => Reflect.deleteProperty(currentState(), key),
  has: (_target, key) => Reflect.has(currentState(), key),
  ownKeys: () => Reflect.ownKeys(currentState()),
  getOwnPropertyDescriptor: (_target, key) => {
    const descriptor = Reflect.getOwnPropertyDescriptor(currentState(), key);
    return descriptor ? { ...descriptor, configurable: true } : undefined;
  },
});
export function save() {
  const active = currentState();
  active.updatedAt = new Date().toISOString();
  const directory = runtimePath();
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, "state.json");
  fs.writeFileSync(file + ".tmp", JSON.stringify(active, null, 2), {
    mode: 0o600,
  });
  fs.renameSync(file + ".tmp", file);
}
export function evidence(name: string, data: any) {
  if (!name || name !== path.basename(name) || name === "." || name === "..")
    throw Error("Evidence must use a filename within its scoped directory");
  const dir = evidenceDirectory();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, name),
    JSON.stringify(
      data,
      (_, v) => (typeof v === "bigint" ? v.toString() : v),
      2,
    ) + "\n",
  );
}
let queue = Promise.resolve();
export function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  // One queue across v1 and next; registration captures the caller's ALS namespace.
  const namespace = storeNamespace();
  const p = queue.then(() => withStore(namespace, fn));
  queue = p.then(
    () => {},
    () => {},
  );
  return p;
}
export function step(
  intent: any,
  action: string,
  message: string,
  status = "confirmed",
  txHash?: string,
) {
  const item = {
    id: crypto.randomUUID(),
    action,
    message,
    status,
    txHash,
    timestamp: new Date().toISOString(),
  };
  intent.steps.push(item);
  save();
  return item;
}
export function cleanError(error: unknown) {
  const s = error instanceof Error ? error.message : String(error);
  return s
    .replace(/0x[0-9a-fA-F]{64}\b/g, "[transaction digest]")
    .slice(0, 700);
}
