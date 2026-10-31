# Second Order submission draft

This is draft copy for the user's review. No competition entry has been submitted, and no finished video is claimed here. Replace the video field only after recording and checking a video of at most 2.5 minutes. The recorded live flow completed with NO settlement, buyer0SOU and counterparty2SOU; confirm the final user submission and video separately.

**Project:** Second Order  
**Selected partner track:** API3 — Any API in your contract  
**Repository:** [ABerkeBora/heka-second-order](https://github.com/ABerkeBora/heka-second-order) — final publication and clean-clone evidence are recorded in the morning handoff.  
**Video:** PENDING, maximum 150 seconds.  
**Network:** Base Sepolia, chain ID 84532.  
**Funded contract:** [0x80249acd6afd72d4d2826b788b0e972848a073e4](https://sepolia.basescan.org/address/0x80249acd6afd72d4d2826b788b0e972848a073e4).

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

The real qwen3:4b proposal selected Ethereum and XRP upside records and AND, then passed independent validation. After one bounded mandate, the buyer agent [funded its position](https://sepolia.basescan.org/tx/0x9a1e7fdf5e3f064cb12b9cb4f6432ee90087c34793a4c26fc285d837b08e014c). The [separate counterparty](https://sepolia.basescan.org/tx/0xcb63e6961be15badfd7f8ed6e5061da82824b752d47c3da6abe9962d21ca28d8) funded the opposite side. Each stake is 1.00 SOU, yielding a 2.00 SOU recorded reserve. The agent submitted both authenticated terminal records and AND settled NO: Ethereum Up lost and XRP Up won. The buyer's losingYES position [claimed0SOU](https://sepolia.basescan.org/tx/0x85e129612f33c11e2195f5c6bf2ba4de3865a4bb851a7ac55ea339f89bf713ee), while the counterparty's NO position [collected2SOU](https://sepolia.basescan.org/tx/0xef5fcb107d5f291adc4f656873c06f52345c189122efc6d020393bb277c488f9). Both claims confirmed; the reserve is zero. The signed second record [drove the result on chain](https://sepolia.basescan.org/tx/0xba469def95fb56a83df2e63d18a84f7f74666f0c333de6cb445491600920ad85).

The journal saves the exact signed transaction and hash before broadcast. Retries reconcile receipts and rebroadcast the same bytes instead of charging again. Reused IDs with changed transaction arguments are rejected. On-chain consumed funding intents and claim flags provide a separate duplicate-execution guard. There is no automatic top-up.

## Tamper test and judge reproduction

The evidence panel and documented contract interface let judges provide their own signed response. The deployed shared proof guard uses the same verification logic as activation/funding, avoiding unrelated phase or budget checks masking the cryptographic result.

Recorded read-only Base Sepolia RPC calls reject:

- A real response with an edited value: `NotSignedByAirnode`.
- An unmodified authentic response past the maximum envelope age: `ResponseTooOld`.
- A real response to the other source's request: `NotSignedByAirnode`.
- A response signed with an unexpected test key: `NotSignedByAirnode`.

Additional deployed funding-path calls reject duplicate intent and over-budget actions. The before/after reserve and source state agree. These rejection checks are read-only RPC execution, not fabricated broadcast receipts. Foundry tests separately cover fixed-beneficiary delivery, replay/double claim, source identity/order, phase binding, timestamp boundaries, ambiguous payouts, timeout refund, donations, integer dust and reserve conservation.

See the repository's `evidence/` files, `docs/CONTRACT.md` and setup README for exact requests, calls, saved real signatures and receipts. The finished video must show the valid action and these four rejection cases.

## Data we wanted but could not find

We did not find a uniformly present explicit winner field in the observed Gamma single-market records. Open records omitted `umaResolutionStatus` and `closedTime`, so projecting those fields returned an unsigned HTTP400. Outcomes and outcome prices arrived as JSON-containing strings rather than direct arrays. We therefore use the fixed documented operation and require explicit resolved finality plus exact terminal payout strings; we do not manufacture winner data or treat API errors as signed absence evidence.

We also observed different cached records across listing and single-ID operations. A fresh Airnode signature may wrap an older upstream observation. The application keeps a single settlement operation and fails closed rather than switching endpoints after exposure.

## Trust assumptions and limits

The expected Airnode signature establishes source attribution, request binding and response integrity. It does not establish upstream truth, eliminate Polymarket oracle/cache risk or guarantee profit. RPC availability, local transaction-journal integrity and normal test-chain finality remain operational dependencies. The executor holds isolated server-side test keys, so this is not represented as a production non-custodial wallet integration. Contract-enforced collateral limits are distinguished from application-only gas/time/transaction limits.

The selected Gamma calls are free. No fake 402 payment is added to claim paid-data usage. Conditional BSV work did not pass the necessary standard-wallet/test-payment/native-verification gate and is not claimed as a qualified track.

## Türkçe teslim notu

Bu metin kullanıcı incelemesi için taslaktır; başvuru gönderilmedi. Canlı settlement/claim tamamlandı ve yukarıdaki gerçek linklerle kaydedildi. Public push/clone sonucu sabah handoff'unda; video henüz yok. Video kaydı zorunlu ve şu anda PENDING. Genel kural takım başına tek submission, en fazla üç partner track; son tarih 31 Ekim 2026 15:00 Europe/Berlin olarak tekrar doğrulanmalı. Mevcut zorunlu tablodaki unresolved maddeler PASS diye sunulmamalı.
