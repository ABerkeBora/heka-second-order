import React, { useState, useEffect } from "react";
import "./bsv.css";
const short = (s: string) => (s ? `${s.slice(0, 12)}…${s.slice(-8)}` : "—");
const time = (v: number) =>
  new Date(v * 1000).toLocaleString("en-GB", {
    timeZone: "Europe/Berlin",
    hour12: false,
  }) + " Berlin";
async function api(action: string, body?: any) {
  const r = await fetch(
    `/api/bsv/native/${action}`,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {},
  );
  const j = await r.json();
  if (!r.ok) throw Error(j.error);
  return j;
}
export default function NativeBsvApp() {
  const [state, setState] = useState<any>(null),
    [objective, setObjective] = useState(
      "Ethereum Up OR Solana Up in the same next 5-minute window.",
    ),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const refresh = async () => setState(await api("state"));
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
    const t = setInterval(() => refresh().catch(() => {}), 10000);
    return () => clearInterval(t);
  }, []);
  const act = async (label: string, action: string, body: any) => {
    setBusy(label);
    setError("");
    try {
      await api(action, body);
      await refresh();
    } catch (e: any) {
      setError(e.message);
      await refresh();
    } finally {
      setBusy("");
    }
  };
  const p = state?.proposal,
    j = state?.intent,
    gate = state?.resourceGate,
    blocked = gate?.status !== "PASS";
  return (
    <div className="bsv-app bsv-native" data-ui>
      <header className="bsv-top">
        <a className="bsv-brand" href="/">
          <svg viewBox="0 0 28 28" aria-hidden="true">
            <path
              d="M3 3h13v13H3zM12 12h13v13H12z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
          Second Order
        </a>
        <nav>
          <a href="/">EVM V1</a>
          <a href="/next">Exact target</a>
          <a href="/bsv">Paid BSV basket</a>
          <span>Native policy</span>
        </nav>
        <span className="bsv-network">BSV testnet</span>
      </header>
      <main className="bsv-main">
        <div className="bsv-heading">
          <div>
            <h1>Two sources. One Script.</h1>
            <p>Original API3 signatures decide a fixed BSV basket payout.</p>
          </div>
          <button
            onClick={() => refresh().catch((e) => setError(e.message))}
            disabled={!!busy}
          >
            Refresh state
          </button>
        </div>
        <div className="bsv-trust">
          <strong>
            {blocked ? "Funding blocked" : "Execution gate verified"}
          </strong>
          <span>
            {gate?.reason || "Checking native node execution evidence…"} Local
            compiled Script validation is separate from an accepted network
            payout.
          </span>
        </div>
        {error && (
          <div className="bsv-error" role="alert">
            {error}
          </div>
        )}
        <div className="bsv-work">
          <section className="bsv-panel">
            <div className="bsv-panel-title">
              <h2>Compose the basket</h2>
              <span>{p ? `Model ${p.model}` : "No selected sources"}</span>
            </div>
            <label htmlFor="native-objective">Your exact objective</label>
            <textarea
              id="native-objective"
              maxLength={1000}
              value={objective}
              disabled={!!busy || !!j?.buyerSource}
              onChange={(e) => setObjective(e.target.value)}
            />
            <div className="bsv-actions">
              <button
                disabled={!!busy || !!j?.buyerSource}
                onClick={() =>
                  act("Finding exact future sources", "propose", { objective })
                }
              >
                {busy === "Finding exact future sources"
                  ? "Checking sources and model…"
                  : "Review exact basket"}
              </button>
              <span>Bounded AND / OR · exact time window</span>
            </div>
            {p && (
              <>
                <div className="bsv-source-pair">
                  {p.sources.map((s: any, i: number) => (
                    <article key={s.id}>
                      <div className="bsv-source-label">
                        Source {i ? "B" : "A"} · {s.id}
                      </div>
                      <h3>{s.question}</h3>
                      <p className="bsv-selected">
                        {s.outcomes[p.selectedOutcomeIndexes[i]]}
                      </p>
                      <dl>
                        <div>
                          <dt>Ends</dt>
                          <dd>{time(Date.parse(s.endDate) / 1000)}</dd>
                        </div>
                        <div>
                          <dt>Condition</dt>
                          <dd title={s.conditionId}>{short(s.conditionId)}</dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
                <div className="bsv-rule">
                  <strong>{p.operator}</strong>
                  <p>
                    {p.operator === "OR"
                      ? "At least one selected outcome must win."
                      : "Both selected outcomes must win."}{" "}
                    Exact one-hot final prices, closed=true and resolved status
                    are required.
                  </p>
                </div>
                <div className="bsv-actions">
                  <button
                    disabled={
                      !!busy || p.objective !== objective || !!j?.buyerSource
                    }
                    onClick={() =>
                      act("Compiling immutable native policy", "prepare", {
                        proposalId: p.id,
                        stakeSatoshis: 5000,
                        acceptFixedObservationWindow: true,
                        previewOnly: true,
                      })
                    }
                  >
                    {busy === "Compiling immutable native policy"
                      ? "Compiling policy…"
                      : "Preview native policy"}
                  </button>
                  <span>No payment or wallet signature</span>
                </div>
              </>
            )}
          </section>
          <section className="bsv-panel">
            <div className="bsv-panel-title">
              <h2>Protected payment</h2>
              <span>{j?.status || "No native pool"}</span>
            </div>
            <dl className="bsv-terms">
              <div>
                <dt>Buyer mandate</dt>
                <dd>5,000 sats, once</dd>
              </div>
              <div>
                <dt>Counterparty stake</dt>
                <dd>5,000 sats</dd>
              </div>
              <div>
                <dt>Winner receives</dt>
                <dd>Full 10,000-sat pool</dd>
              </div>
              <div>
                <dt>Deployment fee</dt>
                <dd>Separate sponsor · 13,000-sat cap</dd>
              </div>
              <div>
                <dt>Payment fee</dt>
                <dd>External input · 1,000-sat cap</dd>
              </div>
              <div>
                <dt>Data fee</dt>
                <dd>Free operation · 0 sats</dd>
              </div>
            </dl>
            <p className="bsv-note">
              No attestor decision key. Bitcoin Script checks two original
              Airnode signatures, exact request hashes, market and condition
              identity, outcome order, finality and fixed payout outputs. The
              source's own resolution remains a trust assumption.
            </p>
            {j && (
              <>
                <dl className="bsv-terms">
                  <div>
                    <dt>Script commitment</dt>
                    <dd title={j.script.lockingScriptSha256}>
                      {short(j.script.lockingScriptSha256)}
                    </dd>
                  </div>
                  <div>
                    <dt>Compiled locking Script</dt>
                    <dd>
                      {j.script.lockingScriptBytes.toLocaleString()} bytes
                    </dd>
                  </div>
                  <div>
                    <dt>Observation closes</dt>
                    <dd>{time(j.policy.observationDeadline)}</dd>
                  </div>
                  <div>
                    <dt>Refund matures</dt>
                    <dd>{time(j.policy.refundAfter)}</dd>
                  </div>
                  <div>
                    <dt>Wallet mandate signed</dt>
                    <dd>
                      {j.mandateSignatureVerified ? "Yes" : "No · preview only"}
                    </dd>
                  </div>
                  <div>
                    <dt>New pool funded</dt>
                    <dd>
                      {j.funding?.accepted ? "Confirmed by network" : "No"}
                    </dd>
                  </div>
                </dl>
                {j.payout && (
                  <p>
                    <a
                      className="bsv-hash"
                      href={`https://test.whatsonchain.com/tx/${j.payout.txid}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View actual payout {short(j.payout.txid)} ↗
                    </a>
                  </p>
                )}
              </>
            )}
            <div className="bsv-actions">
              <button
                disabled={!!busy || blocked || !p}
                onClick={() =>
                  act("Authorizing bounded native stake", "prepare", {
                    proposalId: p.id,
                    stakeSatoshis: 5000,
                    acceptFixedObservationWindow: true,
                  })
                }
              >
                Authorize 5,000 test sats
              </button>
              <span>
                {blocked
                  ? "Public-node execution evidence required"
                  : "One initial delegation; no automatic top-up"}
              </span>
            </div>
          </section>
        </div>
        <section className="bsv-panel" style={{ marginTop: 24 }}>
          <div className="bsv-panel-title">
            <h2>Fixed observation policy</h2>
            <span>Different from EVM expiry semantics</span>
          </div>
          <p className="bsv-note">{state?.timing}</p>
          <p className="bsv-note">
            The 12 MB experimental guard has passed local compiled VM tests.
            Public-node operation and validation-time limits currently block a
            demonstrated native payout. The completed{" "}
            <a href="/bsv">attestor-based BSV basket</a> has real collateral and
            a mined payout, with its different custody assumptions shown there.
          </p>
          {j?.steps?.map((s: any, i: number) => (
            <div className="bsv-step" key={i}>
              <strong>{s.action}</strong>
              <span>{s.message}</span>
            </div>
          ))}
        </section>
        {busy && (
          <div className="work-indicator" role="status">
            {busy}…
          </div>
        )}
      </main>
    </div>
  );
}
