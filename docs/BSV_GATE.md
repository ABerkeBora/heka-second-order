# BSV conditional integration gate

Checked: **31 October 2026, 03:39 Europe/Berlin** (02:39 UTC).

Decision: **Do not promote BSV into the selected implementation tracks.** Continue the API3/EVM product. This was a read-only feasibility audit, not a successful integration or a full hour of attempted implementation. No wallet connection, funds access, transaction, or external message was performed.

## What the official track requires

The [BSV prize section](https://hackathon.tum-blockchain.com/prizes#bsv-association) identifies the track as “DeFi Rails for Agentic Payments”. Its required evidence includes the official TypeScript stack, a standard user wallet, real BSV transactions, non-custodial user funds and an agent payment. The end-to-end product and transaction explorer links are submission evidence. A token transfer or paid API alone would not establish Second Order's prediction-pool settlement.

The selected API3 implementation remains separate: EVM verification does not make BSV validate an Airnode response.

## Evidence inspected

| Area | Observed evidence | Gate result |
| --- | --- | --- |
| Stack and versions | Developer pack `AGENTS.md`: SDK 3.2.1, Wallet Toolbox 2.14.9, Overlay 2.6.4, Overlay Express 2.7.4. [Official ts-stack docs](https://bsv-blockchain.github.io/ts-stack/) describe BRC-100, wallet tooling, scripts and overlays. | Available reference only; no integration run |
| Standard-wallet path | Pack `START-HERE.md` and starter README instruct BSV Desktop **mainnet** with wallet approvals. Guide §4 documents `WalletClient('auto')` and `getNetwork`. The wallet's installed presence is not a connected/funded testnet flow. | BLOCKED: no verified standard-wallet testnet transaction |
| Testnet network availability | Read-only GET `https://arcade-v2-testnet-us-1.bsvblockchain.tech/health` returned HTTP 200, `healthy:true`, `status:ok`, version `v0.16.0`, block height `1766073`. Guide §20 lists that testnet broadcaster. | Reachability PASS; funds/payment NOT proven |
| Funding | Pack onboarding obtains mainnet satoshis by contacting the sponsor. Current authorization allows test funds and prohibits new real-value spend and third-party messages. No request was sent. | BLOCKED: no verified funded test wallet |
| Non-custodial prediction collateral | Pack has wallet-derived-key payments, tokens, NFTs and overlays. Its BSV-21 rules are overlay-validated; Bitcoin Script does not automatically enforce those token rules. No existing two-sided prediction escrow/claim flow was found in the inspected starter. | PENDING: required application contract/UTXO design and tests absent |
| Native API3 verification | Search of the full supplied guide plus starter `core`, `client`, `examples`, `overlay`, `test` found no `Airnode`, `Keccak`, `EIP-191`, `prediction`, `escrow` or `CHECKDATASIG` example. This is a statement about these materials, not a claim that the broader ecosystem has no possible verifier. | BLOCKED: tested verifier path absent |
| Bounded agent payment | Starter's HTTP 402 and payment tests use the wallet toolbox mock chain. Those tests do not prove a standard-wallet real testnet payment under a one-time mandate, nor receipt reconciliation for Second Order. | PENDING |

## Why the one-hour gate cannot responsibly pass now

Testnet broadcast availability is helpful, but the application needs three independent pieces which these materials do not establish: a funded standard-wallet testnet flow, a non-custodial collateral/claim mechanism for two parties, and a tested binding from exact API3 response bytes to BSV settlement. Implementing and auditing those from scratch would displace the authorized API3 core, and a bridge is outside scope.

A server checking API3 and signing a BSV payout adds a trusted settlement signer. It is not native API3 verification on BSV, and a single server key controlling the users' pool would violate the required custody model. Adding an unrelated BSV payment would not resolve either issue.

No BSV badge or qualification claim should appear in the product or submission. Record this conditional gate as **not passed**, rather than marking the API3 project failed.

## Smallest future re-entry conditions

1. Demonstrate BSV Desktop/Browser on testnet, with test funds and a real transaction explorer link, without exporting user keys.
2. Obtain or implement an independently tested exact-request Airnode signature verifier and a non-custodial prediction-pool spending path; alternatively secure explicit approval for a materially different trust model and scope.
3. Prove a bounded initial delegation followed by the agent's real funding/claim action, one rejected duplicate/over-budget action and restart-safe reconciliation.

Re-entry is a separate engineering task, not a five-minute morning switch. No mainnet spend is needed or authorized by this audit.

## Reproducibility

Read-only sources inspected from the sponsor developer pack: `START-HERE.md`, `AGENTS.md`, `BSV_STACK_COMPLETE_GUIDE.md` (§§1–6, 14–20, Appendix B and targeted full-file search), and `starter/bsv21-token-kit/README.md` plus targeted source/test searches. The pack is supplied through the [official developer-pack link](https://drive.google.com/drive/folders/179lAsiQEiV1Fpf9SY8b0y4456-3QfxfG?usp=sharing).

Network-only check:

```sh
curl --fail --silent --show-error --max-time 15 \
  https://arcade-v2-testnet-us-1.bsvblockchain.tech/health
```

No secrets, keys, wallet balances or wallet identities were read or recorded.
