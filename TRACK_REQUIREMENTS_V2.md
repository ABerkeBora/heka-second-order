# Second Order V2 — requirements and evidence

Selected partner track: API3 only. Start gate checked 2026-10-31T03:53:53.671297+00:00 UTC / Europe/Berlin+01:00 before V2 application code. Real browser reloaded prizes, verified API3 aria-selected=true, read qualification and expanded submission; separately read general tab. Official starter read; web extractor could not fetch guides, real browser successfully read full contract and projection guides. No changed requirements seen.

Official sources:
- https://hackathon.tum-blockchain.com/prizes#api3
- https://hackathon.tum-blockchain.com/prizes#how-to-submit
- https://github.com/api3dao/airnodehub-hackathon-starter
- https://api3dao.github.io/airnodehub-hackathon/docs/from-api-to-contract
- https://api3dao.github.io/airnodehub-hackathon/docs/projections

## Mandatory technical qualification

| Requirement | V2 implementation / evidence plan | Status |
|---|---|---|
| AirnodeHub essential to core | Exact signed open records initialized new V2market0x7d34c8ac853eaceba1306f626420bc7fe36b3442 and enabled both real1SOU stakes. evidence/v2/funding-live.json | PASS |
| Deployed contract verifies signer, intended request and timing | Unchanged pinned verifier; evidence/v2/contract-verification.json56PASS and rejections-30e23be6-245b-42ee-ba34-3dd314aafe57.json all7PASS, including four exact oracle custom errors | PASS |
| Signed value drives meaningful state, duplicates protected | Real buyer1SOU fund0x20b50e2c…63abc; counterpart1SOU and reserve2 at recorded time. Actual duplicate/cap calls reject; Actual final ETH/SOL Up/OR YES result, buyer2SOU/counterparty0 claims, reserve0; evidence/v2/intent-30e23be6-245b-42ee-ba34-3dd314aafe57.json | PASS |

## Mandatory submission

| Requirement | Evidence / remaining work | Status |
|---|---|---|
| Contract/network and judge response path | README exact network/contract, raw-response UI uses/api/next; documented APP_NAMESPACE=next script; malformed envelope rejected in UI | PASS |
| Valid action plus edited/stale/wrong-request/wrong-key rejection | Valid fresh proofs produced initialization/funding; four deployed guard failures plus duplicate/cap/protected state allPASS, screenshot rejections.jpg | PASS |
| Public repository/setup README | Public defaultcodex/next;b84aa61… source verified GitHubABerkeBora author/committer; clean-clone41hashes npmci/build/start and bothdirectURLs200. evidence/v2/publication.json, clean-clone.json | PASS |
| <=150second video with valid action and four failures | Outline exists; finished video user action | PENDING |
| Detailed description including data reliance, forgery damage, missing data | docs/SUBMISSION_V2.md records customer effect, data reliance/forgery harm/missing fields and source trust limits | PASS |
| Devfolio actual submission | User action, not authorized in this build; one submission/team/up to3 partner tracks | PENDING |

Deadline verified31 October2026 15:00 Europe/Berlin. Automatic TUM consideration is general event behavior, no new sponsor integration.

## Additional user acceptance

| Requirement | Implementation / evidence | Status |
|---|---|---|
| Preserve V1 | Immutable v1-baseline8bfd72c… public; private state/31 confirmed receipts retained | PASS |
| Separate /next API/state/intent/evidence and no nonce race | evidence/v2/namespace-test.json and isolation-live.json44PASS: exact31V1hashes/intents/5+5SOU/reserves retained; crossnamespace400, sameglobalqueue | PASS |
| Actual LLM normalization, independent identity/event/time/operator check | Actualqwen3:4b17.259s structured output; independent exact ETH/SOL Up/OR/5min future window,26puretests+20backendgates | PASS |
| Unsupported whole-week and absent-event separately reject before all chain setup | evidence/v2/no-action-live.json two actualHTTPcases: allnative/collateral/position/journal unchanged before allchainsetup; dirty-authorization-live.json400 | PASS |
| Supported live candidates -> approval -> real delegated funding | evidence/v2/funding-live.json actual initialmandate and6subsequentconfirmedactortransactions; distinctV2token/market | PASS |
| V1 regression + responsive UI + restart | 46Node tests,20backendgates, namespace/recovery/refund compatibility, fundedrestart noadditionalstake; live44isolationchecks+V1browserregression+V2responsive1440/768/390 allPASS | PASS |

Judging preference: originality/useful agent repeats; priced x402 only when operation actually priced. Gamma calls remain free. No profit, upstream-truth, arbitrary-listing, BSV, bridge or general NLP guarantee. Signature proves exact signer/request, not source truth. Model never sees keys or chooses arbitrary calldata. Gas/automation caps application-enforced; on-chain stake limits remain enforced. Finish gate must reopen rules and link actual evidence, carrying unresolved mandatory items into MORNING_HANDOFF_V2.md.

Finish gate: 2026-10-31T04:06:28.031261+00:00 UTC, Europe/Berlin+01:00. API3+general tabs reread through real browser; no changes observed, evidence/v2/rules-check.json. Technical qualification PASS is distinct from required video and user Devfolio entry PENDING. Final V2 settlement/claim subsequently completed automatically04:17UTC:15confirmedtx, both sourcesUp, ORYES, buyer2SOU/counterparty0, reserve0. Video and user entry are the only mandatory submission items still PENDING.
