# Second Order

The isolated **BSV testnet experiment** is available at [localhost:3101/bsv](http://localhost:3101/bsv). Real collateral and conditional BSV payout are recorded in [BSV_HANDOFF.md](BSV_HANDOFF.md); current rules/evidence are in [TRACK_REQUIREMENTS_BSV.md](TRACK_REQUIREMENTS_BSV.md). `/` and `/next` retain the original EVM workflows. The BSV fallback uses an EVM original-envelope approval consumer plus an attestor. **Its test backend holds both attestor and seeded counterparty keys, so BSV non-custodial qualification is BLOCKED.** It is not a native/trustless API3-on-BSV implementation. No mainnet spending is enabled.

Give an agent a small test budget for a basket of two Polymarket outcomes. It proposes an **AND** or **OR** rule, funds the approved side, follows authenticated final records and initiates the payout or fixed-deadline refund.

Second Order runs locally on **http://localhost:3101**. It uses **Base Sepolia**, public-mint **Second Order Units (SOU)** collateral with six decimals and no economic value, and a real local Ollama model. It does not place orders on Polymarket. The selected Gamma operations are free; they are not represented as paid x402 calls.

## Two local versions

| Route | Behavior |
| --- | --- |
| [V1 — original flow](http://localhost:3101/) | Preserved reviewed-basket workflow and completed historical receipts. Immutable baseline: [`v1-baseline`](https://github.com/ABerkeBora/heka-second-order/tree/v1-baseline), commit `8bfd72c…`. |
| [V2 — exact target](http://localhost:3101/next) | Requires the requested assets, Up/Down directions, AND/OR and exact shared window. Unsupported or unavailable targets stop before deployment, minting or funding. Published branch: [`codex/next`](https://github.com/ABerkeBora/heka-second-order/tree/codex/next), working source `b84aa61…`. |

V1 and V2 have separate API, state, proposal/intent, journal, collateral and evidence namespaces. A single server process, global executor queue and PID lock serialize shared test-wallet nonces. Do not launch a second server for `/next`. V2 evidence lives in `evidence/v2/`; prior V1 records remain intact. See [V1 preservation](BASELINE_V1.md).

## V2: fund the target you actually requested

A prediction-market user should not receive exposure to a different asset because its requested event is missing. V2 compares a deterministic interpretation of the raw objective, the real model's structured normalization and the exact candidate records before any chain setup. The model cannot substitute Solana for a missing XRP event.

Use this narrow grammar:

```text
Ethereum Up OR Solana Up in the same next 5-minute window.
Bitcoin Down AND Ethereum Up in the same next 15-minute window.
```

Each of two different assets needs an explicit Up/Down direction, one AND/OR operator, and a 5-minute or 15-minute window. Supported aliases include BTC/Bitcoin, ETH/Ethereum, SOL/Solana, XRP, DOGE/Dogecoin, BNB, HYPE/Hyperliquid, ZEC/Zcash, ADA/Cardano, LTC/Litecoin and AVAX/Avalanche. Recognizing an asset name does not mean its event is available in the current bounded catalogue.

“Next” means the earliest jointly available **not-yet-started** interval for both assets in the supplied bounded discovery pool. It does not promise globally exhaustive Polymarket discovery. The matcher checks exact event title, asset identity, condition ID, Up/Down labels and selected indexes, title/slug duration and absolute endDate, canonical window alignment, shared interval and operator. The listing metadata and refreshed single-market source proofs are authenticated separately. Full grammar and limits: [INTENT_GRAMMAR](docs/INTENT_GRAMMAR.md).

Whole-week/continuous exposure, arbitrary thresholds, unknown events or an absent matching pair return **unsupported/no-action**, with a specific reason. They do not trigger a speculative deploy or collateral mint. A real model still normalizes and selects an accepted pair; its refusal, malformed output or disagreement with the independent checks also stops action. A model false negative may reject a feasible target; the application does not force acceptance with a deterministic substitute.

Inspect the exact normalized legs and policy before approving the bounded mandate. Changing the objective, using an old proposal/review ID or checking a new unsupported target invalidates the previous approval path. The backend independently enforces this; disabling a button is not the security boundary. Once the exact current review is authorized, the existing scoped executor funds and follows that fixed market without a fresh manual payment click at every step.

## Preserved V1 working flow

1. Load fresh source markets. Each candidate is independently checked against a signed single-market open record.
2. Ask the runtime LLM to compose exactly two allowed sources, selected outcomes and AND/OR. A deterministic validator rejects unknown IDs, invalid indexes, unsupported operators and unavailable records.
3. Inspect the source pair and four-row truth table. The application deploys and initializes that exact immutable policy before requesting a funding mandate. Deployment uses the separate test deployer role.
4. Authorize one bounded stake. The agent then sends the buyer's mandate, bounded token approval and real funding transaction without another payment click. A separate seeded test counterparty funds the opposite side through its own transactions.
5. The agent polls the fixed settlement requests. Only correctly signed, fresh, resolved, closed, one-hot outcome records can finalize sources. Both final sources determine the basket result. Missing, stale or ambiguous data cannot release collateral; the fixed timeout enables a refund.
6. The agent triggers delivery to the original beneficiary. Receipt reconciliation and on-chain intent/claim guards prevent duplicate economic execution.

The single funding-action limit is distinct from the recovery window. The mandate records a funding expiry, a later automation expiry, a maximum of eight agent transactions and separate collateral, data-fee and gas budgets. Stake/recipient/beneficiary/funding limits are enforced on-chain. Gas, transaction-count and automation-time limits are local-executor policy. No automatic top-up occurs.

## Run locally

Prerequisites: **Node.js 24+**, npm, Foundry (`forge`), and an Ollama server with `qwen3:4b`. Dependency versions and vendored Solidity sources are pinned in this repository. The compiler may need network access on its first run.

```bash
npm ci
forge build
cp .env.example .env
npm run dev
```

Open **http://localhost:3101/** for V1 or **http://localhost:3101/next** for V2. `npm run build && npm start` serves both production routes on the same port. The server binds to `127.0.0.1`; it is a local tool, not a hosted service.

Configure `.env`:

```dotenv
PORT=3101
RPC_URL=https://sepolia.base.org
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:4b
WALLET_FILE=/absolute/path/to/private/test-wallets.json
```

Keep the wallet JSON outside published source or inside ignored `.local/`. Set permissions to `0600`. Its required shape is:

```json
{
  "testOnly": true,
  "chainId": 84532,
  "project": "second-order",
  "roles": {
    "deployer": { "address": "YOUR_TEST_ADDRESS", "privateKey": "YOUR_TEST_KEY" },
    "buyer": { "address": "YOUR_TEST_ADDRESS", "privateKey": "YOUR_TEST_KEY" },
    "counterparty": { "address": "YOUR_TEST_ADDRESS", "privateKey": "YOUR_TEST_KEY" }
  }
}
```

Use three distinct, isolated test accounts. If you do not already have test roles, `npm run wallets:create` generates them offline in ignored `.local/test-wallets.json` with0600 permissions, refuses to overwrite an existing file and prints only public addresses. Set `WALLET_FILE` to that generated absolute path. The command does not fund accounts or contact a chain. Fund only with Base Sepolia test ETH; the [official CDP faucet](https://portal.cdp.coinbase.com/products/faucet) is one option. The reviewed setup started with 0.01 test ETH for deployment and 0.001 test ETH each for buyer and counterparty; actual gas varies. The application mints its worthless SOU collateral once per role and journals those setup transactions. The selected free data calls need no aUSD payment. Never use mainnet keys, enter keys in the UI, send them to the model or commit `.env`, wallet files or `.runtime/`.

Ollama must already be running at the configured address and serve the configured model. The application does not install models or stop/restart a shared runtime. It fails visibly if the real model call is unavailable; there is no deterministic substitute presented as an LLM call.

A fresh clone starts empty. Published evidence is a historical record, not a fixture inserted into live application state. For V1, use **Load source markets**, then **Ask agent to compose**. For V2, open `/next`, load current candidates and check an explicit supported target before reviewing its mandate. Time-sensitive source IDs from earlier runs must not be reused as upcoming events.

## Verify

```bash
npm test
npm run test:contracts
npm run test:recovery
npm run test:refund
npm run test:namespace
npm run test:next-gates
npm run typecheck
npm run build
```

`forge test` includes real saved Airnode signatures replayed locally at their historical timestamp, alongside deterministic accounting and adversarial tests. This local historical replay is distinct from the live Base Sepolia receipts.

The live **Inspect evidence** panel accepts a judge's raw response envelope and submits its signed `data` bytes to the selected deployed source. Preserve `data` as the exact string; parsing and reserializing it invalidates its signature. **Run checks** makes read-only RPC calls to the deployed shared proof guard for edited value, stale authentic response, different request and wrong signer. It asserts the expected custom error and compares protected state. Duplicate-intent and over-budget checks call the deployed funding path. These checks do not broadcast rejection transactions and do not claim to have paid revert gas.

Use only one executor process for a runtime directory. The server serializes writes and acquires a process lock. The scripts below are V1 command-line alternatives; stop the server before using them against the same runtime. Use the `/next` UI for V2 composition and initial authorization:

```bash
npm run deploy
npm run verify:live
```

`deploy` creates or reconciles the test collateral and current proposal, or calls the real model when none exists. Use the UI to compose a fresh future-window scenario after an old one closes. `verify:live` uses an existing initialized proposal, authorizes the bounded buyer test position if absent, and reconciles execution. These commands send real testnet transactions. Keep `.runtime/state.json` and `.runtime/transactions.json` across restarts; do not erase the journal to reset the screen or imply that chain history disappeared.

For a judge-supplied envelope, stop the server, preserve its runtime journal, and use:

```bash
# Passes exact data bytes to the fixed settlement guard without off-chain signature filtering.
node --env-file=.env scripts/submit-response.ts response.json 0 settlement
# Read-only shared open-proof guard, suitable for the four rejection cases.
node --env-file=.env scripts/submit-response.ts response.json 0 validate-open
```

Source index1 selects the other fixed source. `MARKET_ADDRESS` may explicitly select the recorded contract; otherwise the script selects the active intent. A saved old response is expected to fail freshness. For a new valid action, discover and initialize a fresh future market rather than representing historical records as current. Manual recovery after the automation window uses `scripts/submit-response.ts - 0 refund`, followed by `scripts/submit-response.ts - 0 claim`; the immutable deadline and beneficiary still apply. The script refuses mainnet through the same chain guard.

## V2 recorded integration — exact target funded, settled and collected

The exact target `Ethereum Up OR Solana Up in the same next 5-minute window.` passed deterministic catalogue preflight, a real `qwen3:4b` call (**17.259 seconds**) and independent model/source matching. It selected Ethereum `6406433` Up and Solana `6406432` Up for **31 October 2026, 04:05–04:10 UTC / 05:05–05:10 Europe/Berlin**.

V2 market: [0x7d34c8ac853eaceba1306f626420bc7fe36b3442](https://sepolia.basescan.org/address/0x7d34c8ac853eaceba1306f626420bc7fe36b3442), Base Sepolia 84532. Separate V2 SOU collateral: [0xac32bd83e88540c4509845ad7add0c3969d5df51](https://sepolia.basescan.org/address/0xac32bd83e88540c4509845ad7add0c3969d5df51). Proposal `9f16f2f2-3f6d-4bd1-a13f-022199fad70c`; intent `30e23be6-245b-42ee-ba34-3dd314aafe57`.

After one initial browser delegation, the agent [funded the buyer YES side with 1 SOU](https://sepolia.basescan.org/tx/0x20b50e2c70cb32247320c17f66984c3c12e30d6946dc75314bad85d569163abc); the separate test counterparty [funded NO with 1 SOU](https://sepolia.basescan.org/tx/0xb29698970677045a0676f2a18e817ef28a0e29eeb802aeab22d93dfd47fa075e). The historical funding snapshot records 11 setup/funding transactions and a 2 SOU reserve. **The completed V2 run now has 15 confirmed transactions, result YES, both claims completed and reserve zero.** Both selected Up outcomes won. After source updates at 04:12:27 UTC, the agent automatically submitted [Ethereum evidence](https://sepolia.basescan.org/tx/0x9392518fabcf764b3d502c197b27386f8695fee41b5f2629668f93e185fe784c) and [Solana evidence](https://sepolia.basescan.org/tx/0x245e4a22b735c519789e9491593c596362c8977b0ccc6eb5a5cc4329f9a69a44), then triggered the [buyer's 2 SOU claim](https://sepolia.basescan.org/tx/0x092db333e4deede2fa162482f50c4efb4d40e3eb2bcb05dd19d45a0f8609dbdf) and the [counterparty's 0 SOU claim](https://sepolia.basescan.org/tx/0xd48011163587b43935e6d92c70c85bcfd4f2eb5b8d62a04a21509346ea76513a). Final V2 token balances are 6/4 SOU; original V1 balances remain 5/5 with its 31-transaction history intact. All four recorded V2 deployed tamper cases, duplicate intent, over-budget and protected-state checks passed (7/7); read-only rejection calls did not consume a transaction fee. The current delivered state belongs in [MORNING_HANDOFF_V2](MORNING_HANDOFF_V2.md) and [TRACK_REQUIREMENTS_V2](TRACK_REQUIREMENTS_V2.md).

The public working source is [`b84aa61`](https://github.com/ABerkeBora/heka-second-order/commit/b84aa61a0dc2b73975c09f92d9f0280a91a13a8d). A clean GitHub checkout at that exact SHA passed npm install, typecheck, production/contract build and start on 3101. Direct `/`, `/next`, `/api/state` and `/api/next/state` all returned HTTP200; both namespaces started empty and all 41 code-manifest files matched. A hidden-checkout `/next` fallback failure was found, fixed and actually retested: [clean-clone evidence](evidence/v2/clean-clone.json). No private environment, wallet or published historical positions were copied into live state.

V2 evidence:

- [Completed intent, settlement and delivered result](evidence/v2/intent-30e23be6-245b-42ee-ba34-3dd314aafe57.json), [historical model normalization/funding snapshot](evidence/v2/funding-live.json), [runtime model output](evidence/v2/llm-intent-0698af68-c000-4c8f-8535-8c6ad65e6d2c.json), and [56-check deployed code/policy verification](evidence/v2/contract-verification.json).
- [Two actual HTTP no-action cases](evidence/v2/no-action-live.json): whole-week target and absent Cardano pair rejected before any deployment/mint/approval/fund; both namespaces' positions/receipts/collateral and native balances were unchanged.
- [Actual dirty-objective authorization HTTP400](evidence/v2/dirty-authorization-live.json): the old reviewed proposal could not fund a changed operator; journal and positions unchanged.
- [20 focused backend guard cases](evidence/v2/backend-gates.json) exercised copied production compose/authorize/preparation modules with dependency fixtures, including source drift before collateral setup. These are not live model or chain transactions.
- [Seven deployed rejection/protected-state checks](evidence/v2/rejections-30e23be6-245b-42ee-ba34-3dd314aafe57.json), [44 live isolation checks](evidence/v2/isolation-live.json) pinned at block 52492267, and [1440/768/390 production browser QA](evidence/v2/browser-qa.json) all passed. An invalid envelope was rejected inline without a transaction; V1 still showed its actual completed claim.
- [46 pure/unit tests](evidence/v2/unit-tests.txt), [namespace isolation regression](evidence/v2/namespace-test.json), [V1 compatibility/recovery/refund checks](evidence/v2/namespace-compatibility.json), and [actual funded restart reconciliation](evidence/v2/restart-funded-live.json) preserving the same 11 transactions and stake.

For a judge's V2 response, use its evidence panel, or stop the writer and select the namespace and contract explicitly:

```bash
APP_NAMESPACE=next MARKET_ADDRESS=0x7d34c8ac853eaceba1306f626420bc7fe36b3442 node --env-file=.env scripts/submit-response.ts response.json 0 validate-open
APP_NAMESPACE=next MARKET_ADDRESS=0x7d34c8ac853eaceba1306f626420bc7fe36b3442 node --env-file=.env scripts/submit-response.ts response.json 0 settlement
```

Preserve the exact signed data string. The first command is a read-only proof check; settlement sends a real testnet transaction and remains subject to the immutable policy and deadline. A historical response can correctly fail freshness. V1 success does not stand in for a new V2 tamper or payout result.

## V1 recorded integration

The final V1 acceptance run is the [Ethereum/Solana OR market](https://sepolia.basescan.org/address/0x9de37bba7dbc2cb50dffc1c77e6941e68e17356a) on **Base Sepolia84532**, using [six-decimal SOU collateral](https://sepolia.basescan.org/address/0x78f97e3b9b1b367f60355ddcc06fb157d7d33d08). Its initial mandate persisted the exact recipient/asset/beneficiary, one funding action, integer collateral caps, separate funding and automation expiries, eight-transaction limit and gas/data caps **before any funding action**.

The runtime model selected Up for Ethereum6406061 and Solana6406069 with OR. Its bounded pool lacked XRP; the model stated this and proposed Solana, and that exact policy was reviewed before the initial funding approval. V1 permits this reviewed alternative; the separately authorized V2 goal adds strict objective matching and no-action rejection rather than substitution.

The agent [funded the buyer1SOU](https://sepolia.basescan.org/tx/0x3bf41978c6469812f555b127e4a231bcc24ca89263249ef1b62615b530af8ef8); the separate test role [funded the opposite side1SOU](https://sepolia.basescan.org/tx/0xf1287b80e7b095956a21c8a1e5df1569b1e3f2d4da1cea95e6394ed01ef4360e). Both selected Up outcomes won. The agent submitted [source0](https://sepolia.basescan.org/tx/0x2b6cc219ece273ad874301dc798b885d34aabbdf88a57a0b29966a9cd5609086) and [source1](https://sepolia.basescan.org/tx/0x8219fc21db0ade623bdcd3f4b81f8429c06526d3531199921dcb511ea6b284aa); OR settled **YES**. The buyer [collected2SOU](https://sepolia.basescan.org/tx/0xfa707e07383cd999e92539b563f7c8efd2bbefe7c7c88850b1775ec2b584cf14) and the counterparty [claimed0SOU](https://sepolia.basescan.org/tx/0x29e6b1ee921f532f3991f9272b41bcbecf3891bd12fee7275aaa0106d0c8a141). Both claims confirmed; accounted reserve is **zero**. These are test flows, not customer demand, revenue or a prediction-profit guarantee.

Primary evidence:

- [Final complete mandate, decisions, receipts and delivered result](evidence/intent-a359938e-b769-4a8e-afbe-37556ab50e86.json)
- [Actual runtime model proposal](evidence/llm-d2f44402-9601-4516-b69a-3ec40360c842.json)
- [Immutable policy](evidence/policy-d2f44402-9601-4516-b69a-3ec40360c842.json) and [independent72-check deployment verification](evidence/contract-verification-final.json)
- [Four deployed proof-guard rejections plus duplicate/cap and unchanged reserve](evidence/rejections-a359938e-b769-4a8e-afbe-37556ab50e86.json)
- [Transaction receipts and gas records](evidence/transactions.json)
- [Earlier genuine AND run and schema history](docs/LIVE_RUNS.md)

The earlier AND run settled NO and delivered0SOU to the buyer and2SOU to the counterparty. Its initial schema is preserved as recorded, without retroactively adding final-schema fields. [Real process restart reconciliation](evidence/restart-reconciliation.json) kept transaction/hash counts unchanged and recovered delivery from claim events. [A separate mocked-RPC fault test](evidence/recovery-test.json) covers persisted-before-broadcast failure, SIGKILL, exact-byte recovery, changed-argument rejection and expiry. [The local Anvil/backend regression](evidence/unmatched-refund-test.json) proves an unmatched buyer stake is automatically voided/refunded after funding closes, without retrying expired counterparty funding. These local tests are not live payment receipts.

## Source and trust model

API3 data is essential: removing authenticated source responses prevents safe activation, funding and settlement. The contract pins each source's ID, condition ID, ordered outcomes, selected index, signer, exact creation and settlement request hashes, operator, timing policy and void rule before exposure. No administrator can change the policy or withdraw the reserve.

The selected Airnode signer authenticates the exact response to the exact request. It does not prove upstream truth, eliminate Polymarket's oracle/cache risks or predict profit. Creation and settlement always use `getMarketById`; discovery responses cannot substitute. The application checks envelope age separately from source `updatedAt`. A fresh signature over an older record does not refresh the fact.

The executor holds only isolated server-side test keys. This is not a production non-custodial wallet integration. Contract-enforced limits cover the market's economic path, while possession of a key remains broader authority. RPC availability, local journal integrity and ordinary chain finality remain operational assumptions. Missing projection fields can produce unsigned HTTP 400 errors; an error is not authenticated evidence of cancellation or loss.

See [contract design](docs/CONTRACT.md), [execution safety](docs/EXECUTION_SAFETY.md), [source audit](docs/SOURCE_AUDIT.md), [dependency provenance](docs/DEPENDENCIES.md), and [track requirements](TRACK_REQUIREMENTS.md).

## Review and submission

The implementation targets **API3 — Any API in your contract**. Conditional BSV work did not pass its integration gate and is not claimed as a qualified track. The [V2 presentation outline](docs/PRESENTATION_V2.md) and [V2 submission draft](docs/SUBMISSION_V2.md) are preparation material; the [V1 outline](docs/PRESENTATION.md) and [V1 draft](docs/SUBMISSION.md) remain preserved. A video of at most 2.5 minutes still needs to be recorded, and the user must submit any competition entry. No entry is sent by this application.

Published general rules currently allow one submission per team, with up to three partner tracks, and list **31 October 2026 at 15:00 Europe/Berlin** as the deadline. The V2 rule recheck and unresolved mandatory evidence belong in `TRACK_REQUIREMENTS_V2.md` and `MORNING_HANDOFF_V2.md`; V1 records remain in their original files. `codex/next` source publication and the exact clean-clone checks above passed. The official finish rule recheck also passed at 04:06 UTC / 05:06 Europe/Berlin with no changes: [V2 rules record](evidence/v2/rules-check.json). The new V2 settlement/claims completed with YES, buyer 2 SOU, counterparty 0 and zero reserve. The video and actual entry remain user actions.

## License

MIT for the project. Vendored API3, OpenZeppelin, Solady, forge-std and IBM Plex font licenses are preserved with their files and provenance. See [vendored dependencies](docs/VENDORED_DEPENDENCIES.md) and `web/assets/FONT-LICENSE.txt`.

The separate [native policy experiment](http://localhost:3101/bsv/native) verifies both original API3 signatures and fixed payouts in compiled Bitcoin Script. It is **unfunded and blocked on public-node execution limits**. Local VM tests are reproducible from the vendored `native/` bundle; they are not native network-payment evidence. See [BSV_HANDOFF.md](BSV_HANDOFF.md) and [TRACK_REQUIREMENTS_BSV.md](TRACK_REQUIREMENTS_BSV.md) for precise status and different observation-window timing. `/`, `/next` and the actual paid `/bsv` history are preserved.
