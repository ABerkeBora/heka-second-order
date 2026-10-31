# V2 bounded intent grammar

`src/intent.ts` is a pure deterministic parser and matcher. It has no model, network, key, state or chain access. A supported parser result does not authorize execution: a real model proposal and an independent exact candidate match must both succeed before contract setup or funding.

The supported input form is:

```text
<asset> <Up|Down> <AND|OR> <different asset> <Up|Down> in the same next <5|15>-minute window.
```

For example, `Ethereum Up OR Solana Down in the same next 5-minute window.` Case and whitespace are ignored. `the` and `same` are optional; each direction, one operator, `next`, duration and `window` remain explicit. A space may replace the duration hyphen. This is deliberately a narrow grammar, not a claim to understand arbitrary natural language.

Canonical assets and aliases: BTC/Bitcoin, ETH/Ethereum, SOL/Solana, XRP/Ripple, DOGE/Dogecoin, BNB, HYPE/Hyperliquid, ZEC/Zcash, ADA/Cardano, LTC/Litecoin, AVAX/Avalanche. A known asset may be absent from the current catalogue; parsing it never invents a matching market or permits substitution. Weekly/continuous exposure, arbitrary price thresholds, dates between two times, unknown events, mixed operators, duplicate asset aliases and unsupported prose produce structured `unsupported` reasons.

## Pure API

- `parseIntent(objective: unknown)`: `{status:"supported",intent,reasons:[]}` or `{status:"unsupported",reasons:[{code,message}]}`.
- `equalIntent(a: unknown,b: unknown)`: exact bounded schema/semantics comparison, including the raw objective's leg order. Unknown fields or changed asset, direction, event, operator or time semantics return false.
- `matchIntent(intent,proposal,markets,now=Date.now())`: `{status:"matched",reasons:[],matches:[...]}` or `{status:"unsupported",reasons,matches:[]}`. `now`, `startTime` and `endTime` use milliseconds; match records additionally expose ISO `startDate`/`endDate`. Proposal requires two IDs, two integer outcome indexes and AND/OR. If `normalizedIntent` is present, it must exactly equal the raw parser intent. Other proposal provenance fields do not grant authority.

Matching checks each selected candidate's exact ID and nonzero condition ID; eligible/open state; recognized `<Asset> Up or Down - <Month> <day>, <start>-<end> ET` title; exactly Up/Down labels and the actual selected direction index; valid absolute ISO endDate; title date/clocks in `America/New_York`; 5/15-minute duration and absolute grid alignment; and matching asset/duration/start epoch in a supplied slug. If no slug is supplied, the complete title and absolute endDate checks still apply. Unsupported or contradictory metadata rejects rather than falling back. Source order in the proposal may differ because AND/OR are commutative; both raw-intent legs still must match exactly.

Both selected windows must not have started and must cover the same absolute interval. **Next means the earliest jointly available valid future interval for both assets in the supplied bounded discovery pool**, not the first window anywhere on Polymarket. Discovery's lookahead and candidate bounds belong to the caller. Ambiguous clock changes or unsupported title formats fail closed. The matcher does not infer a date from local machine timezone.

The caller must independently authenticate the listing that supplied title/slug metadata and check current source proof signature, exact request, freshness, condition ID, endDate and ordered outcomes before preparation and funding. This pure module does not claim that metadata is signed merely because a caller labels it eligible. It also does not prove upstream truth or eliminate cache risk.

Run `node --test src/intent.test.ts`. The 26 pure tests cover exact matching, asset substitution/absence, model normalization drift, malformed schema, wrong operator/direction, duplicate identity, event/title/slug/time contradiction, invalid calendar dates, canonical window alignment, started windows, earliest common window, aliases, nested/reversed outcome labels and unsupported weekly/threshold targets. They never touch a wallet or blockchain. Actual HTTP no-action and live delegated funding remain separate integration evidence.
