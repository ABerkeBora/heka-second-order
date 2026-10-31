import { acquireExecutor } from "../src/chain.ts";
import { setupCollateral, prepareProposal, compose } from "../src/engine.ts";
import { state } from "../src/store.ts";
acquireExecutor();
await setupCollateral();
if (state.proposal) await prepareProposal(state.proposal);
else await compose("Combine two upcoming upside outcomes using AND.");
console.log({
  token: state.deployment?.tokenAddress,
  market: state.proposal?.contractAddress,
  proposal: state.proposal?.id,
});
