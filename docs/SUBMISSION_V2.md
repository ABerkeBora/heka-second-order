# Second Order V2 — submission draft

Draft for user review. **Video PENDING; no entry submitted.** At this snapshot, the new V2 settlement/claims remain PENDING. All four new deployed tamper rejections, duplicate/budget/protected-state checks and responsive browser QA passed. V1 historical success is not substituted for those V2 results.

**Track:** API3 — Any API in your contract.
**Repository:** [ABerkeBora/heka-second-order](https://github.com/ABerkeBora/heka-second-order); published V2 branch [`codex/next`](https://github.com/ABerkeBora/heka-second-order/tree/codex/next), working source [`b84aa61`](https://github.com/ABerkeBora/heka-second-order/commit/b84aa61a0dc2b73975c09f92d9f0280a91a13a8d).
**Local routes:** V1 `http://localhost:3101/`; V2 `http://localhost:3101/next`.
**Network:** Base Sepolia, chain ID 84532.
**V2 contract:** [0x7d34c8ac853eaceba1306f626420bc7fe36b3442](https://sepolia.basescan.org/address/0x7d34c8ac853eaceba1306f626420bc7fe36b3442).
**Collateral:** [six-decimal SOU](https://sepolia.basescan.org/address/0xac32bd83e88540c4509845ad7add0c3969d5df51), public-mint test units with no value or redemption promise.

## Customer problem and benefit

A prediction-market user or agent developer may want two specific outcomes combined with AND or OR. An agent that replaces a missing asset or shifts the window can fund the wrong exposure despite producing a valid transaction. Second Order V2 compares the raw target, actual model normalization and exact source records before any chain setup, then delegates execution only for the current reviewed policy.

The supported language is deliberately narrow: two different known asset names with explicit Up/Down directions, one AND/OR and one next available 5-minute or 15-minute window. “Next” means the earliest jointly available not-started interval in the bounded catalogue, not exhaustive global discovery. Weekly/continuous exposure, arbitrary thresholds and unknown or absent events stop with a specific unsupported/no-action reason. A model false negative also stops execution; there is no deterministic substitute represented as a real model call and no silent asset fallback.

## Actual behavior and economic action

Two real HTTP cases rejected a whole-week target and an absent Cardano/Ethereum pair before deployment, collateral mint, approval or funding. Both namespaces' positions, receipts, collateral and native balances were unchanged. A changed-operator authorization attempt returned HTTP400 and could not fund a previous review. These are separate negative cases, not a fixture shown as a live payment.

The accepted target was `Ethereum Up OR Solana Up in the same next 5-minute window.` A real `qwen3:4b` call took **17.259 seconds** and produced the same bounded normalization. Independent matching selected Ethereum 6406433 Up and Solana 6406432 Up for **31 October 2026 04:05–04:10 UTC**. It checked exact asset/event identity, condition IDs, labels/indexes, title/slug duration and absolute times, shared window and operator, then refreshed signed source proofs before preparation.

After one browser delegation, the buyer agent [funded YES with 1 SOU](https://sepolia.basescan.org/tx/0x20b50e2c70cb32247320c17f66984c3c12e30d6946dc75314bad85d569163abc). The separate seeded test counterparty [funded NO with 1 SOU](https://sepolia.basescan.org/tx/0xb29698970677045a0676f2a18e817ef28a0e29eeb802aeab22d93dfd47fa075e). The snapshot contains 11 confirmed setup/funding transactions and a 2 SOU reserve. **Final settlement/collection remains PENDING here.** The counterparty is testing infrastructure, not customer demand; SOU is not revenue or profit evidence.

The initial mandate fixes network/asset/recipient, beneficiary, integer single/total collateral caps, one funding action, separate funding/automation expiries, eight agent transactions and gas/API budgets. The model sees no keys and chooses no arbitrary destinations, assets or calldata. On-chain intent and claim guards plus persisted exact signed transactions reconcile timeouts/restarts without a second economic execution. The actual funded restart preserved the same eleven hashes and stake.

## Why AirnodeHub is essential

The contract cannot activate, fund or settle the chosen exposure without authenticated source responses. Each source pins ID, condition ID, ordered outcomes and selected index, signer, distinct create/settlement request hashes and timing. The deployed verifier checks the signer and exact raw signed bytes before interpreting values. Envelope age and upstream `updatedAt` are independent. A single fixed `getMarketById` settlement operation must return explicit `closed=true`, `status=resolved` and one-hot terminal prices; a near-one quote or unsigned HTTP400 is not finality.

The buyer and counterparty rely on that data. Forged data could choose the wrong winner or release protected reserve to the wrong side. Invalid, missing, stale or ambiguous values cannot release collateral; only the precommitted deadline permits the void/refund path. V2 uses the existing integer reserve/dust accounting and fixed-beneficiary collection contract. Removing the authenticated source path materially breaks the core workflow.

## Evidence and judge reproduction

[funding-live.json](../evidence/v2/funding-live.json), [real model](../evidence/v2/llm-intent-0698af68-c000-4c8f-8535-8c6ad65e6d2c.json), [no-action HTTP cases](../evidence/v2/no-action-live.json), [dirty authorization](../evidence/v2/dirty-authorization-live.json), [56-check contract/policy verification](../evidence/v2/contract-verification.json) and [funded restart](../evidence/v2/restart-funded-live.json) record the current actual integration.

The V2 evidence panel and documented `APP_NAMESPACE=next` response script accept judges' exact envelope bytes without trusting a backend signature filter as settlement authority. **All four V2 deployed tamper results passed**: edited value, an unmodified authentic stale response, a different request and a wrong signing key each produced the expected verifier error. Duplicate intent, over-budget and unchanged protected-state checks also passed (7/7 total): [V2 rejection report](../evidence/v2/rejections-30e23be6-245b-42ee-ba34-3dd314aafe57.json). Malformed envelope submission was rejected inline without a broadcast or fee. The final video must show one valid action and all four failures. Read-only rejection calls are distinguished from broadcast revert receipts.

[Live isolation](../evidence/v2/isolation-live.json) passed 44 checks at pinned block 52487936: V1 retained its 31 hashes, original SOU balances of 5/5 and zero reserve. [Production browser QA](../evidence/v2/browser-qa.json) passed at 1440/768/390 pixels without page overflow, with loaded fonts and adequate phone/tablet controls. V1's completed 2 SOU claim remained visible.

Local checks passed 46 unit tests and 20 focused production-module gate cases with dependency fixtures. Namespace and V1 compatibility checks passed, including mocked crash/expiry recovery and actual local Anvil unmatched refund. These tests do not substitute for real source signatures, V2 funded transactions or eventual settlement receipts. V1 is preserved at `v1-baseline` / `8bfd72c…`, while V2 owns `/next` and separate state/journal/evidence records with one global nonce queue.

## Missing data and trust limits

Observed single-market records lacked a uniformly present winner field; open records omitted finality fields, and projecting missing fields produced unsigned HTTP400. Outcomes/prices were JSON-containing strings. List and single-ID endpoints could expose different cache ages. We therefore keep an exact source/operation and fail closed rather than select a different endpoint or invent a winner after exposure.

An Airnode signature establishes source attribution and request integrity, not upstream truth, cache consistency or profitable prediction. The executor holds isolated server-side test keys; this is not a production non-custodial wallet. Gas, transaction count and automation-time caps are application checks; rollup fees are estimates and receipt costs remain real test gas. RPC availability, journal integrity and ordinary chain finality remain assumptions; deep-reorg recovery is not demonstrated. No automatic top-up, production customer adoption, BSV bridge or arbitrary new trusted API listing is claimed. Selected Gamma operations are free; no x402 fee is fabricated.

The user must choose the team's one submission, record a video of at most 150 seconds and submit before **31 October 2026 15:00 Europe/Berlin**. Up to three partner tracks may be selected; this project targets API3. The [finish rule recheck](../evidence/v2/rules-check.json) at 04:06 UTC / 05:06 Europe/Berlin found no changes. Public source publication and [clean-clone checks](../evidence/v2/clean-clone.json) passed on exact commit `b84aa61…`: install/typecheck/production build/contract build/start, both routes/APIs HTTP200, two empty namespaces and 41 matching code files. An initially discovered hidden-checkout `/next` fallback failure was fixed and actually retested. Live settlement/claim remains pending, and the video/actual entry must still be completed before a full submission claim.
