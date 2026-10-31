# Second Order /bsv — track gates

31 October 2026 **10:22 Europe/Berlin**: actual BSV, API3 and How to submit tabs selected in Chrome; qualification, submission and judging sections expanded. This new user-authorized BSV experiment supersedes the old read-only BSV gate only for `/bsv`; `/` and `/next` remain API3/EVM baselines. No completed BSV qualification is implied.

Sources: [BSV](https://hackathon.tum-blockchain.com/prizes#bsv-association), [API3](https://hackathon.tum-blockchain.com/prizes#api3), [general](https://hackathon.tum-blockchain.com/prizes#how-to-submit), [ts-stack](https://bsv-blockchain.github.io/ts-stack/), [developer pack](https://drive.google.com/drive/folders/179lAsiQEiV1Fpf9SY8b0y4456-3QfxfG?usp=sharing), [API3 starter](https://github.com/api3dao/airnodehub-hackathon-starter), [API to contract](https://api3dao.github.io/airnodehub-hackathon/docs/from-api-to-contract). Local pack `START-HERE.md`, `AGENTS.md`, guide sections4–7 and custom-input signer read. Pins: SDK3.2.1, Wallet Toolbox2.14.9; no token overlay required for native satoshi collateral.

| Mandatory BSV item | Planned implementation | Evidence/status |
|---|---|---|
| Official TypeScript SDK and wallet tooling | pinned SDK, WalletClient, derived keys, custom action signing | PASS — package lock, `src/bsv-script.ts`, actual Wallet signatures and Script verification |
| Standard BSV user wallet | BSV Desktop/Browser; refuse all non-testnet payment actions | PASS — `evidence/bsv/wallet-gate.json`, real Desktop-funded collateral |
| Real BSV transaction | matched derivative collateral and settlement/refund | PASS — two5,000sat stakes,9,000sat payout; `settlement-accounting.json`, all3MINED block1766129 |
| Non-custodial user funds | mandatory attestor plus one participant signature | **BLOCKED**: the test backend holds both attestor and seeded counterparty keys. No one key spends, but one platform party controls a satisfying pair. Independent signer control or a proven native covenant is required. Do not claim BSV qualification. |
| AI agent makes payment | real bounded runtime LLM proposal; one scoped mandate; agent collateral action | PASS — `proposal.json` real30.4s model, `intent.json`, `restart-and-replay.json`; buyer0/counterparty9000 actual outcome |
| WhatsOnChain example links, E2E video, public repo/setup | preserve baselines and publish codex/bsv | PENDING |

| Mandatory API3 item for the new /bsv workflow | Implementation boundary | Evidence/status |
|---|---|---|
| Essential authenticated data | fixed two-market AND/OR predicate; original exact proofs determine approval | PASS — full original proofs drive basket/source/settlement approval required by executor |
| Original signature/request/time verified in deployed contract | separate EVM approval sidecar; no EVM collateral | PASS — Base Sepolia0x4bac6d4f18af12aac185835641bce936f7066451, `approval.json`, `approval-binding.json` |
| Signed value causes meaningful state change and duplicate protection | immutable basket approval/finality state required by attestor | PASS — two final source transactions then actual NO/9,000sat payout; links in handoff |
| Valid response + four tamper rejects before action | reproducible sidecar tests and real responses | PASS technical evidence — `tamper-live.json` deployed `eth_call`,16contract tests; bad cases are not claimed mined reverts; video PENDING |
| Judges submit raw responses; contract/network supplied | documented script/UI and explorer links | PASS — `/bsv` proof form, `npm run verify:bsv`; stale saved proofs reject as expected |

The fallback is **EVM original-envelope verification + trusted BSV attestor**. Bitcoin Script does not thereby verify EIP-191, Keccak, EVM consensus or upstream truth. The attestor can censor; collusion with an eligible participant can misdirect the pool. Output signatures bind complete transactions; they are not an oracle-truth covenant. A backend check alone is not the API3 on-chain gate. No native/trustless claim without a separately proven native implementation. Refunds must be described according to actual executable transactions; no CLTV/CSV assumption.

General delivery: public source, setup README, <=150s actual video and one team Devfolio entry by **31 October15:00 Europe/Berlin**, up to3 partner tracks. Video/submission remain PENDING. Testnet/free only; mainnet spending and external messages are not authorized. Finish gate will recheck official tabs and reconcile every status with actual evidence.

## Native follow-on — finish recheck 31 October 2026, 11:15 Europe/Berlin

The actual BSV, API3 and How to submit tabs were reopened in Chrome; qualification, expanded submission and judging sections were read. No selected-track rule change was found. Deadline remains **31 October15:00 Europe/Berlin**, one team submission, up to three partner tracks, public repository and video<=150seconds. Judging preferences remain separate from mandatory rules.

`/bsv/native` is a **new, isolated unfunded policy preview**, not a retrospective relabel of `/bsv`. Original Airnode EIP-191 verification, exact seven-field requests, two-source finality and fixed recipient/output checks pass the compiled local VM and sponsor SDK preimage test. Source/signature eligibility is an immutable observation window plus lag; no current-chain-time expiry claim. After refund maturity, first valid settlement/refund wins.

| Additional native item | Status | Actual evidence / consequence |
|---|---|---|
| Self-contained original-signature Script artifact and pinned dependencies | PASS | `native/`, `evidence/bsv-native/artifact-integrity.json`, `native/pm-followon/consumer-results.json`12/12; gzip artifact integrity verified |
| Root SDK3.2.1 exact native preimage + full protected pool + external fee/change | PASS, local VM only | `native/pm-followon/sdk-results.json`, rerun in this project11:14Berlin; not a network transaction |
| Real LLM proposal and fresh signed creation policy | PASS, unfunded | `evidence/bsv-native/proposal.json`, `intent.json`; ETH6415479/SOL6415473 originally future11:20–11:25Berlin; no claim this historical preview stays future forever |
| Actual standard wallet native mandate/funding | BLOCKED | No new buyer action, no signed mandate, no native pool. API rejects before wallet mutation; `gates.json` preserves all protected journals |
| Native guard accepted and paid on public testnet | BLOCKED | Related smaller native claim hit public-node operation/validation-time limits. Larger12MB two-source guard was deliberately not funded. Transporting a large funding transaction is insufficient |
| BSV non-custody qualification | BLOCKED overall | Native fixed-output guard is local-only; completed `/bsv` still has backend attestor+CP key-control limitation. Combining two incomplete claims does not create qualification |
| Native API3 qualification | PENDING/BLOCKED | No deployed/native payment receipt; local VM is not deployment. Existing EVM consumer evidence stays separately valid; no native timing parity claim |
| Video and Devfolio | PENDING | No competition submission performed |

The resource gate may only be cleared after independently evidenced real native claim acceptance, not by toggling a status to obtain a funding hash. Prior funded pools/history remain unchanged. API3 source authentication does not establish upstream truth. No x402 fee is claimed for free operations.
