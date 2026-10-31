import React, { useEffect, useState } from "react";
import "./bsv.css";
const short = (s: any) =>
  typeof s === "string" && s.length > 24
    ? `${s.slice(0, 12)}…${s.slice(-8)}`
    : s || "—";
function Link({ hash, evm = false }: { hash?: string; evm?: boolean }) {
  return hash ? (
    <a
      className="bsv-hash"
      href={
        evm
          ? `https://sepolia.basescan.org/tx/${hash}`
          : `https://test.whatsonchain.com/tx/${hash}`
      }
      target="_blank"
      rel="noreferrer"
    >
      {short(hash)} ↗
    </a>
  ) : (
    <span>—</span>
  );
}
async function request(action: string, body?: any) {
  const r = await fetch(
    `/api/bsv/${action}`,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {},
  );
  const j = await r.json();
  if (!r.ok) throw Error(j.error || "Request failed");
  return j;
}
export default function BsvApp() {
  const [state, setState] = useState<any>(null),
    [objective, setObjective] = useState(
      "Ethereum Up OR Solana Up in the same next 5-minute window.",
    ),
    [stake, setStake] = useState("5000"),
    [side, setSide] = useState("YES"),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [cp, setCp] = useState<any>(null),
    [proof, setProof] = useState(""),
    [proofResult, setProofResult] = useState("");
  const refresh = async () => setState(await request("state"));
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
    const t = setInterval(() => refresh().catch(() => {}), 7000);
    return () => clearInterval(t);
  }, []);
  const act = async (label: string, action: string, body: any = {}) => {
    if (busy) return;
    setBusy(label);
    setError("");
    try {
      const r = await request(action, body);
      if (action === "counterparty") setCp(r);
      else if (action === "verify") setProofResult(JSON.stringify(r, null, 2));
      else setState(r);
    } catch (e: any) {
      setError(e.message);
      await refresh().catch(() => {});
    } finally {
      setBusy("");
    }
  };
  const p = state?.proposal,
    j = state?.intent,
    w = state?.wallet,
    valid = p?.objective === objective,
    hasActive = j && !["Paid", "Refunded"].includes(j.status);
  return (
    <div className="bsv-app" data-ui>
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
          <span>BSV baskets</span>
        </nav>
        <span className="bsv-network">BSV testnet</span>
      </header>
      <main className="bsv-main">
        <div className="bsv-heading">
          <div>
            <h1>
              {j?.status === "Paid"
                ? `Basket settled: ${j.result ? "YES" : "NO"}`
                : "Fund the basket in satoshis"}
            </h1>
            <p>
              {j?.status === "Paid"
                ? `Buyer ${j.payout.winner === "buyer" ? j.payout.satoshis.toLocaleString() : 0} sats · counterparty ${j.payout.winner === "counterparty" ? j.payout.satoshis.toLocaleString() : 0} sats received.`
                : "Two outcomes. One fixed rule. A bounded agent stake."}
            </p>
          </div>
          {j?.status === "Paid" ? (
            <a
              className="bsv-receipt"
              href={`https://test.whatsonchain.com/tx/${j.payout.txid}`}
              target="_blank"
              rel="noreferrer"
            >
              View payout receipt ↗
            </a>
          ) : (
            <button
              disabled={!!busy}
              onClick={() => refresh().catch((e) => setError(e.message))}
            >
              Refresh state
            </button>
          )}
        </div>
        <div className="bsv-trust">
          <strong>Settlement trust</strong>
          <span>
            Original API3 proofs are verified on Base Sepolia. A separate
            attestor co-signs the BSV payout with a participant. BSV Script does
            not verify EVM consensus or upstream truth. This test backend holds
            both attestor and seeded counterparty keys; independent custody is
            not proven.
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
              <h2>Source basket</h2>
              <span>{p ? `Model ${p.model}` : "No basket selected"}</span>
            </div>
            <label htmlFor="bsv-objective">Your exact objective</label>
            <textarea
              id="bsv-objective"
              value={objective}
              maxLength={1000}
              disabled={!!busy || !!hasActive}
              onChange={(e) => setObjective(e.target.value)}
            />
            <div className="bsv-actions">
              <button
                disabled={!!busy || !!hasActive}
                onClick={() =>
                  act("Reviewing source basket", "propose", { objective })
                }
              >
                {busy === "Reviewing source basket"
                  ? "Checking sources and model…"
                  : "Review exact basket"}
              </button>
              <span>Bounded catalog · AND / OR · 5 / 15 minutes</span>
            </div>
            {p ? (
              <>
                <div className="bsv-source-pair">
                  {p.sources.map((s: any, i: number) => (
                    <article key={s.id}>
                      <div className="bsv-source-label">
                        Source {i ? "B" : "A"} · {s.id}
                      </div>
                      <h3>{s.question}</h3>
                      <p className="bsv-selected">
                        {s.outcomes?.[p.selectedOutcomeIndexes[i]]}
                      </p>
                      <dl>
                        <div>
                          <dt>Closes</dt>
                          <dd>
                            {new Date(s.endDate).toLocaleTimeString("en-GB")}
                          </dd>
                        </div>
                        <div>
                          <dt>Condition</dt>
                          <dd title={s.conditionId}>{short(s.conditionId)}</dd>
                        </div>
                        <div>
                          <dt>Source updated</dt>
                          <dd>
                            {new Date(s.updatedAt).toLocaleTimeString("en-GB")}
                          </dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
                <div className="bsv-rule">
                  <strong>{p.operator}</strong>
                  <p>
                    {p.operator === "AND"
                      ? "Both selected outcomes must win."
                      : "At least one selected outcome must win."}
                  </p>
                  <span>
                    {valid
                      ? "Exact objective reviewed"
                      : "Objective changed: review again"}
                  </span>
                </div>
                <div className="bsv-model-note">
                  Real {p.modelRecord?.model} call ·{" "}
                  {(p.modelRecord?.latencyMs / 1000).toFixed(1)}s · independent
                  source and intent validator
                </div>
              </>
            ) : (
              <div className="bsv-empty">
                Review a future basket to see its two source records, outcome
                indexes and locked rule. Unsupported objectives create no
                position.
              </div>
            )}
          </section>
          <section className="bsv-panel">
            <div className="bsv-panel-title">
              <h2>Agent mandate</h2>
              <span>{j?.status || "Not authorized"}</span>
            </div>
            <div className="bsv-wallet">
              <div>
                <strong>
                  {w?.identity ? short(w.identity) : "Standard wallet"}
                </strong>
                <p>
                  {w
                    ? "Testnet connected · balance stays private in wallet"
                    : "Connect BSV Desktop or BSV Browser on testnet."}
                </p>
              </div>
              <button
                disabled={!!busy}
                onClick={() => act("Connecting wallet", "connect")}
              >
                {w ? "Check wallet" : "Connect testnet wallet"}
              </button>
            </div>
            <label htmlFor="bsv-stake">Your collateral · satoshis</label>
            <input
              id="bsv-stake"
              type="number"
              min="3000"
              max="10000"
              step="1000"
              disabled={!!busy || !!hasActive}
              value={stake}
              onChange={(e) => setStake(e.target.value)}
            />
            <label htmlFor="bsv-side">Basket position</label>
            <select
              id="bsv-side"
              value={side}
              disabled={!!busy || !!hasActive}
              onChange={(e) => setSide(e.target.value)}
            >
              <option>YES</option>
              <option>NO</option>
            </select>
            <dl className="bsv-terms">
              <div>
                <dt>Collateral cap</dt>
                <dd>{Number(stake).toLocaleString()} sats · one funding</dd>
              </div>
              <div>
                <dt>Fee guard</dt>
                <dd>≤1,000 sats per transaction</dd>
              </div>
              <div>
                <dt>Data fee</dt>
                <dd>0 · free Polymarket operation</dd>
              </div>
              <div>
                <dt>Beneficiary</dt>
                <dd>App-pinned wallet-derived key</dd>
              </div>
              <div>
                <dt>Reserve control</dt>
                <dd>Attestor + one participant</dd>
              </div>
              <div>
                <dt>Refund</dt>
                <dd>Signed before collateral broadcast</dd>
              </div>
            </dl>
            <button
              className="bsv-primary"
              disabled={
                !!busy || !valid || w?.network !== "testnet" || !!hasActive
              }
              onClick={() =>
                act("Authorizing bounded stake", "authorize", {
                  proposalId: p.id,
                  objective,
                  side,
                  stakeSatoshis: Number(stake),
                })
              }
            >
              {busy === "Authorizing bounded stake"
                ? "Preparing protected collateral…"
                : "Authorize BSV stake"}
            </button>
            <p className="bsv-note">
              One initial mandate starts the agent workflow. Wallet permission
              prompts remain under your control. No mainnet payment or automatic
              top-up.
            </p>
            <details>
              <summary>Seeded counterparty test role</summary>
              <p>
                A separate Wallet Toolbox wallet funds the opposite position. It
                is a test participant, not an independent customer.
              </p>
              <button
                disabled={!!busy}
                onClick={() => act("Inspecting counterparty", "counterparty")}
              >
                Inspect test role
              </button>
              {cp && (
                <p className="bsv-code">
                  {cp.identity}
                  <br />
                  {cp.balanceSatoshis} test satoshis
                </p>
              )}
            </details>
          </section>
        </div>
        <div className="bsv-lower">
          <section className="bsv-panel">
            <div className="bsv-panel-title">
              <h2>Execution ledger</h2>
              <button
                disabled={!!busy || !j}
                onClick={() => act("Reconciling intent", "run")}
              >
                Reconcile intent
              </button>
            </div>
            {j ? (
              <>
                <div className="bsv-result">
                  <strong>
                    {j.status === "Paid"
                      ? `${j.result ? "YES" : "NO"} · settled`
                      : j.status}
                  </strong>
                  <span>
                    {j.payout?.satoshis
                      ? `${j.payout.satoshis.toLocaleString()} sats → ${j.payout.winner}`
                      : (j.waitingReason
                          ? "Waiting for an admissible final source response. No payout."
                          : "") ||
                        "Fixed inputs and outputs are checked before signing."}
                  </span>
                </div>
                <ol className="bsv-ledger">
                  {j.steps?.map((s: any, i: number) => (
                    <li key={i}>
                      <span>{new Date(s.at).toLocaleTimeString("en-GB")}</span>
                      <div>
                        <strong>{s.action}</strong>
                        <p>{s.message}</p>
                        <Link hash={s.txid} evm={s.txid?.startsWith("0x")} />
                      </div>
                      <span>{s.status}</span>
                    </li>
                  ))}
                </ol>
                {!j.steps?.length && (
                  <div className="bsv-empty">
                    No collateral transaction has been broadcast.
                  </div>
                )}
              </>
            ) : (
              <div className="bsv-empty">
                No BSV mandate yet. EVM V1 and V2 history stays on its own
                routes.
              </div>
            )}
          </section>
          <section className="bsv-panel">
            <div className="bsv-panel-title">
              <h2>Funds & proof</h2>
              <span>Separate evidence</span>
            </div>
            <dl className="bsv-terms">
              <div>
                <dt>BSV collateral</dt>
                <dd>
                  {j?.fundings?.length
                    ? j.fundings
                        .reduce(
                          (n: number, f: any) =>
                            n +
                            (f.broadcast?.status === "success"
                              ? f.satoshis
                              : 0),
                          0,
                        )
                        .toLocaleString() + " sats"
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>API3 approval</dt>
                <dd>{short(j?.approvalAddress)}</dd>
              </div>
              <div>
                <dt>Original proof gate</dt>
                <dd>
                  {j?.initializationTx ? (
                    <Link hash={j.initializationTx} evm />
                  ) : (
                    "Pending deployment"
                  )}
                </dd>
              </div>
              <div>
                <dt>Settlement</dt>
                <dd>
                  <Link hash={j?.payout?.txid} />
                </dd>
              </div>
            </dl>
            {j?.fundings?.map((f: any) => (
              <div className="bsv-refund" key={f.role}>
                <strong>{f.role} collateral</strong>
                <Link hash={f.txid} />
                <p>
                  {f.refundReadyBeforeFunding
                    ? "Fixed-output refund saved before broadcast"
                    : "Refund not prepared"}
                </p>
                {f.refundReadyBeforeFunding && (
                  <a href={`/api/bsv/refund/${f.role}`} download>
                    {j.status === "Paid"
                      ? "Archived refund · inputs consumed"
                      : "Save signed refund"}
                  </a>
                )}
              </div>
            ))}
            <p className="bsv-note">
              Current test topology does not satisfy independent custody: the
              backend holds attestor and seeded counterparty keys. An external
              signer or a proven native covenant is still required. A valid
              signature authenticates the source; it does not prove the market
              outcome is true.
            </p>
          </section>
        </div>
        <details className="bsv-proof">
          <summary>
            Submit an API3 response to the deployed approval verifier
          </summary>
          <p>
            Paste the original source A envelope. This check is read-only; an
            invalid proof cannot create a BSV payment.
          </p>
          <textarea
            aria-label="Original API3 envelope"
            value={proof}
            onChange={(e) => setProof(e.target.value)}
            placeholder='{"timestamp":...,"data":"...","signature":"0x..."}'
          />
          <button
            disabled={!!busy || !j?.approvalAddress}
            onClick={() => {
              try {
                act("Checking original proof", "verify", {
                  index: 0,
                  envelope: JSON.parse(proof),
                  terminal: true,
                });
              } catch (e: any) {
                setError(e.message);
              }
            }}
          >
            Check response
          </button>
          {proofResult && <pre>{proofResult}</pre>}
        </details>
        <footer className="bsv-footer">
          <p>
            Worthless test funds only. Native BSV collateral with a trusted
            EVM-to-BSV attestor; no bridge, native API3 verifier or customer
            adoption claim.
          </p>
          <a
            href="https://github.com/ABerkeBora/heka-second-order/tree/codex/bsv"
            target="_blank"
            rel="noreferrer"
          >
            Source & run instructions ↗
          </a>
        </footer>
      </main>
      {busy && (
        <div className="bsv-working" role="status">
          {busy}
        </div>
      )}
    </div>
  );
}
