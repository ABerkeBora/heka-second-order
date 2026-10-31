/** Pure V2 intent grammar and independent candidate matching. No model, state, network or chain access. */
export const ASSET_ALIASES = {
  BTC: ["bitcoin", "btc"],
  ETH: ["ethereum", "eth"],
  SOL: ["solana", "sol"],
  XRP: ["xrp", "ripple"],
  DOGE: ["dogecoin", "doge"],
  BNB: ["bnb"],
  HYPE: ["hyperliquid", "hype"],
  ZEC: ["zcash", "zec"],
  ADA: ["cardano", "ada"],
  LTC: ["litecoin", "ltc"],
  AVAX: ["avalanche", "avax"],
} as const;
export type IntentAsset = keyof typeof ASSET_ALIASES;
export type IntentDirection = "Up" | "Down";
export type IntentOperator = "AND" | "OR";
export type IntentLeg = { asset: IntentAsset; direction: IntentDirection };
export type BoundedIntent = {
  version: 1;
  event: "crypto-up-down";
  legs: [IntentLeg, IntentLeg];
  operator: IntentOperator;
  windowMinutes: 5 | 15;
  window: "same-next";
};
export type IntentReason = { code: string; message: string };
export type ParseIntentResult =
  | { status: "supported"; intent: BoundedIntent; reasons: [] }
  | { status: "unsupported"; reasons: IntentReason[] };
export type IntentMatch = {
  legIndex: number;
  proposalIndex: number;
  marketId: string;
  conditionId: string;
  asset: IntentAsset;
  direction: IntentDirection;
  outcomeIndex: number;
  /** Absolute timestamps in milliseconds, matching Date.now(). */
  startTime: number;
  endTime: number;
  startDate: string;
  endDate: string;
  durationMinutes: 5 | 15;
};
export type MatchIntentResult = {
  status: "matched" | "unsupported";
  reasons: IntentReason[];
  matches: IntentMatch[];
};

const grammarExample =
  "Ethereum Up OR Solana Down in the same next 5-minute window.";
const reason = (code: string, message: string): IntentReason => ({
  code,
  message,
});
const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const keysAre = (v: Record<string, unknown>, keys: string[]) =>
  Object.keys(v).length === keys.length &&
  keys.every((k) => Object.hasOwn(v, k));
const alias = (text: string): IntentAsset | undefined =>
  (Object.keys(ASSET_ALIASES) as IntentAsset[]).find((asset) =>
    (ASSET_ALIASES[asset] as readonly string[]).includes(text.toLowerCase()),
  );

export function parseIntent(objective: unknown): ParseIntentResult {
  const reject = (code: string, message: string): ParseIntentResult => ({
    status: "unsupported",
    reasons: [reason(code, message)],
  });
  if (
    typeof objective !== "string" ||
    objective.trim().length === 0 ||
    objective.length > 1000
  )
    return reject(
      "INVALID_OBJECTIVE",
      "Provide one objective of 1–1000 characters.",
    );
  const text = objective.trim().replace(/\s+/g, " ");
  if (
    /\b(week|weekly|month|monthly|year|yearly|throughout|continuous|continuously)\b/i.test(
      text,
    )
  )
    return reject(
      "UNSUPPORTED_WINDOW",
      "Only one next available 5-minute or 15-minute window is supported; continuous or calendar-period exposure is unsupported.",
    );
  const operators = text.match(/\b(?:AND|OR)\b/gi) || [];
  if (operators.length > 1)
    return reject(
      "AMBIGUOUS_OPERATOR",
      "Use exactly one AND or OR between two explicit asset directions.",
    );
  const m =
    /^([a-z][a-z0-9 ]{0,39}?)\s+(up|down)\s+(AND|OR)\s+([a-z][a-z0-9 ]{0,39}?)\s+(up|down)\s+in\s+(?:the\s+)?(?:same\s+)?next\s+(5|15)(?:-|\s)minute\s+window\.?$/i.exec(
      text,
    );
  if (!m)
    return reject(
      "UNSUPPORTED_GRAMMAR",
      `Use two explicit Up/Down directions and one 5/15-minute window, for example: ${grammarExample}`,
    );
  const first = alias(m[1].trim()),
    second = alias(m[4].trim());
  if (!first || !second)
    return reject(
      "UNSUPPORTED_ASSET",
      "Supported assets are Bitcoin/BTC, Ethereum/ETH, Solana/SOL, XRP, Dogecoin/DOGE, BNB, Hyperliquid/HYPE Zcash/ZEC, Cardano/ADA, Litecoin/LTC and Avalanche/AVAX.",
    );
  if (first === second)
    return reject(
      "DUPLICATE_ASSET",
      "The two legs must name different assets, including after alias normalization.",
    );
  return {
    status: "supported",
    intent: {
      version: 1,
      event: "crypto-up-down",
      legs: [
        {
          asset: first,
          direction: m[2].toLowerCase() === "up" ? "Up" : "Down",
        },
        {
          asset: second,
          direction: m[5].toLowerCase() === "up" ? "Up" : "Down",
        },
      ],
      operator: m[3].toUpperCase() as IntentOperator,
      windowMinutes: Number(m[6]) as 5 | 15,
      window: "same-next",
    },
    reasons: [],
  };
}

function isIntent(value: unknown): value is BoundedIntent {
  if (
    !record(value) ||
    !keysAre(value, [
      "version",
      "event",
      "legs",
      "operator",
      "windowMinutes",
      "window",
    ])
  )
    return false;
  if (
    value.version !== 1 ||
    value.event !== "crypto-up-down" ||
    value.window !== "same-next" ||
    (value.operator !== "AND" && value.operator !== "OR") ||
    ![5, 15].includes(value.windowMinutes as number) ||
    !Array.isArray(value.legs) ||
    value.legs.length !== 2
  )
    return false;
  for (const leg of value.legs) {
    if (
      !record(leg) ||
      !keysAre(leg, ["asset", "direction"]) ||
      typeof leg.asset !== "string" ||
      !Object.hasOwn(ASSET_ALIASES, leg.asset) ||
      (leg.direction !== "Up" && leg.direction !== "Down")
    )
      return false;
  }
  return value.legs[0].asset !== value.legs[1].asset;
}

/** Exact bounded semantics/schema equality; unknown fields and reordered normalization legs fail closed. */
export function equalIntent(a: unknown, b: unknown): boolean {
  return (
    isIntent(a) &&
    isIntent(b) &&
    a.version === b.version &&
    a.event === b.event &&
    a.operator === b.operator &&
    a.windowMinutes === b.windowMinutes &&
    a.window === b.window &&
    a.legs.every(
      (leg, i) =>
        leg.asset === b.legs[i].asset && leg.direction === b.legs[i].direction,
    )
  );
}

const months = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const nyTime = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});
function localParts(timestamp: number) {
  return Object.fromEntries(
    nyTime
      .formatToParts(timestamp)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, Number(p.value)]),
  );
}
function absoluteTime(value: unknown): number | undefined {
  if (typeof value !== "string") return;
  const m =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
  if (!m) return;
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number);
  if (
    year < 1970 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  )
    return;
  const base = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    base.getUTCFullYear() !== year ||
    base.getUTCMonth() !== month - 1 ||
    base.getUTCDate() !== day
  )
    return;
  if (
    m[8] !== "Z" &&
    (Number(m[8].slice(1, 3)) > 23 || Number(m[8].slice(4, 6)) > 59)
  )
    return;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}
function clock(
  hourText: string,
  minuteText: string | undefined,
  period: string,
): number | undefined {
  const hour = Number(hourText),
    minute = minuteText === undefined ? 0 : Number(minuteText);
  if (hour < 1 || hour > 12 || minute > 59) return;
  return ((hour % 12) + (period.toLowerCase() === "pm" ? 12 : 0)) * 60 + minute;
}
function labelsOf(value: unknown): string[] | undefined {
  try {
    const labels = typeof value === "string" ? JSON.parse(value) : value;
    if (
      Array.isArray(labels) &&
      labels.length === 2 &&
      labels.every((v) => typeof v === "string") &&
      labels.includes("Up") &&
      labels.includes("Down")
    )
      return labels;
  } catch {
    /* Malformed nested arrays are unsupported input, not execution exceptions. */
  }
}
type Candidate = {
  id: string;
  conditionId: string;
  asset: IntentAsset;
  labels: string[];
  startTime: number;
  endTime: number;
  durationMinutes: 5 | 15;
};
type CandidateRead = { value: Candidate } | { error: IntentReason };
function inspectCandidate(raw: unknown, now: number): CandidateRead {
  const bad = (code: string, message: string): CandidateRead => ({
    error: reason(code, message),
  });
  if (
    !record(raw) ||
    typeof raw.id !== "string" ||
    !/^\d{1,20}$/.test(raw.id) ||
    typeof raw.conditionId !== "string" ||
    !/^0x[0-9a-f]{64}$/i.test(raw.conditionId) ||
    /^0x0{64}$/i.test(raw.conditionId)
  )
    return bad(
      "INVALID_MARKET_IDENTITY",
      "Candidate must have an exact Gamma market ID and condition ID.",
    );
  if (raw.eligible !== true || raw.closed !== false)
    return bad(
      "UNAVAILABLE_MARKET",
      `Market ${raw.id} is not an eligible open record.`,
    );
  const endTime = absoluteTime(raw.endDate);
  if (endTime === undefined)
    return bad(
      "INVALID_END_DATE",
      `Market ${raw.id} lacks a valid absolute endDate.`,
    );
  const m =
    typeof raw.question === "string" &&
    /^([a-z]+) Up or Down - ([a-z]+) (\d{1,2}), (\d{1,2})(?::(\d{2}))?(AM|PM)\s*-\s*(\d{1,2})(?::(\d{2}))?(AM|PM) ET$/i.exec(
      raw.question,
    );
  if (!m)
    return bad(
      "UNSUPPORTED_EVENT",
      `Market ${raw.id} is not an exact supported asset Up or Down window title.`,
    );
  const asset = alias(m[1]),
    month = months.indexOf(m[2].toLowerCase()) + 1;
  const startClock = clock(m[4], m[5], m[6]),
    endClock = clock(m[7], m[8], m[9]);
  if (!asset || !month || startClock === undefined || endClock === undefined)
    return bad(
      "INVALID_WINDOW_TITLE",
      `Market ${raw.id} has an unsupported asset/date/clock in its title.`,
    );
  const duration = (endClock - startClock + 1440) % 1440;
  if (duration !== 5 && duration !== 15)
    return bad(
      "UNSUPPORTED_MARKET_DURATION",
      `Market ${raw.id} is not a 5-minute or 15-minute window.`,
    );
  const startTime = endTime - duration * 60000;
  const startLocal = localParts(startTime),
    endLocal = localParts(endTime);
  if (
    startLocal.month !== month ||
    startLocal.day !== Number(m[3]) ||
    startLocal.hour * 60 + startLocal.minute !== startClock ||
    endLocal.hour * 60 + endLocal.minute !== endClock ||
    startTime % 60000 !== 0 ||
    endTime % 60000 !== 0
  )
    return bad(
      "TITLE_TIME_MISMATCH",
      `Market ${raw.id} title date/clocks disagree with its absolute endDate.`,
    );
  if (
    startTime % (duration * 60000) !== 0 ||
    endTime % (duration * 60000) !== 0
  )
    return bad(
      "WINDOW_GRID_MISMATCH",
      `Market ${raw.id} is not aligned to its absolute 5/15-minute window grid.`,
    );
  if (startTime <= now)
    return bad(
      "WINDOW_ALREADY_STARTED",
      `Market ${raw.id} window has already started or ended.`,
    );
  if (raw.slug !== undefined && raw.slug !== "") {
    const slug =
      typeof raw.slug === "string" &&
      /^([a-z]+)-updown-(5|15)m-(\d{9,12})$/.exec(raw.slug);
    if (
      !slug ||
      alias(slug[1]) !== asset ||
      Number(slug[2]) !== duration ||
      Number(slug[3]) * 1000 !== startTime
    )
      return bad(
        "SLUG_TIME_MISMATCH",
        `Market ${raw.id} slug disagrees with its asset or absolute window.`,
      );
  }
  const labels = labelsOf(raw.outcomes);
  if (!labels)
    return bad(
      "INVALID_OUTCOME_LABELS",
      `Market ${raw.id} must expose exactly the Up and Down labels.`,
    );
  return {
    value: {
      id: raw.id,
      conditionId: raw.conditionId.toLowerCase(),
      asset,
      labels,
      startTime,
      endTime,
      durationMinutes: duration,
    },
  };
}

/** Match the model's source choices to the raw-objective intent, before any contract setup or funding.
 * Input metadata must already come from authenticated discovery; source proof crypto/freshness is a separate guard.
 * "Next" means the earliest jointly available, not-yet-started interval in the supplied bounded discovery pool.
 */
export function matchIntent(
  intent: unknown,
  proposal: unknown,
  markets: unknown,
  now = Date.now(),
): MatchIntentResult {
  const reject = (code: string, message: string): MatchIntentResult => ({
    status: "unsupported",
    reasons: [reason(code, message)],
    matches: [],
  });
  if (!isIntent(intent))
    return reject(
      "INVALID_INTENT",
      "Raw-objective intent has an unknown or invalid bounded schema.",
    );
  if (!Number.isFinite(now) || !Number.isSafeInteger(now))
    return reject(
      "INVALID_CLOCK",
      "Provide a finite integer timestamp in milliseconds.",
    );
  if (
    !record(proposal) ||
    !Array.isArray(proposal.marketIds) ||
    proposal.marketIds.length !== 2 ||
    proposal.marketIds.some((id) => typeof id !== "string") ||
    !Array.isArray(proposal.selectedOutcomeIndexes) ||
    proposal.selectedOutcomeIndexes.length !== 2 ||
    proposal.selectedOutcomeIndexes.some(
      (i) => !Number.isInteger(i) || i < 0 || i > 1,
    ) ||
    (proposal.operator !== "AND" && proposal.operator !== "OR")
  )
    return reject(
      "INVALID_PROPOSAL",
      "Model output must contain two IDs, two integer indexes and one AND/OR operator.",
    );
  if (
    proposal.normalizedIntent !== undefined &&
    !equalIntent(intent, proposal.normalizedIntent)
  )
    return reject(
      "MODEL_INTENT_MISMATCH",
      "The model's normalized asset/event/time/operator intent differs from the raw objective.",
    );
  if (proposal.operator !== intent.operator)
    return reject(
      "OPERATOR_MISMATCH",
      "Model operator does not match the requested operator.",
    );
  if (proposal.marketIds[0] === proposal.marketIds[1])
    return reject(
      "DUPLICATE_MARKET",
      "Two distinct source market IDs are required.",
    );
  if (!Array.isArray(markets) || markets.length > 100)
    return reject(
      "INVALID_MARKETS",
      "A bounded candidate array of at most 100 records is required.",
    );
  const selected: Candidate[] = [];
  for (const id of proposal.marketIds) {
    const rows = markets.filter((m) => record(m) && m.id === id);
    if (rows.length !== 1)
      return reject(
        rows.length ? "AMBIGUOUS_MARKET_ID" : "UNKNOWN_MARKET",
        `Market ${id} must identify exactly one supplied candidate.`,
      );
    const parsed = inspectCandidate(rows[0], now);
    if ("error" in parsed)
      return { status: "unsupported", reasons: [parsed.error], matches: [] };
    selected.push(parsed.value);
  }
  if (selected[0].asset === selected[1].asset)
    return reject("DUPLICATE_ASSET", "Source choices repeat the same asset.");
  if (selected[0].conditionId === selected[1].conditionId)
    return reject(
      "DUPLICATE_CONDITION",
      "Two distinct source conditions are required.",
    );
  const matches: IntentMatch[] = [];
  for (let legIndex = 0; legIndex < 2; legIndex++) {
    const leg = intent.legs[legIndex],
      proposalIndex = selected.findIndex((m) => m.asset === leg.asset);
    if (proposalIndex < 0)
      return reject(
        "ASSET_MISMATCH",
        `The model did not select the requested ${leg.asset}; substitution is unsupported.`,
      );
    const market = selected[proposalIndex],
      outcomeIndex = proposal.selectedOutcomeIndexes[proposalIndex];
    if (market.labels[outcomeIndex] !== leg.direction)
      return reject(
        "DIRECTION_MISMATCH",
        `The selected outcome for ${leg.asset} does not match ${leg.direction}.`,
      );
    if (market.durationMinutes !== intent.windowMinutes)
      return reject(
        "WINDOW_DURATION_MISMATCH",
        `The selected ${leg.asset} duration does not match ${intent.windowMinutes} minutes.`,
      );
    matches.push({
      legIndex,
      proposalIndex,
      marketId: market.id,
      conditionId: market.conditionId,
      asset: market.asset,
      direction: leg.direction,
      outcomeIndex,
      startTime: market.startTime,
      endTime: market.endTime,
      startDate: new Date(market.startTime).toISOString(),
      endDate: new Date(market.endTime).toISOString(),
      durationMinutes: market.durationMinutes,
    });
  }
  if (
    matches[0].startTime !== matches[1].startTime ||
    matches[0].endTime !== matches[1].endTime
  )
    return reject(
      "WINDOW_ALIGNMENT_MISMATCH",
      "Both sources must cover the identical absolute interval.",
    );
  const available = markets
    .map((m) => inspectCandidate(m, now))
    .flatMap((r) => ("value" in r ? [r.value] : []))
    .filter((m) => m.durationMinutes === intent.windowMinutes);
  const windows = intent.legs.map((leg) =>
    available.filter((m) => m.asset === leg.asset).map((m) => m.startTime),
  );
  const jointlyAvailable = windows[0].filter((time) =>
    windows[1].includes(time),
  );
  if (jointlyAvailable.length === 0)
    return reject(
      "NO_COMMON_WINDOW",
      "No jointly available future window satisfies both requested assets.",
    );
  if (matches[0].startTime !== Math.min(...jointlyAvailable))
    return reject(
      "NOT_NEXT_AVAILABLE_WINDOW",
      "The model skipped an earlier jointly available supported window.",
    );
  return { status: "matched", reasons: [], matches };
}
