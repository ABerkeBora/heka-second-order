# Execution safety and verification boundary

Review: **31 October 2026, 03:46 Europe/Berlin**. This document describes the inspected implementation. It does not establish that a deployed market has already been funded or settled; live receipts are separate evidence.

## Delegation and custody

The payer is the isolated Base Sepolia buyer test role. The first recipient is the immutable `SecondOrderMarket`; the fixed beneficiary receives a winning payment or refund. SOU is a valueless, six-decimal test collateral token. The independent counterparty test role funds the opposite side using its own authorization, token allowance and transaction. It is seeded testing infrastructure, not evidence of outside customer demand or a second autonomous model.

The local executor holds these test keys server-side. The model sees bounded candidate identities, titles, labels and end times; it does not receive keys, addresses for payment, arbitrary tools or calldata. This is an isolated funded-wallet executor, not a general wallet/session-key platform and not a production non-custodial wallet integration.

| Limit or invariant | Enforcement |
| --- | --- |
| Two distinct market and condition identities; exactly two outcomes | Contract constructor, immutable source policy and outcome hash; app additionally validates candidates |
| AND/OR and selected indexes | Strict model-output schema plus immutable contract policy |
| Token and recipient | Immutable market collateral and fixed transaction destinations in executor code; bounded token allowance |
| Beneficiary, side, single/total collateral cap, maximum funding actions and funding expiry | Immutable per-payer contract mandate; current app uses one action and exact stake allowance |
| Duplicate funding | Contract consumes the payer's stable intent ID; journal preserves signed transaction/receipt |
| Expected signer and exact phase request | Independent off-chain verification plus on-chain attestation verification |
| Freshness | 300-second envelope age, 900-second upstream age, 30-second future tolerance; source identity/outcome/time checks in contract |
| Replay, duplicate settlement and repeated claims | Source-final flags, terminal market phase and per-payer claim flag |
| Reserve conservation | Per-market integer accounting, checks-effects-interactions and reentrancy guard; unsolicited tokens do not inflate reserves |
| Gas per submission and total intent budget | Local executor only; 300000000000000 wei per normal action and 1500000000000000 wei per intent/role. Setup/deployment are separate deployer actions |
| API fees | Zero for the selected free Gamma operations; no fabricated x402 charge |

Gas checks reserve estimated execution cost plus twice the estimated L1/operator fee before signing. Confirmed journal entries use actual execution cost and returned L1 fee. These checks are application policy, not an on-chain spending cap or a mathematical guarantee against future rollup fee changes. No automatic top-up occurs. Receipt evidence must include any reverted transaction's gas; collateral rollback does not make gas free.

## Transaction and restart reconciliation

`src/chain.ts` serializes each signed transaction before broadcasting. The private runtime journal records the logical ID, role, recipient, calldata fingerprint, exact serialized transaction, transaction hash, reserved fee and status. The runtime directory is private and ignored; public transaction exports strip serialized signed bytes.

Before preparing refreshed funding or settlement proofs, the engine calls `reconcile(id)`. If the journal entry exists, the executor parses the stored raw transaction and calls `send` with the original arguments. It first requests the existing receipt, then rebroadcasts only those same signed bytes if needed. This preserves the transaction hash and nonce across timeouts/restarts. A changed recipient/calldata under a reused journal ID is rejected. The chain's stable funding intent independently prevents duplicate collateral movement.

A confirmed revert remains stopped under that journal ID. The implementation does not automatically produce a new payment attempt with fresh calldata after a revert. This can require manual recovery or the pinned void/refund path, but avoids silently paying again. Source fetch retries alone cannot create another stake.

The supported execution topology is one local process. An exclusive in-process queue and executor PID lock guard transaction submission. JSON state/journal files are atomically renamed, not a multi-process transactional database. Use the running server's API rather than running competing writers against its runtime. Keep its journal and state when restarting; do not erase chain history to reset the screen.

## Time and data authority

Creation and settlement use different locked projections of `getMarketById`. Discovery/list records are candidate information, not settlement authority. Signed data is passed byte-for-byte; JSON reformatting invalidates a signature. Nested outcomes/prices are parsed from JSON strings, and the semantic outcome hash binds label order.

An open proof is required for both sources on every funding action. A valid terminal proof halts trading immediately. Settlement additionally requires `closed=true`, `status=resolved`, matching identity/outcomes and exactly one-hot terminal prices, with observation no earlier than market creation. Missing finality, HTTP400, stale records and ambiguous prices cannot release collateral. The immutable timeout supplies the void path.

The UI separates funding cutoff from the initially bounded delivery window. `fundingExpiresAt` / on-chain mandate expiry is the pinned trade cutoff. `automationExpiresAt` is fixed to resolution deadline plus 600 seconds; the executor stops signing new transactions after it. At most eight buyer transactions are permitted per intent locally (funding mandate/approval/stake, two evidence submissions, two claims or the timeout void). On-chain `maxActions=1` applies only to funding. Permissionless manual claim/refund remains possible after automation expiry.

## Verification actually run in this review

- `node --test src/safety.test.ts`: **20 PASS**, 0 failures on the post-fix implementation.
- `npx tsc --noEmit`: exited **0**.
- Ten recorded authentic source responses: independently derived exact request hashes and recovered metadata signer all matched (`evidence/source-audit/verification.json`).

The tests reject unknown/repeated/expired/ineligible market choices, malformed schema, unauthorized model fields and invalid outcome indexes; test envelope/source age and future-time boundaries; preserve raw UTF-8 data; bind request identity to operation, ID, projection and types; and reject real signed data/timestamp/format edits. They caught an invalid-date comparison accepting `NaN`; the implementation now explicitly checks finite end dates.

These Node tests do not prove deployed payment, fee-budget exhaustion or crash recovery end-to-end. Contract tests, actual testnet receipts, tamper calls to deployed guards and browser verification are separate evidence. Crypto rejection checks must assert the expected verifier error, not count an unrelated exhausted-budget/closed-market revert as a signature test.

## Remaining trust and recovery limits

The Airnode signer authenticates what it returned, not upstream truth or cache consistency. The metadata signer is a pinned trust choice. A fresh envelope may cover an older upstream state. Ambiguous/stale data can force refunds and prevent the intended position outcome even when the software operates correctly.

RPC availability, receipt finality and local journal integrity are trusted operational dependencies. One receipt confirmation is not a demonstrated deep-reorg recovery strategy. Losing the journal removes the exact-transaction retry record, although on-chain consumed intents and claim flags still protect the recorded market from duplicate economic execution. Keep ignored runtime backups when preserving a review scenario.
