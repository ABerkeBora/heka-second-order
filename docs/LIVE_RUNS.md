# Recorded live runs

Both records below use real local-model outputs, authenticated free Polymarket operations and actual Base Sepolia transactions. No fixture is inserted into live application state.

| Run | Fixed sources and rule | Initial authorization record | Actual result |
| --- | --- | --- | --- |
| First integration | Ethereum6405927 + XRP6405928, Up/Up, AND | Funding expiry recorded in the first schema; the policy already fixed the resolution deadline. The later explicit recovery-window/transaction-limit fields were added to the final schema. This first run remains genuine oracle/funding/settlement evidence, and is not rewritten to claim fields it did not record initially. | NO. BuyerYES0SOU, counterpartyNO2SOU, reserve0. See completed intent29e88761-5cee-43d0-8a87-4b1ac50b9752. |
| Final mandate acceptance | Ethereum6406061 + Solana6406069, Up/Up, OR | Browser review and one initial approval; funding cutoff, later automation expiry, one funding action, eight transaction cap, exact asset/recipient/beneficiary and separate gas/data caps all persisted before funding. | Awaiting finality. Buyer1SOU and separate counterparty1SOU funded. See final-mandate-funding.json and the eventual completed intenta359938e-b769-4a8e-afbe-37556ab50e86. |

The model explicitly said XRP was absent from its bounded candidate set in the second run and proposed Solana instead. The exact Ethereum/Solana policy was visible and reviewed before its initial funding authorization. It did not invent an XRP ID or silently represent Solana as XRP.

The test seed was minted once:5SOU per role. No top-up occurs between runs; winnings/losses and subsequent stakes reconcile through the same token balances. The second run exercises the final authorization schema and the complete UI→model→validator→contract→agent path. Local mocked-RPC recovery tests remain separate from these live transactions.
