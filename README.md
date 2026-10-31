# Second Order

Give an agent a small test budget for a basket of two Polymarket outcomes. It proposes an **AND** or **OR** rule, funds the approved side, follows authenticated final records and initiates the payout or fixed-deadline refund.

Second Order runs locally on **http://localhost:3101**. It uses **Base Sepolia**, public-mint **Second Order Units (SOU)** collateral with six decimals and no economic value, and a real local Ollama model. It does not place orders on Polymarket. The selected Gamma operations are free; they are not represented as paid x402 calls.

## Working flow

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

Open **http://localhost:3101**. `npm run build && npm start` serves the production bundle on the same port. The server binds to `127.0.0.1`; it is a local tool, not a hosted service.

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

A fresh clone starts empty. Published evidence is a historical record, not a fixture inserted into live application state. Use **Load source markets**, then **Ask agent to compose** to create a fresh scenario. Time-sensitive source IDs from earlier runs must not be reused as upcoming events.

## Verify

```bash
npm test
npm run test:contracts
npm run test:recovery
npm run test:refund
npm run typecheck
npm run build
```

`forge test` includes real saved Airnode signatures replayed locally at their historical timestamp, alongside deterministic accounting and adversarial tests. This local historical replay is distinct from the live Base Sepolia receipts.

The live **Inspect evidence** panel accepts a judge's raw response envelope and submits its signed `data` bytes to the selected deployed source. Preserve `data` as the exact string; parsing and reserializing it invalidates its signature. **Run checks** makes read-only RPC calls to the deployed shared proof guard for edited value, stale authentic response, different request and wrong signer. It asserts the expected custom error and compares protected state. Duplicate-intent and over-budget checks call the deployed funding path. These checks do not broadcast rejection transactions and do not claim to have paid revert gas.

Use only one executor process for a runtime directory. The server serializes writes and acquires a process lock. The scripts below are command-line alternatives; stop the server before using them against the same `.runtime/`:

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

## Recorded integration

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

The implementation targets **API3 — Any API in your contract**. Conditional BSV work did not pass its integration gate and is not claimed as a qualified track. The [presentation outline](docs/PRESENTATION.md) and [submission draft](docs/SUBMISSION.md) are preparation material. A video of at most 2.5 minutes still needs to be recorded, and the user must submit any competition entry. No entry is sent by this application.

Published general rules currently allow one submission per team, with up to three partner tracks, and list **31 October 2026 at 15:00 Europe/Berlin** as the deadline. The final rule recheck and any unresolved mandatory evidence belong in `TRACK_REQUIREMENTS.md` and `MORNING_HANDOFF.md`.

## License

MIT for the project. Vendored API3, OpenZeppelin, Solady, forge-std and IBM Plex font licenses are preserved with their files and provenance. See [vendored dependencies](docs/VENDORED_DEPENDENCIES.md) and `web/assets/FONT-LICENSE.txt`.
