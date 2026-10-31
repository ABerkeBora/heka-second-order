# Polymarket source audit

Checked **31 October 2026, 03:39–03:41 Europe/Berlin**. This is live public-source research, not a deployed contract or payment qualification result. Only free documented Gamma operations were used; no wallet, key or paid operation was accessed.

## Result

A legitimate future-open to resolved transition is feasible tonight: the source lists recurring 5-minute and 15-minute binary crypto markets. Discover a fresh window when funding is ready; do not fund the IDs below after their closing times. The open and settlement schemas in the handoff are usable, provided missing finality remains a recoverable no-data state and each phase has its own exact request hash.

The cache problem remains visible: list and single-ID requests return different source update times and prices for the same live identity. In this small sample, recent finalized records agreed across both operations. That agreement does not establish global cache consistency.

## Metadata and authentication

The saved `evidence/polymarket-metadata.json` identifies `https://airnode-polymarket.fly.dev/`, signer `0xbb451127f6d8B2bAEfB9ddFb7c724DAc38Eb9D2E`, and EIP-191 over `keccak256(abi.encodePacked(requestHash,timestamp,dataBytes))`. It prices selected CLOB/Data API calls; `listMarkets` and `getMarketById` are unpriced. They must not be presented as a paid x402 service.

Ten signed responses below were independently checked using the metadata's canonical request algorithm and viem EIP-191 recovery. All derived request hashes match their returned hashes, and all recovered signers match the metadata address. Exact signed UTF-8 `data` was preserved. Results: `evidence/source-audit/verification.json`. This confirms off-chain authentication only.

## Small discovery sample

First query (`evidence/source-audit/discovery.json`):

```json
{"operation":"listMarkets","parameters":{"limit":20,"closed":false,"order":"endDate","ascending":true,"end_date_min":"2026-10-31T02:39:55.227Z","end_date_max":"2026-10-31T07:00:00Z"}}
```

Use the exact stored request for reproduction of its hash; the start value is recorded in the artifact. It returned several crypto windows ending at 02:40Z and 02:45Z. A separate ten-record future-window query used `end_date_min=2026-10-31T03:00:00Z`, `end_date_max=2026-10-31T04:00:00Z`. It returned soccer binary records ending at 03:00Z. Sports expected end dates are weaker timing cues: records in the recent-closed sample were already resolved despite November 7 end dates.

| Live open sample at check | End (UTC) | Single-ID source timestamp initially observed | Age at response | Single-ID status |
| --- | --- | --- | --- | --- |
| 6405900, XRP Up or Down, 10:40PM–10:45PM ET | 2026-10-31 02:45 | 02:36:16.558265 | 225s | `closed=false`, binary `Up/Down` |
| 6405901, Dogecoin Up or Down, same window | 2026-10-31 02:45 | 02:34:15.760592 | 346s | `closed=false`, binary `Up/Down` |

Both passed the proposed 900-second source age at observation. They are ephemeral examples, not permanent supported market IDs. Select two records with enough time for model latency, contract creation and both funding transactions, and refuse funding when that margin is gone.

## Cache and field behavior

At 02:39:55Z, `listMarkets` reported 6405900 and 6405901 updated at 02:38:14.425985Z with prices `0.495/0.505`. At 02:40:01–02Z, `getMarketById` reported older 02:36:16 and 02:34:15 timestamps with prices `0.5/0.5`. Each response has a valid signature. A fresh signature therefore does not prove that the most recent upstream state was returned.

For these open single-ID records:

- `id`, `conditionId`, `endDate`, `updatedAt` are strings; `closed` is a boolean.
- `outcomes`, `outcomePrices`, `umaResolutionStatuses` are strings containing JSON arrays.
- `umaResolutionStatus` and `closedTime` are absent, not explicit null.
- Nested array strings contain whitespace, for example `["Up", "Down"]`. Parse their semantics or pin exact returned string bytes consistently; do not fabricate a whitespace-normalized signed response.

The create projection succeeds. The settlement projection against still-open 6405900 returned **HTTP 400**, `The response has no value at "/umaResolutionStatus"`, with no signature. Artifact: `not-final-6405900.json`. This is not authenticated proof of cancellation, absence or a lost outcome.

## Exact phase requests

Creation uses:

```json
{"operation":"getMarketById","parameters":{"id":"6405900"},"responseProjection":{"marketId":"/id","conditionId":"/conditionId","closed":"/closed","endDate":"/endDate","outcomes":"/outcomes","updatedAt":"/updatedAt"}}
```

This exact create request hash is `0x05e27c22838c66dfd1d9b52ec62c42294f1b342301d760cdde2903d227a7e787`. The same create projection for 6405901 has hash `0x7b391dcaaf6e29a79258d89b0b3c954212c8af25431f3470c290f92b4c0f3f3e`.

Settlement uses a different projection:

```json
{"operation":"getMarketById","parameters":{"id":"6437686"},"responseProjection":{"marketId":"/id","conditionId":"/conditionId","closed":"/closed","status":"/umaResolutionStatus","outcomes":"/outcomes","outcomePrices":"/outcomePrices","updatedAt":"/updatedAt"}}
```

A real closed sample, 6437686, returned `closed=true`, `status="resolved"`, terminal prices `["1", "0"]` and source `updatedAt=2026-10-31T02:39:31.378095Z`. Its hash is `0x6d2c4aac0210c73b1d7c52acffb1794818ccf627f9727a86e38d60dcbf572525`. Another real terminal record 6437745 returned `["0", "1"]`; hash `0xf8cfbdfc93f13fcbc1488525b7c7f93598e4a90f4dee3a6dcf5148dab4d8fffe`. These were already resolved when discovered and cannot honestly be used as future-open paid positions. They are suitable real signed parser/tamper artifacts.

`getMarketById` without projection has yet another request identity. A `listMarkets` discovery envelope, even if it contains the same record, cannot substitute for a pinned create or settlement envelope. Each market ID changes the request hash as well.

## Recommended fail-closed policy

Before collateral: pin two distinct IDs, condition IDs, binary outcome order/selected indexes, signer, operation, both projections and hashes, predicate, close time, observation window and refund deadline. Model output may choose only allowed IDs/indexes/AND-or-OR; it does not choose URLs, destinations or settlement interpretation.

At every stake, authenticate fresh single-ID open proofs for both components, require source age at most 900 seconds, reject future source timestamps beyond a small explicit clock tolerance, and require current time before the immutable trading cutoff. Keep the earlier source update time separately from envelope time. An expected future end date alone does not prove the event remains unresolved; permissionless early-finality evidence must stop new exposure.

For settlement, keep `getMarketById` as the only authority. Verify exact phase request and signature before parsing. Require matching identity and outcome order; fresh envelope and upstream timestamp; source observation no earlier than the funded market's allowed observation start; `closed=true`; `status="resolved"`; and precisely terminal one-hot prices. `0.9995/0.0005`, `closed` alone and a fresh envelope over an old source do not qualify. Never switch to a newer-looking endpoint after exposure.

Missing fields, 400/502, parse failure, split outcomes or stale source cannot choose YES/NO or release protected collateral. Retry a bounded number/time within the pinned policy, then use the precommitted permissionless deadline void/refund path. Do not retroactively extend freshness or select a different provider to force a successful settlement. Reject replayed settlement and duplicate claims on-chain.

The signature authenticates the chosen Airnode's response. It does not establish upstream truth, global cache consistency or profitable prediction. The UI should explain a recoverable “Awaiting final source record” state and show both timestamps.

## Saved evidence

`evidence/source-audit/` contains request plus returned envelope for discovery, two create projections, three raw single-ID reads, two recent terminal projections, a missing-finality HTTP400, and the independent hash/recovery report. These are public data and signatures. They establish source access and off-chain verification; actual deployed acceptance/rejection, state transitions, funding and payout remain separate integration evidence.
