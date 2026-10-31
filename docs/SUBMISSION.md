# Second Order submission draft

This is draft copy for the user's review. No competition entry has been submitted, and no finished video is claimed here. Replace the video field only after recording and checking a video of at most 2.5 minutes. The primary final-schema live flow completed with OR/YES settlement, buyer 2 SOU, counterparty 0 and reserve zero. The earlier AND/NO integration run remains separate historical evidence; confirm the user submission and video separately.

**Project:** Second Order  
**Selected partner track:** API3 — Any API in your contract  
**Repository:** [ABerkeBora/heka-second-order](https://github.com/ABerkeBora/heka-second-order) — final publication and clean-clone evidence are recorded in the morning handoff.  
**Video:** PENDING, maximum 150 seconds.  
**Network:** Base Sepolia, chain ID 84532.  
**Funded contract:** [0x9de37bba7dbc2cb50dffc1c77e6941e68e17356a](https://sepolia.basescan.org/address/0x9de37bba7dbc2cb50dffc1c77e6941e68e17356a).

## One-sentence description

Second Order gives a bounded AI agent one test budget to compose, fund and collect a position on two authenticated Polymarket outcomes combined with AND or OR.

## Problem and target user

A prediction-market user or agent developer may want exposure to a combination of outcomes, rather than two unrelated positions. The difficult part is not drawing a formula: the source records, outcome ordering, timing, collateral and payout rule must remain fixed after someone takes exposure. A platform-controlled result or an unbound API response can redirect value to the wrong side.

## What we built

A compact local application with a two-source basket, exact four-row truth table, one initial scoped funding mandate, real execution receipts and source-finality tracking. A runtime Ollama model proposes two eligible records, outcome indexes and AND/OR. An independent strict validator rejects invented IDs, invalid indexes, unavailable records and fields outside the allowed schema.

Before the user authorizes funding, the application deploys and initializes an immutable Base Sepolia market. The mandate fixes its recipient and asset, original beneficiary, side, per-action and total collateral caps, one funding action and funding expiry. The local executor additionally enforces gas budgets, transaction count and a separate later automation expiry. After the initial delegation, the agent initiates the actual test funding and subsequent evidence/collection actions within that scope. A separate seeded test counterparty funds the opposite side through its own transactions.

The pool uses six-decimal, public-mint Second Order Units (SOU), with no economic value or redemption promise. It is fully collateralized with integer reserve accounting, permissionless proof submission, a fixed refund deadline and one claim per payer. It does not place real orders on Polymarket, use leverage, or claim a combined probability by multiplying source prices.

## Why authenticated AirnodeHub data is essential

Activation, every new stake and settlement depend on authenticated source data. Each source pins its Polymarket market ID, condition ID, outcome labels/order, selected index, expected signer, distinct creation and settlement request hashes, observation/freshness policy and expected end. The contract verifies the signature over the exact raw response bytes and stored request identity before reading the signed values. It checks envelope age separately from upstream `updatedAt` and rejects future timestamps beyond the fixed tolerance.

Only `getMarketById` is settlement authority. A discovery listing, a missing projection field or an unsigned HTTP error cannot choose the result. Settlement needs `closed=true`, `status=resolved` and exactly one-hot terminal outcome prices in the expected order. A near-one quote is not finality. Both authenticated final records drive the immutable AND/OR rule and claim entitlement. An early valid final record halts new trading. Missing, stale or ambiguous data leaves funds protected until the predetermined void/refund path.

The relying users are the buyer, counterparty and anyone triggering delivery on their behalf. Forged data could otherwise select the wrong winner or release the reserve to the wrong side. Without this verification path, the product cannot safely activate/fund its chosen exposure or settle it.

## Agentic payment evidence

The final V1 runtime-model proposal selected Ethereum 6406061 and Solana 6406069 Up outcomes with OR. The bounded pool did not include XRP; the model stated that alternative and the exact Ethereum/Solana policy was reviewed before authorization. V1 permits a reviewed alternative and does not claim strict natural-language target matching. Strict no-fallback target validation is queued for V2, which is not presented as an active or delivered feature here. The final initial mandate recorded both expiry windows, one funding action, eight transaction limit and all asset/recipient/fee caps before the agent acted. The buyer [funded 1 SOU](https://sepolia.basescan.org/tx/0x3bf41978c6469812f555b127e4a231bcc24ca89263249ef1b62615b530af8ef8), and the [separate counterparty funded 1 SOU](https://sepolia.basescan.org/tx/0xf1287b80e7b095956a21c8a1e5df1569b1e3f2d4da1cea95e6394ed01ef4360e). Both Up outcomes won, OR settled YES, the buyer [collected 2 SOU](https://sepolia.basescan.org/tx/0xfa707e07383cd999e92539b563f7c8efd2bbefe7c7c88850b1775ec2b584cf14), the [counterparty claimed 0 SOU](https://sepolia.basescan.org/tx/0x29e6b1ee921f532f3991f9272b41bcbecf3891bd12fee7275aaa0106d0c8a141), and the reserve is zero. The [completed final intent](../evidence/intent-a359938e-b769-4a8e-afbe-37556ab50e86.json) contains the full receipt/delivery chain. An earlier genuine AND run separately settled NO and delivered 0 to buyer / 2 to counterparty; its initial schema did not record the later explicit automation-expiry and transaction-count fields, and those fields are not retroactively claimed for that run. Neither run is represented as customer adoption or guaranteed profit.

The journal saves the exact signed transaction and hash before broadcast. Retries reconcile receipts and rebroadcast the same bytes instead of charging again. Reused IDs with changed transaction arguments are rejected. On-chain consumed funding intents and claim flags provide a separate duplicate-execution guard. There is no automatic top-up. The [final production restart reconciliation](../evidence/restart-reconciliation-final.json) preserved the same 31 transaction hashes/count, reconstructed the buyer's 2 SOU claim, and retained claimed state with zero reserve. An isolated [mocked-RPC fault/restart/expiry test](../evidence/recovery-test.json) additionally rejects new signing/preparation or pending rebroadcast after expiry; it is not live payment evidence.

## Tamper test and judge reproduction

The evidence panel and documented contract interface let judges provide their own signed response. The deployed shared proof guard uses the same verification logic as activation/funding, avoiding unrelated phase or budget checks masking the cryptographic result.

Recorded read-only Base Sepolia RPC calls reject:

- A real response with an edited value: `NotSignedByAirnode`.
- An unmodified authentic response past the maximum envelope age: `ResponseTooOld`.
- A real response to the other source's request: `NotSignedByAirnode`.
- A response signed with an unexpected test key: `NotSignedByAirnode`.

Additional deployed funding-path calls reject duplicate intent and over-budget actions. The before/after reserve and source state agree. These rejection checks are read-only RPC execution, not fabricated broadcast receipts. Foundry tests separately cover fixed-beneficiary delivery, replay/double claim, source identity/order, phase binding, timestamp boundaries, ambiguous payouts, timeout refund, donations, integer dust and reserve conservation.

The [final deployed runtime/policy inspection](../evidence/contract-verification-final.json) passed 72 checks. The [pinned vendor integrity comparison](../evidence/vendor-integrity.json) matched 535 source/license files byte-for-byte. Local verification passed 29 Foundry tests including 256 fuzz cases, 20 Node tests, typecheck and production build. The [production-engine unmatched-refund test](../evidence/unmatched-refund-test.json) ran actual compiled contracts on private Anvil: at the funding cutoff an unmatched pool voided, returned the complete stake and stopped new transactions after automation expiry. This local refund evidence is distinct from the two public-chain settlement/claim runs.

See the repository's `evidence/` files, `docs/CONTRACT.md` and setup README for exact requests, calls, saved real signatures and receipts. The finished video must show the valid action and these four rejection cases.

## Data we wanted but could not find

We did not find a uniformly present explicit winner field in the observed Gamma single-market records. Open records omitted `umaResolutionStatus` and `closedTime`, so projecting those fields returned an unsigned HTTP400. Outcomes and outcome prices arrived as JSON-containing strings rather than direct arrays. We therefore use the fixed documented operation and require explicit resolved finality plus exact terminal payout strings; we do not manufacture winner data or treat API errors as signed absence evidence.

We also observed different cached records across listing and single-ID operations. A fresh Airnode signature may wrap an older upstream observation. The application keeps a single settlement operation and fails closed rather than switching endpoints after exposure.

## Trust assumptions and limits

The expected Airnode signature establishes source attribution, request binding and response integrity. It does not establish upstream truth, eliminate Polymarket oracle/cache risk or guarantee profit. RPC availability, local transaction-journal integrity and normal test-chain finality remain operational dependencies. The executor holds isolated server-side test keys, so this is not represented as a production non-custodial wallet integration. Contract-enforced collateral limits are distinguished from application-only gas/time/transaction limits.

The selected Gamma calls are free. No fake 402 payment is added to claim paid-data usage. Conditional BSV work did not pass the necessary standard-wallet/test-payment/native-verification gate and is not claimed as a qualified track.

## Türkçe teslim notu

Bu metin kullanıcı incelemesi için taslaktır; başvuru gönderilmedi. Canlı settlement/claim tamamlandı ve yukarıdaki gerçek linklerle kaydedildi. Public repo ve temiz clone production kontrolü PASS; yeni kapanış kanıtlarının son push'unu root tamamlıyor. Son durum sabah handoff'unda; video henüz yok. Video kaydı zorunlu ve şu anda PENDING. Genel kural takım başına tek submission, en fazla üç partner track; son tarih 31 Ekim 2026 15:00 Europe/Berlin. Doğru API3 ve genel submission tabları 04:51–04:53 yeniden kontrol edildi; şartlarda değişiklik görülmedi (`evidence/rules-check.json`). Mevcut zorunlu tablodaki unresolved maddeler PASS diye sunulmamalı.
