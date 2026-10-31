import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

type Market = {
  id: string;
  question: string;
  conditionId?: string;
  outcomes?: string[];
  outcomePrices?: string[];
  endDate?: string;
  updatedAt?: string;
  closed?: boolean;
  eligible?: boolean;
  eligibilityReason?: string;
  slug?: string;
  createRequestHash?: string;
  settlementRequestHash?: string;
  signer?: string;
};
type Step = {
  id?: string;
  action: string;
  status: string;
  message?: string;
  txHash?: string;
  timestamp?: string;
};
type Proposal = {
  id: string;
  marketIds: string[];
  sourceMarkets?: Market[];
  selectedOutcomeIndexes: number[];
  operator: "AND" | "OR";
  reason?: string;
  model?: string;
  createdAt?: string;
  validator?: { accepted: boolean; reason?: string };
  contractAddress?: string;
  policyHash?: string;
  ready?: boolean;
  error?: string;
  policy?: {
    tradeClosesAt?: string;
    deadline?: string;
    maxEnvelopeAge?: number;
    maxSourceAge?: number;
  };
};
type Delivery = {
  amountUnits: string;
  beneficiary: string;
  payer: string;
  refund: boolean;
  transactionHash: string;
};
type Intent = {
  id: string;
  marketId?: string;
  proposalId?: string;
  proposal?: Proposal;
  sourceMarkets?: Market[];
  status: string;
  side: string | number;
  stakeUnits: string;
  buyerStakeUnits?: string;
  result?: "YES" | "NO" | null;
  phase?: number;
  deliveries?: { buyer?: Delivery; counterparty?: Delivery };
  mandate?: Record<string, unknown>;
  steps?: Step[];
  reserveUnits?: string;
  payoutUnits?: string;
  sources?: {
    id: string;
    status: string;
    updatedAt?: string;
    message?: string;
    lastCheck?: string;
  }[];
  contractAddress?: string;
  error?: string;
};
type Check = {
  name: string;
  status: string;
  message?: string;
  txHash?: string;
};
type AppState = {
  network?: { name: string; chainId: number; explorer?: string };
  config?: {
    tokenSymbol?: string;
    tokenDecimals?: number;
    stakeUnits?: string;
    maxStakeUnits?: string;
    gasCapWei?: string;
    totalGasCapWei?: string;
    expirySeconds?: number;
    contractAddress?: string | null;
    buyerAddress?: string;
    counterpartyAddress?: string;
    apiFeeUnits?: string;
    maxActions?: number;
    recipientPolicy?: string;
    deployerGas?: string;
  };
  markets?: Market[];
  proposal?: Proposal | null;
  proposals?: Proposal[];
  intents?: Intent[];
  evidence?: { marketId?: string; checkedAt?: string; checks?: Check[] };
  updatedAt?: string;
  error?: string;
  discovery?: { updatedAt?: string; checkedAt?: string; error?: string };
};
const emptyState: AppState = { markets: [], intents: [] };
const short = (value?: string | null) =>
  value ? `${value.slice(0, 7)}…${value.slice(-5)}` : "Pending deployment";
const stamp = (value?: string | number) => {
  if (!value) return "—";
  const parsed =
    typeof value === "number" || /^\d+$/.test(String(value))
      ? new Date(Number(value) * (Number(value) < 1e12 ? 1000 : 1))
      : new Date(value);
  return Number.isNaN(parsed.getTime())
    ? String(value)
    : parsed.toLocaleString("en-GB", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      });
};
const words = (value?: string) =>
  value
    ? value
        .replace(/[_-]/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Waiting";
const isRejected = (value?: string) =>
  /reject|fail|error|block/i.test(value || "");
const isPending = (value?: string) =>
  /pending|running|submitted|executing|approving|authorizing|funding|waiting/i.test(value || "");
function amount(value: unknown, decimals = 6) {
  if (value === null || value === undefined || value === "") return "—";
  try {
    const raw = BigInt(String(value));
    const base = 10n ** BigInt(decimals);
    const fraction = String(raw % base)
      .padStart(decimals, "0")
      .slice(0, 6)
      .replace(/0+$/, "");
    return `${(raw / base).toLocaleString("en-GB")}${fraction ? `.${fraction}` : ".00"}`;
  } catch {
    return "—";
  }
}
function toUnits(value: string, decimals = 6) {
  if (!/^\d+(\.\d{0,6})?$/.test(value)) return "";
  const [whole = "0", fraction = ""] = value.split(".");
  return String(
    BigInt(whole) * 10n ** BigInt(decimals) +
      BigInt(fraction.padEnd(decimals, "0")),
  );
}
function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d={diagonal ? "M5 15 15 5M5 5h10v10" : "M4 10h12m-5-5 5 5-5 5"}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function Mark() {
  return (
    <svg
      className="brand-mark"
      width="30"
      height="30"
      viewBox="0 0 30 30"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 7h9v9H4zM17 14h9v9h-9z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M13 11h7v3M10 16v4h7" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
function Status({ value }: { value?: string }) {
  return (
    <span
      className={`status ${isRejected(value) ? "negative" : isPending(value) ? "pending" : /confirm|funded|settled|claimed|pass|valid/i.test(value || "") ? "confirmed" : ""}`}
    >
      <i />
      {words(value)}
    </span>
  );
}
function TxLink({
  hash,
  explorer = "https://sepolia.basescan.org",
}: {
  hash?: string;
  explorer?: string;
}) {
  return hash ? (
    <a
      className="tx-link mono"
      href={`${explorer}/tx/${hash}`}
      target="_blank"
      rel="noreferrer"
    >
      {short(hash)}
      <Arrow diagonal />
    </a>
  ) : null;
}

function App() {
  const [state, setState] = useState<AppState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"compose" | "activity">("compose");
  const [objective, setObjective] = useState(
    "Find two upcoming outcomes that belong together. Require both to win.",
  );
  const [stake, setStake] = useState("1");
  const [side, setSide] = useState("YES");
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [envelope, setEnvelope] = useState("");
  const [submittedProof, setSubmittedProof] = useState<{
    marketId: string;
    txHash?: string;
  } | null>(null);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [showAllSources, setShowAllSources] = useState(false);
  const config = state.config || {};
  const markets = state.markets || [];
  const intents = state.intents || [];
  const proposal = state.proposal || state.proposals?.at(-1) || null;
  const intent = intents[0];
  const proposalIntent = intents.find(
    (item) => item.proposalId === proposal?.id,
  );
  const proposalFunded = proposalIntent?.steps?.some(
    (step) => step.action === "Agent funded position" && /confirmed|success/i.test(step.status),
  );
  const proposalSources = (proposal?.marketIds || [])
    .map(
      (id) =>
        markets.find((m) => String(m.id) === String(id)) ||
        proposal?.sourceMarkets?.find((m) => String(m.id) === String(id)) ||
        proposalIntent?.sourceMarkets?.find((m) => String(m.id) === String(id)),
    )
    .filter(Boolean) as Market[];
  const intentProposal =
    intent?.proposal ||
    state.proposals?.find((p) => p.id === intent?.proposalId) ||
    proposal;
  const intentSources =
    intent?.sourceMarkets ||
    ((intentProposal?.marketIds || [])
      .map((id) => markets.find((m) => String(m.id) === String(id)))
      .filter(Boolean) as Market[]);
  const sourceMarkets = view === "activity" ? intentSources : proposalSources;
  const explorer = state.network?.explorer || "https://sepolia.basescan.org";
  const symbol = config.tokenSymbol || "SOU";
  const decimals = config.tokenDecimals ?? 6;
  const stakeUnits = toUnits(stake, decimals);
  const maxStake = config.maxStakeUnits || "5000000";
  const validStake =
    !!stakeUnits &&
    BigInt(stakeUnits) > 0n &&
    BigInt(stakeUnits) <= BigInt(maxStake);
  const accepted = proposal?.validator?.accepted === true;
  const fundingOpen =
    !proposal?.policy?.tradeClosesAt ||
    Number(proposal.policy.tradeClosesAt) > Date.now() / 1000 + 10;
  const readyToAuthorize =
    accepted &&
    !!proposal?.contractAddress &&
    proposal?.ready === true &&
    fundingOpen;
  const contractAddress =
    view === "compose"
      ? proposal?.contractAddress || config.contractAddress
      : intent?.contractAddress ||
        proposal?.contractAddress ||
        config.contractAddress;
  const evidenceContract = contractAddress;
  const evidenceSources = view === "compose" ? proposalSources : intentSources;
  const fundingExpiry =
    intent?.mandate?.fundingExpiresAt || intent?.mandate?.expiresAt;
  const automationExpiry =
    intent?.mandate?.automationExpiresAt ||
    (intentProposal?.policy?.deadline
      ? Number(intentProposal.policy.deadline) + 600
      : undefined);
  const maxAgentTransactions = intent?.mandate?.maxAgentTransactions || 8;
  const proposalFundingExpiry =
    proposalIntent?.mandate?.fundingExpiresAt ||
    proposalIntent?.mandate?.expiresAt ||
    (proposal?.policy?.tradeClosesAt
      ? Math.min(
          Number(proposal.policy.tradeClosesAt),
          Math.floor(Date.now() / 1000) + (config.expirySeconds || 3600),
        )
      : undefined);
  const activeIntentCount = intents.filter(
    (item) =>
      !["claimed", "refunded", "delegation expired"].includes(item.status),
  ).length;
  const eligibleCount = markets.filter((m) => m.eligible !== false).length;
  const checks =
    evidenceContract && state.evidence?.marketId === evidenceContract
      ? state.evidence.checks || []
      : [];
  const lastUpdated = state.discovery?.checkedAt || state.discovery?.updatedAt;
  const activeSteps = intent?.steps || [];
  const buyerFunded = activeSteps.some(
    (step) => step.action === "Agent funded position" && /confirmed|success/i.test(step.status),
  ) || (!!intent?.buyerStakeUnits && /^\d+$/.test(intent.buyerStakeUnits) && BigInt(intent.buyerStakeUnits) > 0n);
  const buyerDelivery = intent?.deliveries?.buyer;
  const counterpartyDelivery = intent?.deliveries?.counterparty;
  const positionSide =
    String(intent?.side) === "0"
      ? "NO"
      : String(intent?.side) === "1"
        ? "YES"
        : String(intent?.side || "");
  const basketVoided = intent?.phase === 3 || intent?.status === "refunded";
  const proposedOperator = proposal?.operator || "AND";
  const truthRows = useMemo(
    () =>
      [
        [false, false],
        [false, true],
        [true, false],
        [true, true],
      ].map(([a, b]) => ({
        a,
        b,
        result: proposedOperator === "AND" ? a && b : a || b,
      })),
    [proposedOperator],
  );

  useEffect(() => {
    if (!drawer && !selectedMarket) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary",
        ) || [],
      );
    focusable()[0]?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDrawer(false);
        setSelectedMarket(null);
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (!elements.length) return;
      if (event.shiftKey && document.activeElement === elements[0]) {
        event.preventDefault();
        elements.at(-1)?.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === elements.at(-1)
      ) {
        event.preventDefault();
        elements[0].focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      previous?.focus();
    };
  }, [drawer, selectedMarket]);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/state");
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        data.error || "The local service could not return the workspace.",
      );
    setState(data.state || data);
  }, []);
  useEffect(() => {
    refresh()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    const interval = window.setInterval(() => {
      refresh().catch(() => {});
    }, 8000);
    return () => window.clearInterval(interval);
  }, [refresh]);
  useEffect(() => {
    if (config.stakeUnits && !intent)
      setStake(amount(config.stakeUnits, decimals).replaceAll(",", ""));
  }, [config.stakeUnits]);

  async function act(path: string, payload: unknown, label: string) {
    setBusy(label);
    setError(null);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || data.message || `${label} could not finish.`,
        );
      if (data.state) setState(data.state);
      else await refresh();
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      await refresh().catch(() => {});
      return null;
    } finally {
      setBusy(null);
    }
  }
  async function inspectProof(tamper = false) {
    setBusy(tamper ? "Checking rejection cases" : "Submitting evidence");
    setDrawerError(null);
    try {
      let parsed;
      if (!tamper) {
        try {
          parsed = JSON.parse(envelope);
        } catch {
          throw new Error("Enter one complete signed response as JSON.");
        }
      }
      const response = await fetch(
        tamper ? "/api/tamper-check" : "/api/evidence",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            marketId: evidenceContract,
            sourceIndex,
            ...(tamper ? {} : { envelope: parsed }),
          }),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error ||
            data.message ||
            "The response was rejected. Protected funds remain locked.",
        );
      if (data.state) setState(data.state);
      else await refresh();
      if (!tamper && evidenceContract)
        setSubmittedProof({ marketId: evidenceContract, txHash: data.txHash });
    } catch (e) {
      setDrawerError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }
  function openEvidence() {
    setDrawer(true);
    setSelectedMarket(null);
    setDrawerError(null);
  }

  return (
    <div className="workspace">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Second Order home">
          <Mark />
          <span>
            Second Order<span className="brand-sub">Outcome baskets</span>
          </span>
        </a>
        <nav className="main-nav" aria-label="Workspace views">
          <button
            className={view === "compose" ? "active" : ""}
            onClick={() => setView("compose")}
          >
            Compose
          </button>
          <button
            className={view === "activity" ? "active" : ""}
            onClick={() => setView("activity")}
          >
            Activity{activeIntentCount > 0 && <span>{activeIntentCount}</span>}
          </button>
        </nav>
        <div className="network">
          <i />
          <span>{state.network?.name || "Base Sepolia"}</span>
          <span className="network-note">Test collateral</span>
        </div>
      </header>
      <div className="workspace-body">
        <aside className="source-rail" aria-label="Source markets">
          <div className="rail-heading">
            <h2>Source markets</h2>
            <button
              className="icon-button"
              title="Refresh source markets"
              aria-label="Refresh source markets"
              disabled={!!busy}
              onClick={() => act("/api/discover", {}, "Refreshing sources")}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M16 6.5A6.5 6.5 0 1 0 16.5 12M16 3v4h-4"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          <div className="rail-meta">
            <span>Polymarket via Airnode</span>
            <span className="num">
              {markets.length ? `${eligibleCount} eligible` : "Not loaded"}
            </span>
          </div>
          <div className="source-list">
            {loading ? (
              [0, 1, 2].map((i) => (
                <div className="source-skeleton" key={i}>
                  <div />
                  <div />
                  <div />
                </div>
              ))
            ) : markets.length ? (
              (showAllSources ? markets : markets.slice(0, 6)).map((market) => (
                <button
                  key={market.id}
                  className={`market-row ${proposal?.marketIds.includes(market.id) ? "in-basket" : ""}`}
                  onClick={() => setSelectedMarket(market)}
                >
                  <span className="market-meta">
                    <span className="mono">{market.id}</span>
                    <span>
                      {market.closed
                        ? "Closed"
                        : Date.parse(market.endDate || "") <= Date.now()
                          ? "Window ended"
                          : market.eligible === false
                            ? "Unavailable"
                            : "Open"}
                    </span>
                  </span>
                  <span className="market-question">{market.question}</span>
                  <span className="market-footer">
                    <span>Ends {stamp(market.endDate)}</span>
                    <Arrow diagonal />
                  </span>
                </button>
              ))
            ) : (
              <div className="rail-empty">
                <span className="empty-symbol">A + B</span>
                <p>Find two source outcomes for your basket.</p>
                <button
                  className="text-button"
                  disabled={!!busy}
                  onClick={() => act("/api/discover", {}, "Refreshing sources")}
                >
                  Load source markets <Arrow />
                </button>
              </div>
            )}
          </div>
          {markets.length > 6 && (
            <button
              className="text-button all-sources"
              onClick={() => setShowAllSources(!showAllSources)}
            >
              {showAllSources
                ? "Show fewer markets"
                : `View all ${markets.length} markets`}
              <Arrow />
            </button>
          )}
          {state.discovery?.error && (
            <p className="inline-error">{state.discovery.error}</p>
          )}
          <div className="rail-foot">
            <span>Last source check</span>
            <span>{stamp(lastUpdated)}</span>
            <p>
              Source prices are market quotes. Only verified final outcomes can
              settle a basket.
            </p>
          </div>
        </aside>
        <main className="canvas">
          <div className="page-title">
            <div>
              <h1>
                {view === "compose" ? "Compose a basket" : "Agent activity"}
              </h1>
              <p>
                {view === "compose"
                  ? "Two outcomes. One rule. A budget your agent must respect."
                  : "Follow each intent from proposal to funding and collection."}
              </p>
            </div>
            <button className="quiet-button" onClick={openEvidence}>
              Inspect evidence <Arrow diagonal />
            </button>
          </div>
          {error && (
            <div className="error-notice" role="alert">
              <div>
                <strong>Action needs attention</strong>
                <p>{error}</p>
              </div>
              <button
                className="text-button"
                onClick={() => {
                  setError(null);
                  refresh().catch((e) => setError(e.message));
                }}
              >
                Retry connection
              </button>
            </div>
          )}
          {view === "compose" ? (
            <>
              <section className="composer" aria-labelledby="composer-title">
                <div className="section-heading">
                  <h2 id="composer-title">Give the agent an objective</h2>
                  <span className="muted">Two sources · AND / OR</span>
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    act("/api/propose", { objective }, "Composing basket");
                  }}
                >
                  <label className="sr-only" htmlFor="objective">
                    Basket objective
                  </label>
                  <textarea
                    id="objective"
                    rows={2}
                    value={objective}
                    onChange={(event) => setObjective(event.target.value)}
                    maxLength={500}
                  />
                  <button
                    className="primary-button"
                    disabled={!!busy || !objective.trim()}
                    type="submit"
                  >
                    {busy === "Composing basket"
                      ? "Agent is composing…"
                      : "Ask agent to compose"}
                    <Arrow />
                  </button>
                </form>
                <div className="composer-foot">
                  <span>
                    Model selects from the eligible sources. A separate
                    validator checks the proposal.
                  </span>
                  <span>{proposal?.model || "Local runtime LLM"}</span>
                </div>
              </section>
              <div className="work-grid">
                <section
                  className="basket-panel"
                  aria-labelledby="basket-title"
                >
                  <div className="section-heading">
                    <h2 id="basket-title">The outcome basket</h2>
                    {proposal ? (
                      <Status
                        value={
                          accepted ? "Validated proposal" : "Rejected proposal"
                        }
                      />
                    ) : (
                      <span className="muted">Awaiting proposal</span>
                    )}
                  </div>
                  <div className="basket-sources">
                    {[0, 1].map((index) => {
                      const market = proposalSources[index];
                      const selectedOutcome =
                        market?.outcomes?.[
                          proposal?.selectedOutcomeIndexes[index] ?? 0
                        ];
                      return (
                        <div
                          className={`basket-source ${market ? "" : "unfilled"}`}
                          key={index}
                        >
                          <div className="source-label">
                            <span className="source-letter">
                              {index === 0 ? "A" : "B"}
                            </span>
                            <span>
                              {market
                                ? `Source ${market.id}`
                                : "Source outcome"}
                            </span>
                            {market && (
                              <button
                                className="text-button"
                                onClick={() => setSelectedMarket(market)}
                                aria-label={`Inspect source ${index === 0 ? "A" : "B"}`}
                              >
                                <Arrow diagonal />
                              </button>
                            )}
                          </div>
                          <p className="basket-question">
                            {market?.question ||
                              (busy === "Composing basket"
                                ? "Selecting an eligible market…"
                                : "Your agent will select a market.")}
                          </p>
                          <div className="outcome-label">
                            <span>Selected outcome</span>
                            <strong className={market ? "accent" : "muted"}>
                              {selectedOutcome || "—"}
                            </strong>
                          </div>
                          <div className="basket-source-foot">
                            <span>
                              {market
                                ? `Ends ${stamp(market.endDate)}`
                                : "Identity and outcome order will be pinned."}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="rule-strip">
                    <span>Basket pays YES when</span>
                    <strong>
                      {proposedOperator === "AND"
                        ? "Both selected outcomes win"
                        : "At least one selected outcome wins"}
                    </strong>
                    <span className="operator">{proposedOperator}</span>
                  </div>
                  <div
                    className="truth-table"
                    role="table"
                    aria-label={`${proposedOperator} truth table`}
                  >
                    <div className="truth-row truth-header" role="row">
                      <span role="columnheader">A wins</span>
                      <span role="columnheader">B wins</span>
                      <span role="columnheader">Basket result</span>
                    </div>
                    {truthRows.map((row, index) => (
                      <div
                        className={`truth-row ${row.result ? "pays-yes" : ""}`}
                        role="row"
                        key={index}
                      >
                        <span role="cell">{row.a ? "Yes" : "No"}</span>
                        <span role="cell">{row.b ? "Yes" : "No"}</span>
                        <span role="cell">
                          {row.result ? "YES" : "NO"}
                          <span className="result-mark">
                            {row.result ? "↗" : "—"}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="basket-summary">
                    {proposal?.reason ? (
                      <p>{proposal.reason}</p>
                    ) : (
                      <p>
                        The same rule is used for every combination. No combined
                        probability is inferred from source prices.
                      </p>
                    )}
                    {proposal?.policy?.deadline && (
                      <span className="policy-deadline">
                        Refund deadline{" "}
                        {stamp(Number(proposal.policy.deadline))}. Unresolved
                        sources cannot release the pool.
                      </span>
                    )}
                    {proposal?.validator?.reason && (
                      <span className={accepted ? "muted" : "error-text"}>
                        {proposal.validator.reason}
                      </span>
                    )}
                  </div>
                </section>
                <section
                  className="mandate-panel"
                  aria-labelledby="mandate-title"
                >
                  <div className="section-heading">
                    <h2 id="mandate-title">Agent budget</h2>
                    <span className="muted">One funding action</span>
                  </div>
                  <p className="mandate-intro">
                    One stake. Your agent funds, follows and collects.
                  </p>
                  <div className="field-label">Position side</div>
                  <div
                    className="side-control"
                    role="group"
                    aria-label="Position side"
                  >
                    {["YES", "NO"].map((value) => (
                      <button
                        key={value}
                        className={
                          (proposalIntent?.side || side) === value
                            ? "selected"
                            : ""
                        }
                        onClick={() => setSide(value)}
                        disabled={!!busy || !!proposalIntent}
                      >
                        {value}
                        <span>
                          {value === "YES"
                            ? "The rule holds"
                            : "The rule fails"}
                        </span>
                      </button>
                    ))}
                  </div>
                  <label className="field-label" htmlFor="stake">
                    Maximum stake
                  </label>
                  <div className="amount-input">
                    <input
                      id="stake"
                      type="text"
                      inputMode="decimal"
                      value={
                        proposalIntent
                          ? amount(
                              proposalIntent.stakeUnits,
                              decimals,
                            ).replaceAll(",", "")
                          : stake
                      }
                      onChange={(event) => setStake(event.target.value)}
                      aria-describedby="stake-help"
                      disabled={!!busy || !!proposalIntent}
                    />
                    <span>{symbol}</span>
                  </div>
                  <div id="stake-help" className="field-help">
                    {amount(maxStake, decimals)} {symbol} maximum · worthless
                    test units
                  </div>
                  <dl className="mandate-details">
                    <div>
                      <dt>Per action / total</dt>
                      <dd>
                        {proposalIntent
                          ? amount(proposalIntent.stakeUnits, decimals)
                          : validStake
                            ? amount(stakeUnits, decimals)
                            : "—"}{" "}
                        {symbol}
                      </dd>
                    </div>
                    <div>
                      <dt>Funding expires</dt>
                      <dd>
                        {proposalFundingExpiry
                          ? stamp(Number(proposalFundingExpiry))
                          : `Within ${Math.round((config.expirySeconds || 3600) / 60)} minutes`}
                      </dd>
                    </div>
                    <div>
                      <dt>Data fee</dt>
                      <dd>
                        {config.apiFeeUnits === "0"
                          ? "Free operation"
                          : config.apiFeeUnits !== undefined
                            ? `${config.apiFeeUnits} units`
                            : "Free operation"}
                      </dd>
                    </div>
                    <div>
                      <dt>Gas cap / action</dt>
                      <dd>
                        {config.gasCapWei
                          ? `${amount(config.gasCapWei, 18)} ETH`
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                  <details className="mandate-scope">
                    <summary>
                      Recipient and execution limits<span>+</span>
                    </summary>
                    <dl>
                      <div>
                        <dt>Recipient</dt>
                        <dd className="mono">
                          {contractAddress ? (
                            <a
                              href={`${explorer}/address/${contractAddress}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {short(contractAddress)}
                            </a>
                          ) : (
                            "Pending deployment"
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Beneficiary</dt>
                        <dd className="mono">
                          {config.buyerAddress
                            ? short(config.buyerAddress)
                            : "Local buyer role"}
                        </dd>
                      </div>
                      <div>
                        <dt>Asset</dt>
                        <dd>
                          {symbol} · chain {state.network?.chainId || 84532}
                        </dd>
                      </div>
                      {proposal?.policyHash && (
                        <div>
                          <dt>Policy</dt>
                          <dd className="mono" title={proposal.policyHash}>
                            {short(proposal.policyHash)}
                          </dd>
                        </div>
                      )}
                      <div>
                        <dt>Recovery window ends</dt>
                        <dd>
                          {proposal?.policy?.deadline
                            ? stamp(Number(proposal.policy.deadline) + 600)
                            : "Pinned with basket"}
                        </dd>
                      </div>
                      <div>
                        <dt>Agent transaction limit</dt>
                        <dd>
                          {String(
                            proposalIntent?.mandate?.maxAgentTransactions || 8,
                          )}{" "}
                          maximum, application cap
                        </dd>
                      </div>
                      <div>
                        <dt>Total gas cap</dt>
                        <dd>
                          {config.totalGasCapWei
                            ? `${amount(config.totalGasCapWei, 18)} ETH`
                            : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt>Gas enforcement</dt>
                        <dd>Application cap, isolated wallet</dd>
                      </div>
                      <div>
                        <dt>Stake enforcement</dt>
                        <dd>Contract cap and token allowance</dd>
                      </div>
                    </dl>
                    <p>
                      No automatic top-up. A duplicate intent cannot create a
                      second stake.
                    </p>
                    {config.recipientPolicy && <p>{config.recipientPolicy}</p>}
                  </details>
                  <button
                    className="primary-button authorize"
                    disabled={
                      !!busy ||
                      (!proposalIntent && (!readyToAuthorize || !validStake))
                    }
                    onClick={async () => {
                      if (proposalIntent) {
                        setView("activity");
                        return;
                      }
                      const result = await act(
                        "/api/authorize",
                        { proposalId: proposal?.id, side, stakeUnits },
                        "Authorizing agent",
                      );
                      if (result) setView("activity");
                    }}
                  >
                    {proposalIntent
                      ? proposalFunded
                        ? "View funded position"
                        : "View agent activity"
                      : busy === "Authorizing agent"
                        ? "Agent is starting…"
                        : "Authorize agent budget"}
                    <Arrow />
                  </button>
                  {proposalIntent ? (
                    <p className="authorization-note">
                      Budget delegated. Open its recorded activity.
                    </p>
                  ) : !proposal ? (
                    <p className="authorization-note">
                      Compose a basket to review its sources before authorizing.
                    </p>
                  ) : accepted && !readyToAuthorize ? (
                    <p className="authorization-note">
                      {!fundingOpen
                        ? "Funding has closed. Ask the agent for a fresh basket."
                        : proposal.error ||
                          "The immutable market must finish initialization before authorization."}
                    </p>
                  ) : !accepted ? (
                    <p className="authorization-note error-text">
                      This proposal did not pass validation.
                    </p>
                  ) : !validStake ? (
                    <p className="authorization-note error-text">
                      Enter a positive amount up to {amount(maxStake, decimals)}{" "}
                      {symbol}.
                    </p>
                  ) : (
                    <p className="authorization-note">
                      The agent may execute the approved scope immediately.
                    </p>
                  )}
                </section>
              </div>
              <section
                className="activity-preview"
                aria-labelledby="activity-title"
              >
                <div className="section-heading">
                  <h2 id="activity-title">Latest intent</h2>
                  {intent && (
                    <button
                      className="text-button"
                      onClick={() => setView("activity")}
                    >
                      Open activity <Arrow />
                    </button>
                  )}
                </div>
                {intent ? (
                  <div className="latest-intent">
                    <span className="mono">{short(intent.id)}</span>
                    <span>
                      {words(String(intent.side))} ·{" "}
                      {amount(intent.stakeUnits, decimals)} {symbol}
                    </span>
                    <Status value={intent.status} />
                    <TxLink
                      hash={activeSteps.findLast((step) => step.txHash)?.txHash}
                      explorer={explorer}
                    />
                  </div>
                ) : (
                  <div className="empty-row">
                    <span>No position funded yet.</span>
                    <span>
                      A validated proposal and your bounded authorization start
                      the first intent.
                    </span>
                  </div>
                )}
              </section>
            </>
          ) : (
            <div className="activity-layout">
              <section className="intent-panel" aria-labelledby="intent-title">
                <div className="section-heading">
                  <h2 id="intent-title">
                    {intent ? "Current intent" : "No active intent"}
                  </h2>
                  {intent && <Status value={intent.status} />}
                </div>
                {intent ? (
                  <>
                    <div className="intent-id mono">{intent.id}</div>
                    {intent.error && (
                      <p className="inline-error">{intent.error}</p>
                    )}
                    {intent.result ? (
                      <div className="basket-result">
                        <div>
                          <span>Basket result</span>
                          <strong>{intent.result}</strong>
                        </div>
                        <p>
                          Your {positionSide} position{" "}
                          {positionSide === intent.result
                            ? "won"
                            : "did not win"}
                          .
                        </p>
                      </div>
                    ) : basketVoided ? (
                      <div className="basket-result refund-result">
                        <div>
                          <span>Basket result</span>
                          <strong>Void</strong>
                        </div>
                        <p>
                          {buyerDelivery?.refund
                            ? "Your original stake was returned."
                            : "Original stakes are eligible for refund under the fixed policy."}
                        </p>
                      </div>
                    ) : null}
                    <div className="position-summary">
                      <div>
                        <span>Position</span>
                        <strong>
                          {String(intent.side) === "0"
                            ? "NO"
                            : String(intent.side) === "1"
                              ? "YES"
                              : intent.side}
                        </strong>
                      </div>
                      <div>
                        <span>{buyerFunded ? "Funded stake" : "Authorized stake"}</span>
                        <strong>
                          {amount(buyerFunded && intent.buyerStakeUnits !== undefined ? intent.buyerStakeUnits : intent.stakeUnits, decimals)}{" "}
                          <small>{symbol}</small>
                        </strong>
                      </div>
                      <div>
                        <span>Pool reserve</span>
                        <strong>
                          {amount(intent.reserveUnits, decimals)}{" "}
                          <small>{symbol}</small>
                        </strong>
                      </div>
                      <div>
                        <span>Collected</span>
                        <strong>
                          {amount(
                            buyerDelivery?.amountUnits ?? intent.payoutUnits,
                            decimals,
                          )}{" "}
                          <small>{symbol}</small>
                        </strong>
                      </div>
                    </div>
                    <div className="timeline">
                      {activeSteps.length ? (
                        activeSteps.map((step, index) => (
                          <div
                            className={`timeline-step ${isRejected(step.status) ? "rejected" : ""}`}
                            key={step.id || `${step.action}-${index}`}
                          >
                            <span
                              className={`step-dot ${isPending(step.status) ? "in-progress" : ""}`}
                            />
                            <div className="step-content">
                              <div className="step-title">
                                <h3>{step.action}</h3>
                                <span>{stamp(step.timestamp)}</span>
                              </div>
                              {step.message && <p>{step.message}</p>}
                              <div className="step-foot">
                                <Status value={step.status} />
                                <TxLink
                                  hash={step.txHash}
                                  explorer={explorer}
                                />
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="empty-row">
                          Intent recorded. Waiting for the first execution step.
                        </div>
                      )}
                    </div>
                    <button
                      className="quiet-button"
                      disabled={!!busy}
                      onClick={() =>
                        act(
                          "/api/run",
                          { intentId: intent.id },
                          "Reconciling intent",
                        )
                      }
                    >
                      {busy === "Reconciling intent"
                        ? "Reconciling…"
                        : "Reconcile and check sources"}
                      <Arrow />
                    </button>
                    <p className="footnote">
                      Receipt reconciliation happens before a retry. A submitted
                      transaction is never treated as confirmed until its
                      receipt is found.
                    </p>
                  </>
                ) : (
                  <div className="activity-empty">
                    <p>Your agent has not received a budget yet.</p>
                    <button
                      className="primary-button"
                      onClick={() => setView("compose")}
                    >
                      Compose the first basket
                      <Arrow />
                    </button>
                  </div>
                )}
              </section>
              <div className="activity-secondary">
                <section className="finality-panel">
                  <div className="section-heading">
                    <h2>Source finality</h2>
                    <button className="text-button" onClick={openEvidence}>
                      Evidence <Arrow diagonal />
                    </button>
                  </div>
                  {sourceMarkets.length ? (
                    sourceMarkets.map((market, index) => (
                      <div className="finality-row" key={market.id}>
                        <span className="source-letter">
                          {index === 0 ? "A" : "B"}
                        </span>
                        <div>
                          <p>{market.question}</p>
                          <Status
                            value={
                              intent?.sources?.find((s) => s.id === market.id)
                                ?.status ||
                              (market.closed
                                ? "Awaiting verified finality"
                                : "Awaiting resolution")
                            }
                          />
                          <span className="finality-update">
                            Source updated{" "}
                            {stamp(
                              intent?.sources?.find((s) => s.id === market.id)
                                ?.updatedAt || market.updatedAt,
                            )}
                          </span>
                          {intent?.sources?.find((s) => s.id === market.id)
                            ?.message &&
                            /await/i.test(
                              intent?.sources?.find((s) => s.id === market.id)
                                ?.status || "",
                            ) && (
                              <span className="source-check-note">
                                Final record not available yet. Funds stay
                                protected.
                              </span>
                            )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="muted">No source basket selected.</p>
                  )}
                  <p className="footnote">
                    Both final records must match the pinned request and outcome
                    order. Missing or ambiguous data leaves funds locked until
                    the fixed refund deadline.
                  </p>
                </section>
                <section className="collection-panel">
                  <h2>Collection policy</h2>
                  <dl className="mandate-details">
                    <div>
                      <dt>Beneficiary</dt>
                      <dd className="mono">
                        {config.buyerAddress ? short(config.buyerAddress) : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Market contract</dt>
                      <dd>
                        {contractAddress ? (
                          <a
                            className="mono"
                            href={`${explorer}/address/${contractAddress}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {short(contractAddress)}
                          </a>
                        ) : (
                          "Pending deployment"
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Funding authorization ends</dt>
                      <dd>
                        {fundingExpiry ? stamp(Number(fundingExpiry)) : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Agent recovery window ends</dt>
                      <dd>
                        {automationExpiry
                          ? stamp(Number(automationExpiry))
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Agent transaction limit</dt>
                      <dd>
                        {String(maxAgentTransactions)} total, application cap
                      </dd>
                    </div>
                    <div>
                      <dt>On valid outcome</dt>
                      <dd>One claim per position</dd>
                    </div>
                    <div>
                      <dt>On deadline / no data</dt>
                      <dd>Stake refund</dd>
                    </div>
                  </dl>
                  <p className="footnote">
                    Funding expiry stops new exposure. The agent can submit
                    evidence and collect until its separate recovery window
                    ends. Permissionless claim and refund remain available
                    afterward.
                  </p>
                  {counterpartyDelivery && (
                    <div className="counterparty-delivery">
                      <div>
                        <span>Counterparty test role</span>
                        <strong>
                          {counterpartyDelivery.refund
                            ? "Stake returned"
                            : "Delivered"}
                          : {amount(counterpartyDelivery.amountUnits, decimals)}{" "}
                          {symbol}
                        </strong>
                      </div>
                      <TxLink
                        hash={counterpartyDelivery.transactionHash}
                        explorer={explorer}
                      />
                    </div>
                  )}
                  <p className="footnote">
                    The counterparty is a separate test role. Their funding
                    receipt is recorded independently from the buyer agent.
                  </p>
                </section>
              </div>
            </div>
          )}
          <footer className="canvas-footer">
            <span>
              Attested source integrity. Source truth remains a trust
              assumption.
            </span>
            <span>AND / OR only</span>
          </footer>
        </main>
      </div>
      {selectedMarket && (
        <div
          className="dialog-backdrop"
          onClick={() => setSelectedMarket(null)}
        >
          <section
            className="market-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="source-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-heading">
              <h2 id="source-dialog-title">Source {selectedMarket.id}</h2>
              <button
                className="icon-button"
                aria-label="Close source details"
                onClick={() => setSelectedMarket(null)}
              >
                ×
              </button>
            </div>
            <p className="dialog-question">{selectedMarket.question}</p>
            <Status
              value={
                selectedMarket.closed
                  ? "Closed"
                  : Date.parse(selectedMarket.endDate || "") <= Date.now()
                    ? "Window ended"
                    : selectedMarket.eligible === false
                      ? "Unavailable"
                      : "Open"
              }
            />
            {selectedMarket.eligibilityReason && (
              <p className="muted">{selectedMarket.eligibilityReason}</p>
            )}
            <dl className="source-details">
              <div>
                <dt>Outcomes, in source order</dt>
                <dd>{selectedMarket.outcomes?.join(" / ") || "—"}</dd>
              </div>
              <div>
                <dt>Expected end</dt>
                <dd>{stamp(selectedMarket.endDate)}</dd>
              </div>
              <div>
                <dt>Upstream updated</dt>
                <dd>{stamp(selectedMarket.updatedAt)}</dd>
              </div>
              <div>
                <dt>Condition ID</dt>
                <dd className="mono break">
                  {selectedMarket.conditionId || "—"}
                </dd>
              </div>
              <div>
                <dt>Operation</dt>
                <dd>getMarketById</dd>
              </div>
              <div>
                <dt>Expected signer</dt>
                <dd className="mono break">
                  {selectedMarket.signer || "Pinned during validation"}
                </dd>
              </div>
              <div>
                <dt>Create request</dt>
                <dd className="mono break">
                  {selectedMarket.createRequestHash ||
                    "Pinned during validation"}
                </dd>
              </div>
              <div>
                <dt>Settlement request</dt>
                <dd className="mono break">
                  {selectedMarket.settlementRequestHash ||
                    "Pinned during validation"}
                </dd>
              </div>
            </dl>
            <p className="footnote">
              A fresh signature can wrap an old upstream record. Envelope time
              and source update time are checked separately. A closed flag alone
              never decides the payout.
            </p>
            {selectedMarket.slug && (
              <a
                className="quiet-button"
                href={`https://polymarket.com/market/${encodeURIComponent(selectedMarket.slug)}`}
                target="_blank"
                rel="noreferrer"
              >
                Open source market
                <Arrow diagonal />
              </a>
            )}
          </section>
        </div>
      )}
      {drawer && (
        <div className="dialog-backdrop" onClick={() => setDrawer(false)}>
          <section
            className="evidence-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="evidence-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-heading">
              <div>
                <h2 id="evidence-title">Inspect evidence</h2>
                <p>Submit the exact bytes the Airnode signed.</p>
              </div>
              <button
                className="icon-button"
                aria-label="Close evidence panel"
                onClick={() => setDrawer(false)}
              >
                ×
              </button>
            </div>
            <div className="evidence-network">
              <span>Contract</span>
              {evidenceContract ? (
                <a
                  className="mono"
                  href={`${explorer}/address/${evidenceContract}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {short(evidenceContract)}
                  <Arrow diagonal />
                </a>
              ) : (
                <span>Not deployed yet</span>
              )}
            </div>
            <label className="field-label" htmlFor="proof-source">
              Source to verify
            </label>
            <select
              id="proof-source"
              value={sourceIndex}
              onChange={(event) => setSourceIndex(Number(event.target.value))}
            >
              {[0, 1].map((index) => (
                <option value={index} key={index}>
                  {index === 0 ? "A" : "B"}
                  {evidenceSources[index]
                    ? ` · ${evidenceSources[index].id}`
                    : ""}
                </option>
              ))}
            </select>
            <label className="field-label" htmlFor="envelope">
              Signed response envelope
            </label>
            <textarea
              className="envelope-input mono"
              id="envelope"
              rows={9}
              value={envelope}
              onChange={(event) => setEnvelope(event.target.value)}
              placeholder={
                '{ "airnode": "0x…", "requestHash": "0x…", "timestamp": "…", "data": "…", "signature": "0x…" }'
              }
              spellCheck={false}
            />
            <p className="field-help">
              Keep data as its signed string. Reformatting its contents changes
              the bytes.
            </p>
            <button
              className="primary-button"
              disabled={!!busy || !evidenceContract || !envelope.trim()}
              onClick={() => inspectProof(false)}
            >
              {busy === "Submitting evidence"
                ? "Submitting…"
                : "Submit evidence to contract"}
              <Arrow />
            </button>
            {drawerError && (
              <p className="inline-error" role="alert">
                {drawerError}
              </p>
            )}
            {submittedProof && submittedProof.marketId === evidenceContract && (
              <div className="check-row">
                <span>Evidence submitted</span>
                <TxLink hash={submittedProof.txHash} explorer={explorer} />
              </div>
            )}
            <div className="tamper-section">
              <div className="section-heading">
                <h3>Contract rejection checks</h3>
                <button
                  className="text-button"
                  disabled={!!busy || !evidenceContract}
                  onClick={() => inspectProof(true)}
                >
                  {busy === "Checking rejection cases"
                    ? "Checking…"
                    : "Run checks"}
                  <Arrow />
                </button>
              </div>
              <p className="muted">
                Read-only RPC calls test source A against the deployed contract.
                Edited value, stale response, different request and wrong signer
                must fail before protected state changes.
              </p>
              {checks.length ? (
                <div className="check-list">
                  {checks.map((check, index) => (
                    <div className="check-row" key={`${check.name}-${index}`}>
                      <div>
                        <strong>{check.name}</strong>
                        {check.message && <p>{check.message}</p>}
                        <TxLink hash={check.txHash} explorer={explorer} />
                      </div>
                      <Status value={check.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-row">
                  No recorded checks for this market.
                </div>
              )}
            </div>
          </section>
        </div>
      )}
      {busy && (
        <div className="work-indicator" role="status">
          <span className="working-dot" />
          {busy}
          <span>Keep this window open or return to reconcile the intent.</span>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
