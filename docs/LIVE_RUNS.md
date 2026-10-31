# Recorded live runs

Both records below use real local-model outputs, authenticated free Polymarket operations and actual Base Sepolia transactions. No fixture is inserted into live application state.

| Run | Fixed sources and rule | Initial authorization record | Actual result |
| --- | --- | --- | --- |
| First integration | Ethereum 6405927 + XRP 6405928, Up/Up, AND | Funding expiry recorded in the first schema; the policy already fixed the resolution deadline. The later explicit recovery-window/transaction-limit fields were added to the final schema. This first run remains genuine oracle/funding/settlement evidence, and is not rewritten to claim fields it did not record initially. | NO. Buyer YES 0 SOU, counterparty NO 2 SOU, reserve 0. See [completed first intent](../evidence/intent-29e88761-5cee-43d0-8a87-4b1ac50b9752.json). |
| Final mandate acceptance | Ethereum 6406061 + Solana 6406069, Up/Up, OR | Browser review and one initial approval; funding cutoff, later automation expiry, one funding action, eight transaction cap, exact asset/recipient/beneficiary and separate gas/data caps all persisted before funding. | YES. Both Up outcomes won; buyer 2 SOU, counterparty 0 SOU, reserve 0. Initial buyer/counterparty 1 SOU each. See [initial mandate/funding snapshot](../evidence/final-mandate-funding.json) and [completed final intent](../evidence/intent-a359938e-b769-4a8e-afbe-37556ab50e86.json). |

The model explicitly said XRP was absent from its bounded candidate set in the second run and proposed Solana instead. The exact Ethereum/Solana policy was visible and reviewed before its initial funding authorization. It did not invent an XRP ID or silently represent Solana as XRP.

The test seed was minted once: 5 SOU per role. No top-up occurs between runs; winnings/losses and subsequent stakes reconcile through the same token balances. The second run exercises the final authorization schema and the complete UI→model→validator→contract→agent path. Local mocked-RPC recovery tests remain separate from these live transactions.

## Primary completed run

The final-schema OR run is the primary V1 acceptance evidence. [Contract 0x9de37bba7dbc2cb50dffc1c77e6941e68e17356a](https://sepolia.basescan.org/address/0x9de37bba7dbc2cb50dffc1c77e6941e68e17356a) settled YES from both Up outcomes. The [buyer claim delivered 2 SOU](https://sepolia.basescan.org/tx/0xfa707e07383cd999e92539b563f7c8efd2bbefe7c7c88850b1775ec2b584cf14), the [counterparty losing claim delivered 0](https://sepolia.basescan.org/tx/0x29e6b1ee921f532f3991f9272b41bcbecf3891bd12fee7275aaa0106d0c8a141), and remaining reserve is zero. The [actual production restart reconciliation](../evidence/restart-reconciliation-final.json) preserved the same 31 transaction hashes/count, reconstructed the 2 SOU buyer delivery from its claim event and retained claimed/reserve-zero state. No further funding was triggered.

The reviewed Solana alternative is an explicit V1 limitation: allowed-source/schema validation does not guarantee literal satisfaction of the original natural-language Ethereum/XRP target. Strict user-target matching with unsupported/no-action and no fallback is queued for V2, not claimed as a delivered V1 feature.

The [unmatched-refund regression](../evidence/unmatched-refund-test.json) is separate local Anvil execution using the production engine and compiled contracts: after a missing counterparty and funding cutoff, only void/refund ran, the full buyer stake returned, reserve became zero and automation expiry caused no new transaction. It is not a public-chain refund or a third live prediction run. The video and actual Devfolio submission remain PENDING.
