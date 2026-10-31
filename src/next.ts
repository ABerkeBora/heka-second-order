import { state, save, evidence, cleanError, storeNamespace } from "./store.ts";
import { discoverMarkets, prepareProposal, authorize } from "./engine.ts";
import { proposeIntent } from "./llm.ts";
import { parseIntent, matchIntent, equalIntent } from "./intent.ts";
import { transactions } from "./chain.ts";
import {
  createProof,
  outcomesOf,
  outcomeHash,
  MAX_SOURCE_AGE,
} from "./source.ts";

function requireNext() {
  if (storeNamespace() !== "next")
    throw Error("V2 requires its isolated namespace");
}
function recordReview(review: any) {
  state.intentReview = review;
  save();
  evidence(`intent-review-${review.id}.json`, review);
  return review;
}
function noAction(review: any, reasons: any[]) {
  state.proposal = undefined;
  return recordReview({
    ...review,
    status: "unsupported/no-action",
    reasons,
    decidedAt: new Date().toISOString(),
    economicAction: "none",
  });
}
export async function composeNext(objective: string) {
  requireNext();
  const review: any = {
    id: crypto.randomUUID(),
    objective,
    createdAt: new Date().toISOString(),
    status: "checking",
    reasons: [],
  };
  state.proposal = undefined;
  recordReview(review);
  const parsed = parseIntent(objective);
  if (parsed.status !== "supported") return noAction(review, parsed.reasons);
  review.normalized = parsed.intent;
  let preparationJournalSnapshot: string | undefined;
  let preparationHadPending = false;
  try {
    if (
      state.markets.filter(
        (m) =>
          m.eligible &&
          Date.parse(m.endDate) > Date.now() + 180000 &&
          Date.now() - Date.parse(m.updatedAt) <= MAX_SOURCE_AGE * 1000,
      ).length < 2
    )
      await discoverMarkets();
    const catalogMatches: any[] = [];
    for (let a = 0; a < state.markets.length; a++)
      for (let b = a + 1; b < state.markets.length; b++)
        for (const first of [0, 1])
          for (const second of [0, 1]) {
            const candidate = matchIntent(
              parsed.intent,
              {
                marketIds: [state.markets[a].id, state.markets[b].id],
                selectedOutcomeIndexes: [first, second],
                operator: parsed.intent.operator,
              },
              state.markets,
            );
            if (candidate.status === "matched")
              catalogMatches.push(candidate.matches);
          }
    review.catalogCheck = {
      checkedAt: new Date().toISOString(),
      requestHash: state.discovery?.requestHash,
      candidateIds: state.markets.map((m) => m.id),
      matchingPairs: catalogMatches.length,
    };
    if (!catalogMatches.length)
      return noAction(review, [
        {
          code: "NO_CATALOG_MATCH",
          message:
            "The authenticated discovered catalog has no pair matching both requested assets, Up/Down event, directions and exact future window. No alternative was substituted.",
        },
      ]);
    const model = await proposeIntent(objective, state.markets, catalogMatches);
    review.model = {
      id: model.id,
      name: model.model,
      decision: model.decision,
      reason: model.reason,
      normalized: model.normalized,
      startedAt: model.startedAt,
      latencyMs: model.latencyMs,
    };
    if (model.decision !== "accept")
      return noAction(review, [
        { code: "model_no_match", message: model.reason },
      ]);
    if (!equalIntent(parsed.intent, model.normalized))
      return noAction(review, [
        {
          code: "normalization_mismatch",
          message:
            "The model changed the requested asset, event, direction, time or operator. No position was prepared.",
        },
      ]);
    const proposal: any = {
      id: crypto.randomUUID(),
      marketIds: model.marketIds,
      selectedOutcomeIndexes: model.selectedOutcomeIndexes,
      operator: model.normalized!.operator,
      reason: model.reason,
      model: model.model,
      createdAt: new Date().toISOString(),
      startedAt: model.startedAt,
      latencyMs: model.latencyMs,
      normalizedIntent: model.normalized,
    };
    const match = matchIntent(parsed.intent, proposal, state.markets);
    if (match.status !== "matched") return noAction(review, match.reasons);
    review.matches = match.matches;
    // Re-check each exact identity against fresh signed open records before any deployment or mint.
    const sources = [];
    for (const id of proposal.marketIds) {
      const old = state.markets.find((m) => m.id === id);
      const { response, data } = await createProof(id);
      if (
        !old ||
        old.conditionId !== data.conditionId ||
        Date.parse(old.endDate) !== Date.parse(data.endDate) ||
        outcomeHash(old.outcomes) !== outcomeHash(outcomesOf(data.outcomes))
      )
        return noAction(review, [
          {
            code: "source_changed",
            message:
              "A signed source identity, outcome order or window changed before preparation.",
          },
        ]);
      sources.push({
        ...old,
        updatedAt: data.updatedAt,
        createEnvelope: response,
      });
    }
    const freshMatch = matchIntent(parsed.intent, proposal, sources);
    if (freshMatch.status !== "matched")
      return noAction(review, freshMatch.reasons);
    review.status = "accepted";
    review.matches = freshMatch.matches;
    review.proposalId = proposal.id;
    review.decidedAt = new Date().toISOString();
    review.economicAction = "Awaiting bounded mandate";
    proposal.sourceMarkets = sources;
    proposal.intentReview = { ...review };
    proposal.validator = {
      accepted: true,
      reason:
        "Independent asset, event, direction, operator and exact future window checks passed",
    };
    state.proposal = proposal;
    state.proposals.push(proposal);
    recordReview(review);
    preparationJournalSnapshot = JSON.stringify(transactions());
    preparationHadPending = transactions().some(
      (t: any) => !["success", "reverted"].includes(t.status),
    );
    await prepareProposal(proposal);
    evidence(`intent-review-${review.id}.json`, review);
    return proposal;
  } catch (error) {
    if (
      state.intentReview?.status === "accepted" &&
      state.proposal?.intentReview?.id === review.id
    ) {
      if (
        !preparationHadPending &&
        preparationJournalSnapshot === JSON.stringify(transactions())
      )
        return noAction(review, [
          { code: "PREPARATION_REJECTED", message: cleanError(error) },
        ]);
      state.proposal.error = cleanError(error);
      save();
      throw error;
    }
    return noAction(review, [
      { code: "validation_unavailable", message: cleanError(error) },
    ]);
  }
}
export async function authorizeNext(body: any) {
  requireNext();
  const r = state.intentReview,
    p = state.proposal;
  if (
    !r ||
    r.status !== "accepted" ||
    !p ||
    r.proposalId !== p.id ||
    p.id !== body.proposalId ||
    p.intentReview?.id !== r.id ||
    body.reviewId !== r.id ||
    body.objective !== r.objective
  )
    throw Error(
      "Check the exact current objective before delegating. Unsupported or changed objectives cannot fund a previous proposal.",
    );
  const parsed = parseIntent(body.objective);
  if (
    parsed.status !== "supported" ||
    !equalIntent(parsed.intent, p.normalizedIntent)
  )
    throw Error("Objective normalization changed; check it again");
  const match = matchIntent(parsed.intent, p, p.sourceMarkets);
  if (match.status !== "matched")
    throw Error(match.reasons.map((r: any) => r.message).join(" "));
  return authorize(p.id, body.side, String(body.stakeUnits));
}
