# Native Polymarket AND/OR guard: portable experimental spike

This is a native Bitcoin Script consumer of two original Airnode signed responses. It has no relayer decision key and takes no backend-supplied digest. It is not a deployed prediction product or an audit. Use a **new, explicitly different native policy/pool**; never replace an existing funded EVM or attestor policy.

## What actually passed

- `primitives-results.json`: 7 compiled Keccak tests, including the 135/136 boundary, 256/271-byte inputs and rejecting 272; 10 strict ISO UTC calendar tests.
- `consumer-results.json`: 12 compiled Script VM cases. Genuine original proofs pay the immutable NO recipient under AND and YES under OR. Wrong payout, edited prices, swapped source, a genuine same-market response for a different operation request, changed outcome ordering, unclosed/proposed records and premature/all-final-sequence refunds reject. Mature non-final refunds return the fixed paired stakes.
- `sdk-results.json`: SDK **3.2.1** `TransactionSignature.format` exactly matched the independent Script preimage. The compiled VM accepted a pool input plus an external fee input, full 2,000-sat payout and 900-sat fee-input change. The 1,000-sat fee input and 100-sat fee are local fixture values, not a network quote.
- Local fixtures are genuine already-finalized ETH/SOL 15-minute Up/Down markets **6414755 / 6414754**, ending `2026-10-31T09:45:00Z`. These show cryptographic/consumer feasibility; a live prediction must be funded before a newly chosen source ends, then use a later eligible signed observation.

## Exact immutable data recipe

`POST https://airnode-polymarket.fly.dev/` with:

```json
{"operation":"getMarketById","parameters":{"id":"6414755"},"responseProjection":{"m":"/id","i":"/conditionId","o":"/outcomes","p":"/outcomePrices","s":"/umaResolutionStatus","c":"/closed","t":"/updatedAt"}}
```

The helper independently derives the request hash from the operation, canonical parameters and projection. Both request hashes, market/condition identity, exact outcome-label order, selected index and end time are pinned in the locking script. `outcomes` and `outcomePrices` are JSON **strings**, not arrays. The accepted final prices are exactly one-hot `1/0`, allowing the observed comma-space or compact encoding. Closed must be `true`, status `resolved`. All seven source fields remain signed and checked; this is not the earlier three-field crypto-only projection.

The Script reconstructs the exact original UTF-8 JSON, computes `keccak256(requestHash || uint256_be(timestamp) || data)`, then the EIP-191 `\x19Ethereum Signed Message:\n32` hash and verifies ECDSA with the immutable full original Airnode key. The helper verifies that this full key maps to the expected original signer `0xbb451127f6d8B2bAEfB9ddFb7c724DAc38Eb9D2E` before constructing a policy. The original 65-byte signature's r/s are checked directly against that key; recovery-v is not a separate policy input.

## Portable helper

`consumer-helper.cjs` requires runtime `scryptlib@2.2.6` and `viem@2.38.5`; transaction construction uses sponsor-pinned `@bsv/sdk@3.2.1`. It loads `../artifacts/polymarket-outcome.json` or its `.json.gz` fallback. Keep that relative layout. No parent workspace imports or wallet access.

`createPolymarketOutcome(policy)` takes two `legs` with `{marketId, conditionId, outcomesString, selectedOutcome, endsAt}`; optional supplied `requestHash` must match the derived fixed recipe. Other fields are `{airnodePublicKey, isOr, observationDeadline, collateralSatoshis, yesRecipientScript, noRecipientScript, refundAfter, refundBuyerScript, refundCounterpartyScript, buyerStakeSatoshis}`. Integers can be BigInt or decimal strings. Payout/refund recipients must be the same two distinct wallet-derived P2PKH scripts. Both refund shares are positive.

It returns `{lockingHex, postSeparatorScriptHex, info, unlock, _delegate}`. Construct the actual transaction first. Obtain its preimage using `TransactionSignature.format` with **scope `ALL | FORKID` (0x41)**, the actual guarded input's value/index/outpoint, every other input, exact outputs/sequence/locktime, and **`LockingScript.fromHex(postSeparatorScriptHex)`**, not the full 12 MB locking script. Then call:

```js
guard.unlock({
  refund: false, envelopes: [original0, original1], preimageHex,
  changeAmount: 0n, changePublicKeyHash: '00'.repeat(20)
})
```

The only allowed outputs are full collateral to the immutable winner (or fixed buyer/counterparty refund split), followed by optional one P2PKH change output from a separately signed external fee input. Preserve the full pool; do not deduct its fee. `_delegate` exists for direct compiled VM tests that bypass friendly helper checks. It is not an alternate settlement authority.

Actual fixture serialization: locking **12,075,794 bytes**, post-code-separator script **1,726 bytes**, preimage **1,885 bytes**, unlocking **2,533 bytes** with fee change. A node capped at 10 MB cannot accept this output. At a verified node policy of 1 sat/KB, approximate funding fee is **12,077 sat plus collateral**, before exact wallet/node quotation. The wallet's own fee quote can differ. A subsequent settlement is small because the locking script is referenced by UTXO and the preimage uses its post-separator suffix.

## Timing and trust limits

The native policy uses a **fixed eligible observation window**, not EVM `block.timestamp` parity: original signed timestamp and parsed source ISO timestamp must be from each source's end through the immutable observation deadline. Source can lead signature by at most 30 seconds, and signature can lag source by at most 900 seconds. The Script has no trusted current block timestamp or absolute wall-clock settlement expiration. A valid observation remains eligible later; after refund maturity, the first valid settlement/refund UTXO spend wins. Refund requires actual bound preimage, `nSequence < 0xffffffff` and `nLockTime >= refundAfter`. An old attacker-chosen locktime cannot prove current freshness.

The upstream Polymarket resolution itself can be wrong or manipulated. Original-source authentication and pinned policy do not independently establish external truth. New experimental Keccak/ECDSA composition, strict JSON subset and consumer have not been audited. Two-block Keccak supports at most **271 packed bytes** (raw source body at most 207). Changed upstream whitespace/field shape fails closed. Only two distinct, bounded Up/Down sources are supported. No generic JSON/API, market AMM, leverage, or native Polymarket trading.

## Reproduction in extracted bundle

From bundle root, `npm ci --ignore-scripts`; `node unpack-artifacts.cjs`; then:

```sh
mkdir -p .tmp
TMPDIR="$PWD/.tmp" node pm-followon/test-sdk.cjs
TMPDIR="$PWD/.tmp" node_modules/.bin/tsx pm-followon/test-primitives.ts
TMPDIR="$PWD/.tmp" node_modules/.bin/tsx pm-followon/test-consumer.ts
```

Tests use dummy outpoints and dummy recipient hashes `11/22/33`; **never broadcast their output scripts**. Genuine source responses and all expected rejections are preserved for reproduction. No transaction was broadcast by this spike. Standard wallet creation, sponsor node admission, live new-market funding, live outcome settlement and full track qualification require separate application evidence.

Compiler: official sCrypt `1.22.0+commit.47800da`, unoptimized `--hex --ast -r`. TypeScript translation uses pinned `scrypt-ts@1.4.5`, `scrypt-ts-lib@0.1.28`, `scrypt-cli@0.2.3`; see lockfile and provenance. Compiler URL: https://github.com/sCrypt-Inc/compiler_dist/releases/download/v1.22.0/scryptc-1.22.0-macOS-x86_64 . Mathematical ECDSA source: https://github.com/sCrypt-Inc/scrypt-ts-lib/blob/fc71404fb82bc513dba3908bf47fc231a169787c/src/ec/secp256k1.ts#L1281 . Original API3 consumer requirements: https://api3dao.github.io/airnodehub-hackathon/docs/from-api-to-contract .
