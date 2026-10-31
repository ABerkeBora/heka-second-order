# Second Order implementation instructions

This repository is the independent Second Order application. The user selected its implementation on 31 October 2026, with an 08:00–09:00 Europe/Berlin review target. Historical preparation wording in HANDOFF.md is superseded by that authorization. Current evidence and remaining work are in TRACK_REQUIREMENTS.md, BUILD_STATUS.md and MORNING_HANDOFF.md.

## Scope and isolation

- Work only in this repository. In the original workspace it is `/Users/wargly/Documents/ChatGPT/Heka/projects/second-order`; do not change sibling projects, shared model services or the parent repository. Use explicit absolute working directories.
- The app owns localhost port3101 and Base Sepolia chain84532. Only worthless test collateral and test ETH are authorized. No mainnet, real Polymarket orders, paid services, hosted website or competition submission is authorized.
- Keep the product bounded to two binary Polymarket records and AND/OR. Do not add a bridge, order book, leverage or arbitrary endpoint/contract execution.
- Source publication to the separate public ABerkeBora/heka-second-order repository is authorized after a secrets/private-data scan. Verify Git root, repository-local author/committer identity and the correct account email/noreply mapping before commits. Never change global Git identity. Default branch for this build is codex/build.

## Official track gates

- Selected partner track: API3. BSV did not pass its conditional technical gate (docs/BSV_GATE.md) and must not be claimed. Cardano is outside scope.
- Before changing integration design, read the actual API3 tab at https://hackathon.tum-blockchain.com/prizes#api3 and general rules at https://hackathon.tum-blockchain.com/prizes#how-to-submit. A URL fragment alone may still expose the default BSV text: select the tab and expand submission/judging sections in a real browser.
- Read the linked official starter/guide, record Europe/Berlin check time and reconcile TRACK_REQUIREMENTS.md. Recheck before claiming readiness. Give every mandatory item PASS/PENDING/FAIL/BLOCKED with actual evidence. A fixture or plan cannot satisfy a deployed integration item.
- Keep the public checklist self-contained. Runtime/build/setup must not depend on parent Heka files.

## Data and settlement authority

- Use the pinned Airnode signer and exact `getMarketById` creation/settlement projections. Pin IDs, condition IDs, ordered outcome labels, selected indexes, both request hashes, signer, operator, timing and void rule before funds enter.
- Preserve raw signed data bytes. Verify signer/request independently off-chain and in the deployed contract. Check envelope time and upstream updatedAt separately. A new signature does not refresh stale source facts.
- Creation/funding requires both sources currently open. Settlement needs explicit closed/resolved records with exact one-hot terminal strings. Near-one quotes, an unsigned HTTP400 or missing finality cannot select a winner or release collateral. Invalid/split data reverts; only the fixed deadline enables the timeout refund.
- First authenticated final source halts trading. Settlement/claims execute once, per-market reserve accounting uses integers, fixed beneficiaries receive delivery, and no administrator can withdraw protected reserves.
- Source attribution is not upstream truth, source-cache consistency or profitability. Explain these trust assumptions honestly.

## Agent and payment constraints

- A real runtime LLM call is mandatory for basket proposal. Use the existing local Ollama/qwen3:4b by default; do not restart the shared service or download models. Bound calls/retries. No deterministic result may be presented as a model call.
- The model sees only bounded candidate data and a schema. It never sees keys, chooses destinations, writes calldata or decides settlement. A separate strict validator rejects unknown IDs, duplicates, invalid indexes/operators and unavailable sources.
- After the initial scoped mandate, the executor must actually fund an approved position and initiate evidence/collection/refund without manual payment clicks for each step. Identify buyer payer, market recipient, fixed beneficiary, asset/network, per-action/total collateral, gas/API budgets, action count and expiry.
- Separate on-chain funding limits from application-enforced gas/transaction-count/recovery-window limits. Funding cutoff and later automation expiry are different. Stop signing new actions at expiry/cap; never automatically top up.
- Journal exact raw transaction/hash before broadcast, bind ID to role/destination/calldata and reconcile before retries. On-chain intent/claim flags independently prevent double funding or delivery. Keep runtime history across restarts. Only one executor may own a runtime; use HTTP API while server runs.
- The counterparty is a separate seeded test role with its own funding and claim transactions. It is not customer demand, revenue or a second independent model agent. Free Gamma calls are not fabricated x402 purchases.

## Secrets and verification

- Keep .env, .runtime, .local and wallet files ignored and private. Never ask for keys/seed in chat or send them to a model. Original isolated wallet file is outside the app at `/Users/wargly/Documents/ChatGPT/Heka/.local/projects/second-order/test-wallets.json`; read only this project's roles. Fresh clones use their own WALLET_FILE as described in README.
- Validate testOnly, project, chain ID and role address/key mapping before use. Do not copy shared funding keys or another project's wallet.
- Run npm test, npm run test:recovery, forge test, npm run typecheck and npm run build as appropriate. Distinguish mock recovery, local historical signature replay, deployed RPC calls and real confirmed testnet transactions.
- Assert expected custom errors for all four tamper cases; an unrelated exhausted-budget or closed-phase revert is not a cryptographic rejection. Compare protected state/reserve before/after. Bind displayed check results to the exact market contract.
- UI language is English; morning handoff language is Turkish. Use the dark neutral/amber source-basket identity in web/DESIGN.md. Use the TasteSkill app-screen workflow when available. Inspect actual browser screenshots at1440/768/390; no fabricated balances/hashes/successes or dead controls. Preserve empty/loading/pending/confirmed/rejected/recoverable error states.
- Deliver README, .env.example, lockfiles, real network/contract/transaction evidence, a150-second presentation outline, submission draft and an honest morning handoff. Do not claim complete competition eligibility while the video or actual submission remains pending.
