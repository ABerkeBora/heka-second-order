# Second Order contract

`SecondOrderMarket` is one isolated, fully collateralized pari-mutuel pool for exactly two binary Polymarket sources. `TestCollateral` is the public-mint, six-decimal **Second Order Units (SOU)** token. SOU has no redemption promise or economic value and is separate from API3 aUSD fees and native ETH gas.

## Immutable policy and verification

The constructor takes `address collateral, Policy policy`. Policy contains two `Source` tuples, `operatorIsOr`, `tradeClosesAt`, `deadline`, `maxEnvelopeAge` and `maxSourceAge`. Each source pins market ID, condition ID, `outcomesHash = keccak256(abi.encode(decodedOutcome0, decodedOutcome1))`, separate creation and settlement request hashes, signer, selected index, and expected end time. Each source must end strictly after trading closes and strictly before the fixed refund deadline. IDs and conditions must differ. There are no policy setters, proxy or administrator withdrawal.

Projection aliases for creation: `marketId`, `conditionId`, `closed`, `endDate`, `outcomes`, `updatedAt`. Settlement: `marketId`, `conditionId`, `closed`, `status`, `outcomes`, `outcomePrices`, `updatedAt`. Raw signed `data` bytes are passed intact. The official API3 helper first verifies EIP-191 over `keccak256(abi.encodePacked(storedRequestHash,timestamp,data))` with the stored signer. Only then are JSON values read.

Both envelope and source timestamp must be fresh; timestamps over chain time +30 seconds are rejected. `outcomes` is a string holding exactly two JSON strings; its decoded labels and order must match. Creation requires `closed=false`, the fixed future end time, and a current source. Every stake verifies both open proofs again and rejects a source snapshot older than initialization. A fresh envelope does not refresh old upstream data. A cache can still hide an early resolved outcome; this product inherits that source risk.

Settlement requires the exact settlement request, `closed=true`, `status="resolved"`, envelope and upstream timestamps no earlier than deployment, and two exact terminal payout strings (`["1","0"]` or `["0","1"]`, whitespace between array items is harmless). `0.9995` is not a winner. Missing fields, stale records, malformed data and split/unsupported payouts revert before any protected state changes. Such cases can use only the predetermined deadline refund. The first valid final source immediately stops trading. Both final sources produce the AND/OR result; an unmatched pool voids instead.

## Callable interface

- `initialize(Proof[2])`: permissionless activation with both open source proofs.
- `authorize(address beneficiary,bool side,uint256 perAction,uint256 total,uint32 maxActions,uint64 expiry)`: payer establishes one immutable mandate. Token, destination and market policy are already fixed by deployment. Amounts are integers; `side=true` means YES on the basket. Mandate expiry cannot exceed the trading cutoff.
- `fund(bytes32 intentId,uint256 amount,Proof[2])`: payer's funded test wallet executes a stake under its existing mandate. Per-action, total, action-count, expiry, source proof and duplicate-intent guards are enforced on-chain. Bounded ERC20 approval is required. Transfer failure rolls all state changes back.
- `submitEvidence(uint8 component,Proof)`: anyone submits the locked source's final record. Duplicate source settlement is rejected.
- `voidExpired()`: anyone voids after the fixed deadline, or at trading close if one side has no stake.
- `claim(address payer)`: anyone initiates payout/refund; collateral always goes to the original mandate beneficiary. Repeated claims revert.
- `validateOpenProof(uint8,Proof) view`: read-only judge diagnostic that calls the same internal verifier used for initialization and funding, without phase/budget gates masking a cryptographic failure. It cannot create exposure or change state.
- `policy()`, `sources(index)`, `marketState()`, `initialSourceUpdatedAt(index)`, `mandates(payer)`, `stakes(payer)`, `consumedIntents(payer,intentId)`: public inspection and restart reconciliation.

A `Proof` is `(uint256 timestamp,bytes data,bytes signature)`. The envelope's own address/hash are not trusted or accepted as authority. State phases: 0 uninitialized, 1 open, 2 settled, 3 void. Funding may be halted while phase remains open waiting for the second final source.

## Accounting and delegation limits

Each deployment records its own YES and NO stake and remaining reserve. A winner receives `totalRecordedPool * ownStake / winningStakeTotal`; the final winning stake receives the remaining integer dust. Losing claims pay zero and cannot take reserve. Void returns each payer's own stake once. Unsolicited token transfers are excluded from reserve and cannot be withdrawn. SafeERC20 and a reentrancy guard protect token transfer paths. The application deploys only its plain, non-rebasing test collateral; arbitrary fee-on-transfer tokens are not a supported integration.

The backend's isolated funded test wallet is the executor, not a new session-key or account-abstraction platform. The contract enforces the limits above for its own economic path. Native gas limits, fee budgets, tool/URL allowlists and API-fee caps remain application checks. Possession of the wallet key is broader than the market mandate, so the runtime must keep it outside the model and fund it with only the isolated test balance. The model never controls the calldata, asset, destination or beneficiary.

## Verification evidence

Run `forge test -vv` from the repository root. The deterministic suite uses a test signer to cover AND/OR, reserves, source identity/order, phase binding, source/envelope freshness, future timestamp, mandate budgets/expiry/immutability, duplicate intent, early finality halt, proposed near-one prices, split rejection/deadline refund, timeout, fixed-beneficiary permissionless claims, replay, double claim, donations and payout dust. A 256-run fuzz test checks exact total payout conservation for different winning stake sizes.

`test/RealSignedOpenProof.t.sol` uses unmodified real API3 creation responses saved on 31 October 2026 at 02:40:39 UTC. It replays them locally at their historical time: valid proofs activate and fund a pool; edited value, an unmodified response past max age, another source's signed response, and a signature produced by an unexpected test key are rejected without state or reserve changes. These are real signatures executed on a local chain, not a claim that the historical market was deployed or funded on testnet. Live Base Sepolia deployment/funding/settlement and explorer evidence are recorded separately by the integration scripts.
