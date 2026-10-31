# Second Order interface direction

TasteSkill app-screen run used. Dealt style: **true-black-flat**, seed **1108070733**, 31 October 2026. No redraws. The approved dark neutral / amber identity and type were preserved with `--keep palette,type`.

Screen question: **Which two outcomes will this budget fund, and under what fixed rule?**

Face: a true neutral brokerage surface, IBM Plex Sans loaded locally, and amber on the selected outcome and truth-table result only. Product mark: two offset outcome squares connected into a basket. Signature element: the A/B source pair flowing into its exact AND/OR truth table; it is the biggest object on Compose.

Data inventory:

- The source records are actual discovered Polymarket markets from `/api/state`.
- Each source has one ID, condition ID, ordered outcome array, end date, upstream update time, and eligibility decision.
- Source prices do not become an inferred combined probability.
- The agent proposal contains exactly two IDs, outcome indexes, AND/OR, short reason, model identity and validator decision.
- The mandate form configures one initial authorization: side, integer stake units, fixed network/asset/recipient policy, beneficiary, gas and data caps and expiry.
- SOU has six decimals; human input is converted to integer units without floating point arithmetic.
- Intents, execution steps, hashes, reserve and collected units render solely from server state.
- The counterparty is a separate test role, labeled as such in the collection policy.
- Empty source/basket/intent/check states show no fabricated balances, hashes or success.
- The evidence drawer accepts exact signed response bytes and exposes real rejection results returned by the backend.

Layout arithmetic: desktop has a 240px source rail, then two equal 29px canvas gutters. The work grid uses one 18px gap with 1.65:1 basket/mandate panels and closes on the canvas edges. At tablet widths, the source rail becomes a horizontal source strip. At 620px, navigation stays in the top bar, source rows scroll inside their own region, the paired source cards stack, and all payment controls have 44px touch targets.

States implemented: first load skeletons, empty discovery/basket/intent/checks, pending operation indicator, disabled validation-dependent authorization, inline recoverable network/action errors, rejected proposals, confirmed/pending/rejected timeline states, missing values as dashes, real zero as 0.00, expandable execution policy, source detail dialog, raw response drawer.

No photography, charts or invented customer data are used: the source basket and truth table are the product artifact. No fixture records ship in this UI. The initial objective and stake field are editable form inputs, not claimed results.

Verification: `npm run build` passed twice (28 modules; latest observed build 14.98 seconds). TasteSkill source lint: 0 FAIL, 1 WARN for em dash use; allowed because these are honest missing-value glyphs, not punctuation in prose. Typecheck has no remaining web errors; any backend diagnostics are tracked by the root agent. Final production browser screenshots at 1440/768/390 and the browser walkthrough are owned by the coordinating root agent; do not claim these until their evidence exists.

Final production browser QA uses supported CUA controls instead of the skill's CDP inspector, respecting this session's browser-control rule. Actual1440/768/390 captures and rendered DOM measurements are in evidence/browser-qa.json and evidence/screenshots. IBM Plex loaded, no page overflow at any width, no text below11px, no gradients. Final source lint:0FAIL,4WARN defended: monospace is limited to literal IDs/hashes; shadows occur only on the floating dialog/work indicator; em dashes represent missing data. Phone and tablet controls have44px minimum hit boxes. No sample data needs replacing: all displayed economic history is actual recorded test-chain state.

## V2 semantic objective review

V2 uses the same true-black-flat identity and original seed; no redraw or new visual identity. `/next` changes the screen question to **does the exact basket match the objective I asked for?** The existing basket gains a compact requested/matched comparison: asset, Up/Down direction, exact market ID/outcome index, operator, and explicit source start/end/duration. V1's existing task layout and economic behavior remain; the small V1/V2 links live in its footer.

Supported grammar is deliberately narrow: two supported crypto assets from the discovered catalog, Up/Down, AND/OR, and a shared next matching 5- or 15-minute window. “Next” is explicitly scoped to the discovered catalog. Whole-week or absent events are unsupported and cause no action. No general language-understanding claim is made.

Only `/next` uses `/api/next/*`; state, discovery, proposal, authorization, reconciliation, raw evidence and rejection checks use the same prefix. The UI displays the latest server `intentReview`, and sends the exact current objective plus review ID on V2 authorization. Edited objective text, a rejected latest review, or a proposal bound to a different review disables new funding. Existing funded activity remains inspectable. The backend independently enforces these guards.

Requested/matched fields are rendered from actual normalized review and exact matched records; no comparison fixtures are injected. Unsupported reasons remain inline next to the objective review. A recorded acceptance never licenses edits made after that review. Mobile/tablet comparison fields wrap within their own two-column region and retain 44px action targets.

V2 build/typecheck and root-owned browser screenshots are recorded separately from V1 baseline evidence. Do not infer V2 qualification from V1 screenshots or historical receipts.

V2 interface checks after semantic integration: production build and typecheck pass. Source lint reports 0 FAIL; new monospace warning is confined to exact market IDs in the comparison. Existing floating-overlay shadow and missing-value glyph warnings retain their V1 justifications. Root performs actual V2 browser QA; no V2 browser claim is inferred from the build. On an unsupported/unchecked V2 objective with no proposal, A/B placeholders and a default truth table are absent, preventing an unapproved AND rule from appearing below an OR request.
