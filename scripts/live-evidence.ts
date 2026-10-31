import { acquireExecutor } from "../src/chain.ts";
import {
  authorize,
  runIntent,
  tamperChecks,
  publicState,
} from "../src/engine.ts";
import { state } from "../src/store.ts";
acquireExecutor();
if (!state.proposal?.ready)
  throw Error("Run npm run deploy or compose through the UI first");
const intent =
  state.intents[0] || (await authorize(state.proposal.id, "YES", "1000000"));
await runIntent(intent);
console.log({
  intent: intent.id,
  status: intent.status,
  contract: intent.contractAddress,
  reserveUnits: intent.reserveUnits,
});
