import {
  deriveRequestHash,
  fetchSignedResponse,
  verifySignedResponse,
  type SignedResponse,
} from "./vendor/airnode-v2.ts";
import { encodeAbiParameters, keccak256, type Address } from "viem";
import { evidence } from "./store.ts";
export const AIRNODE_URL = "https://airnode-polymarket.fly.dev/";
export const AIRNODE = "0xbb451127f6d8B2bAEfB9ddFb7c724DAc38Eb9D2E" as Address;
export const MAX_ENVELOPE_AGE = 300,
  MAX_SOURCE_AGE = 900;
export const createProjection = {
  marketId: "/id",
  conditionId: "/conditionId",
  closed: "/closed",
  endDate: "/endDate",
  outcomes: "/outcomes",
  updatedAt: "/updatedAt",
};
export const settlementProjection = {
  marketId: "/id",
  conditionId: "/conditionId",
  closed: "/closed",
  status: "/umaResolutionStatus",
  outcomes: "/outcomes",
  outcomePrices: "/outcomePrices",
  updatedAt: "/updatedAt",
};
export const requestFor = (id: string, settlement = false) => ({
  operation: "getMarketById",
  parameters: { id },
  responseProjection: settlement ? settlementProjection : createProjection,
});
export function outcomesOf(value: unknown): string[] {
  const a = typeof value === "string" ? JSON.parse(value) : value;
  if (
    !Array.isArray(a) ||
    a.length !== 2 ||
    a.some((v) => typeof v !== "string" || v.length > 120) ||
    a[0] === a[1]
  )
    throw Error("Only two distinct outcome labels are supported");
  return a;
}
export const outcomeHash = (outcomes: string[]) =>
  keccak256(
    encodeAbiParameters(
      [{ type: "string" }, { type: "string" }],
      outcomes as [string, string],
    ),
  );
export async function signed(request: any) {
  const hash = deriveRequestHash(request);
  const response = await fetchSignedResponse(AIRNODE_URL, request, (u, o) =>
    fetch(u, { ...o, signal: AbortSignal.timeout(25000) }),
  );
  await verifySignedResponse(response, AIRNODE, hash);
  return response;
}
export function checkTiming(
  response: SignedResponse,
  data: any,
  now = Math.floor(Date.now() / 1000),
) {
  const t = Number(response.timestamp),
    updated = Date.parse(data.updatedAt) / 1000;
  if (!Number.isSafeInteger(t) || t > now + 30 || now - t > MAX_ENVELOPE_AGE)
    throw Error("Envelope is stale or from the future");
  if (
    !Number.isFinite(updated) ||
    updated > now + 30 ||
    now - updated > MAX_SOURCE_AGE
  )
    throw Error("Upstream record is stale or has an invalid update time");
  return updated;
}
export async function createProof(id: string) {
  const response = await signed(requestFor(id));
  const data = JSON.parse(response.data);
  checkTiming(response, data);
  if (
    data.marketId !== id ||
    data.closed !== false ||
    !Number.isFinite(Date.parse(data.endDate)) ||
    Date.parse(data.endDate) < Date.now() + 90000
  )
    throw Error(
      "Market must be open and end at least 90 seconds in the future",
    );
  outcomesOf(data.outcomes);
  return { response, data };
}
export async function discover(preferredAssets?: string[]) {
  const now = Date.now();
  const request = {
    operation: "listMarkets",
    parameters: {
      limit: 30,
      closed: false,
      order: "endDate",
      ascending: true,
      end_date_min: new Date(now + 8 * 60000).toISOString(),
      end_date_max: new Date(now + 70 * 60000).toISOString(),
    },
  };
  const listing = await signed(request);
  const rows = JSON.parse(listing.data);
  if (!Array.isArray(rows))
    throw Error("Discovery did not return a market array");
  const preferred = (m: any) =>
    preferredAssets?.some((a) =>
      String(m.question)
        .toLowerCase()
        .startsWith(a + " up or down"),
    )
      ? 0
      : 1;
  const candidates = rows
    .toSorted((a: any, b: any) => preferred(a) - preferred(b))
    .filter(
      (m: any) =>
        m.id &&
        m.conditionId &&
        !m.closed &&
        Date.parse(m.endDate) > now + 8 * 60000,
    )
    .slice(0, 10);
  const markets = [];
  for (const m of candidates) {
    try {
      const { response, data } = await createProof(String(m.id));
      const outcomes = outcomesOf(data.outcomes);
      markets.push({
        id: String(m.id),
        question: String(m.question).slice(0, 240),
        slug: String(m.slug || ""),
        conditionId: data.conditionId,
        outcomes,
        outcomePrices:
          typeof m.outcomePrices === "string"
            ? JSON.parse(m.outcomePrices)
            : m.outcomePrices,
        endDate: data.endDate,
        updatedAt: data.updatedAt,
        closed: false,
        eligible: true,
        signer: AIRNODE,
        createRequestHash: deriveRequestHash(requestFor(String(m.id))),
        settlementRequestHash: deriveRequestHash(
          requestFor(String(m.id), true),
        ),
        createEnvelope: response,
      });
    } catch (error) {
      markets.push({
        id: String(m.id),
        question: String(m.question).slice(0, 240),
        endDate: m.endDate,
        updatedAt: m.updatedAt,
        outcomes: [],
        closed: !!m.closed,
        eligible: false,
        eligibilityReason:
          error instanceof Error ? error.message : "Source rejected",
      });
    }
    if (markets.filter((m) => m.eligible).length >= 6) break;
  }
  evidence("latest-discovery.json", {
    checkedAt: new Date().toISOString(),
    request,
    listing,
    markets,
  });
  return {
    markets,
    checkedAt: new Date().toISOString(),
    requestHash: listing.requestHash,
  };
}
export async function settlementProof(id: string) {
  const response = await signed(requestFor(id, true));
  const data = JSON.parse(response.data);
  checkTiming(response, data);
  if (data.closed !== true || data.status !== "resolved")
    throw Error("Source has not reached resolved finality");
  const prices = outcomesOf(data.outcomePrices);
  if (
    !(
      (prices[0] === "1" && prices[1] === "0") ||
      (prices[0] === "0" && prices[1] === "1")
    )
  )
    throw Error("Non-terminal payout values; hold until deadline");
  return { response, data };
}
export function proofArgs(response: SignedResponse) {
  return {
    timestamp: BigInt(response.timestamp),
    data: ("0x" + Buffer.from(response.data).toString("hex")) as `0x${string}`,
    signature: response.signature,
  };
}
