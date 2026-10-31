# Second Order presentation outline

Target duration: **2 minutes 30 seconds maximum**. This is a recording plan, not a completed video. Record the final live state and actual explorer evidence; do not substitute a fixture for a live transaction.

| Time | Screen / evidence | Spoken point |
| --- | --- | --- |
| 0:00–0:20 | Compose, two actual source records | “A prediction-market user may want one position on two outcomes together. Second Order lets a bounded agent create and fund that basket.” |
| 0:20–0:40 | Runtime model proposal, independent validator, A/B outcome labels and AND/OR truth table | “The local model chooses two allowed sources and a simple rule. It cannot invent IDs, payment destinations or settlement logic. The validator and immutable contract decide what is allowed.” |
| 0:40–1:00 | Exact market recipient, stake cap, beneficiary, funding expiry and later automation expiry | “I authorize one test stake. Funding stops at this cutoff; evidence and collection may continue only within the separate recovery window and transaction/gas budgets.” |
| 1:00–1:20 | Activity: real buyer and counterparty funding receipts | “After that delegation the agent sends the buyer funding transaction. This separate seeded counterparty funds the other side with its own receipt. SOU is worthless test collateral on Base Sepolia.” |
| 1:20–1:45 | Recorded NO settlement: Ethereum Up lost, XRP Up won; buyer0SOU and counterparty2SOU receipts | “The contract accepts only these exact signed requests, expected signer, fresh envelope and source update, and resolved one-hot outcomes. It applies the fixed rule, then the agent triggers delivery to the original beneficiary. Invalid or missing data cannot release collateral.” |
| 1:45–2:15 | Evidence drawer: valid case, edited/stale/different-request/wrong-key rejection results, duplicate/budget checks | “A valid signed response enables the intended action. These four bad responses revert with the expected verifier errors. The rejection checks are read-only calls against the deployed contract; reserve and source state remain unchanged.” |
| 2:15–2:30 | Explorer, fixed policy, source-risk note | “Authentication protects source and request integrity. It does not establish upstream truth or remove Polymarket cache/oracle risk. The repository includes setup instructions, exact contract policy and reproducible evidence.” |

The official API3 video requirement calls for a valid timely response triggering the intended on-chain action and all four rejection cases. If the live settlement has not completed, do not narrate it as complete. The recorded activation/funding and final settlement both used authentic responses. Show the actual NO result and the 0/2SOU deliveries; do not suggest the buyer earned a profit. A new live scene needs newly discovered future markets.

## Recording checklist

- Use the final production application on port 3101, with no private environment files or terminal key values visible.
- Capture source IDs/outcome order and the exact deployed market, not only a polished screen.
- Show the real model identity and accepted validator decision without private model reasoning.
- Show buyer and counterparty receipts separately, then any settlement/claim/refund receipt actually achieved.
- Run rejection checks against the final deployed shared proof guard and show expected error names.
- Keep rejection RPC calls distinct from broadcast transactions and their fees.
- Verify the exported video's duration is at most 150 seconds. Upload/submit only when the user chooses to do so.

## Türkçe sabah notu

Video henüz kaydedilmedi. Önce `MORNING_HANDOFF.md` içindeki son canlı settlement/claim/refund durumunu kontrol edin. 2:30 sınırını aşmayın. Bekleyen kaynağı sonuçlanmış gibi anlatmayın; public source ve gerçek receipt bağlantılarını gösterin. Başvuruyu bu chat göndermedi. Resmî genel sayfa takım başına tek submission diyor; yedi build'i yedi başvuru olarak varsaymayın.
