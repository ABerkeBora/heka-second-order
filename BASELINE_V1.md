# Second Order V1 baseline

V1 real Goal completed through update_goal on2026-10-31T03:53:13.678590+00:00 (tool completion record; get_goal then returned null). Working verified source commit: `cb22d73fe42addfff333000a90b9de9e8b0403df`; final evidence commit: `62aa1bcece45afad442c474a415b02c6882beb13`. Immutable tag: `v1-baseline`, pointing to the following baseline-record commit. No previous tag existed.

- Open http://localhost:3101/ . Commands: `npm ci`, `forge build`, `npm run build`, `npm start`; configure ignored `.env` from `.env.example` and own test wallets per README. Offline `npm run wallets:create` never funds anything.
- Token on Base Sepolia84532: `0x78f97e3b9b1b367f60355ddcc06fb157d7d33d08`.
- Primary final-schema OR market: `0x9de37bba7dbc2cb50dffc1c77e6941e68e17356a`, intent `a359938e-b769-4a8e-afbe-37556ab50e86`: buyer1SOU funded,2SOU collected, counterparty0, reserve0. Two final API3 records; all31 V1 transactions confirmed. Prior AND run retained separately in docs/LIVE_RUNS.md.
- Actual private state `.runtime/state.json`, raw signed transaction journal `.runtime/transactions.json`, process lock `.runtime/executor.lock`; never publish or copy private keys. All V1 funded jobs finished; no pending escrow cancellation or history reset.
- Public evidence: evidence/intent-a359938e-b769-4a8e-afbe-37556ab50e86.json, contract-verification-final.json, rejections-a359938e-b769-4a8e-afbe-37556ab50e86.json, restart-reconciliation-final.json, transactions.json, browser-qa.json. Local-only Anvil refund and mock crash tests clearly distinguished from public transactions.
- Checks:29 contract tests/256fuzz,20 Node safety tests, typecheck/build, clean public clone install/build/start and33 source hashes, desktop/tablet/phone QA, current npm audit0. Both GitHub author and committer map ABerkeBora.
- API3 technical proof completed; required <=150second video and actual Devfolio submission remain user actions. Draft/outline ready. Test hot wallets and application gas/automation caps are not production account security; oracle signer authenticity does not guarantee source truth or profit.

V2 uses codex/next, /next, separate API/state/intent/evidence namespace and new market records. V1 receipts and source snapshots remain immutable historical evidence. Same-key nonce operations must use one global executor queue. Contract logic stays shared unless justified separately. This file records preservation; V2 is not declared complete here.
