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

Use three distinct, isolated test accounts. Fund only with Base Sepolia test ETH. The reviewed setup started with 0.01 test ETH for deployment and 0.001 test ETH each for buyer and counterparty; actual gas varies. The application mints its worthless SOU collateral once per role and journals those setup transactions. The selected free data calls need no aUSD payment. Never use mainnet keys, enter keys in the UI, send them to the model or commit `.env`, wallet files or `.runtime/`.

Ollama must already be running at the configured address and serve the configured model. The application does not install models or stop/restart a shared runtime. It fails visibly if the real model call is unavailable; there is no deterministic substitute presented as an LLM call.

A fresh clone starts empty. Published evidence is a historical record, not a fixture inserted into live application state. Use **Load source markets**, then **Ask agent to compose** to create a fresh scenario. Time-sensitive source IDs from earlier runs must not be reused as upcoming events.

## Verify

```bash
npm test
npm run test:contracts
npm run test:recovery
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

`deploy` creates or reconciles the test collateral and a fresh real-model proposal/market. `verify:live` uses an existing initialized proposal, authorizes the bounded buyer test position if absent, and reconciles execution. These commands send real testnet transactions. Keep `.runtime/state.json` and `.runtime/transactions.json` across restarts; do not erase the journal to reset the screen or imply that chain history disappeared.

For a judge-supplied envelope, stop the server, preserve its runtime journal, and use:

```bash
# Passes exact data bytes to the fixed settlement guard without off-chain signature filtering.
node --env-file=.env scripts/submit-response.ts response.json 0 settlement
# Read-only shared open-proof guard, suitable for the four rejection cases.
node --env-file=.env scripts/submit-response.ts response.json 0 validate-open
```

Source index1 selects the other fixed source. `MARKET_ADDRESS` may explicitly select the recorded contract; otherwise the script selects the active intent. A saved old response is expected to fail freshness. For a new valid action, discover and initialize a fresh future market rather than representing historical records as current. Manual recovery after the automation window uses `scripts/submit-response.ts - 0 refund`, followed by `scripts/submit-response.ts - 0 claim`; the immutable deadline and beneficiary still apply. The script refuses mainnet through the same chain guard.

## Recorded integration

Network: **Base Sepolia, chain ID 84532**. The reviewed funded market is [0x80249acd6afd72d4d2826b788b0e972848a073e4](https://sepolia.basescan.org/address/0x80249acd6afd72d4d2826b788b0e972848a073e4), with [SOU collateral](https://sepolia.basescan.org/address/0x78f97e3b9b1b367f60355ddcc06fb157d7d33d08).

The agent's [buyer funding transaction](https://sepolia.basescan.org/tx/0x9a1e7fdf5e3f064cb12b9cb4f6432ee90087c34793a4c26fc285d837b08e014c) and the separate [counterparty funding transaction](https://sepolia.basescan.org/tx/0xcb63e6961be15badfd7f8ed6e5061da82824b752d47c3da6abe9962d21ca28d8) each deposited 1,000,000 SOU base units, creating a recorded 2.00 SOU reserve. This is test funding, not customer demand or revenue.

Evidence files:

- [Funded position and independent role receipts](evidence/funded-position.json)
- [Actual runtime model input, proposal and validator decision](evidence/llm-4d4e246c-afd0-4847-a324-698891409d16.json)
- [Immutable policy and contract deployment](evidence/policy-4d4e246c-afd0-4847-a324-698891409d16.json)
- [Deployed RPC rejection results and unchanged protected state](evidence/rejections-29e88761-5cee-43d0-8a87-4b1ac50b9752.json)
- [Transaction receipts and gas accounting](evidence/transactions.json)

The two genuine final records were submitted by the agent in [source0](https://sepolia.basescan.org/tx/0x4aa93d6ea1bb065b5ea5d90a3b86e6a3879067e71b3b5226d7d74920d10d7b89) and [source1](https://sepolia.basescan.org/tx/0xba469def95fb56a83df2e63d18a84f7f74666f0c333de6cb445491600920ad85). Ethereum's selected Up outcome lost, XRP's won, and AND settled **NO**. The buyer's YES position [claimed0SOU](https://sepolia.basescan.org/tx/0x85e129612f33c11e2195f5c6bf2ba4de3865a4bb851a7ac55ea339f89bf713ee); the separate counterparty [collected2SOU](https://sepolia.basescan.org/tx/0xef5fcb107d5f291adc4f656873c06f52345c189122efc6d020393bb277c488f9). Both claims confirmed and the accounted reserve is zero. This is a completed test economic flow, not a profitable prediction claim.

The [completed intent](evidence/intent-29e88761-5cee-43d0-8a87-4b1ac50b9752.json) links mandate, validation, funding, raw proofs and delivered results. [Real process restart reconciliation](evidence/restart-reconciliation.json) reconstructed delivery from the claim events with unchanged transaction/hash counts. [A separate isolated mocked-RPC fault test](evidence/recovery-test.json) covers persisted-before-broadcast failure, SIGKILL, exact-byte restart and changed-argument rejection; it is not a live payment receipt.

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
