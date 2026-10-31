import fs from "node:fs";
import path from "node:path";
export const root = path.resolve(import.meta.dirname, "..");
export const runtime = path.join(root, ".runtime");
fs.mkdirSync(runtime, { recursive: true, mode: 0o700 });
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
};
const file = path.join(runtime, "state.json");
export const state: AppState = fs.existsSync(file)
  ? JSON.parse(fs.readFileSync(file, "utf8"))
  : {
      markets: [],
      proposals: [],
      intents: [],
      evidence: { checks: [] },
      updatedAt: new Date().toISOString(),
    };
if (state.proposal)
  state.proposals = state.proposals.map((p) =>
    p.id === state.proposal.id ? state.proposal : p,
  );
export function save() {
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(file + ".tmp", JSON.stringify(state, null, 2), {
    mode: 0o600,
  });
  fs.renameSync(file + ".tmp", file);
}
export function evidence(name: string, data: any) {
  const dir = path.join(root, "evidence");
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
  const p = queue.then(fn);
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
