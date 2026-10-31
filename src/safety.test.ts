import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { validateProposal } from "./llm.ts";
import {
  AIRNODE,
  checkTiming,
  createProjection,
  MAX_ENVELOPE_AGE,
  MAX_SOURCE_AGE,
  outcomeHash,
  outcomesOf,
  proofArgs,
  requestFor,
  settlementProjection,
} from "./source.ts";
import {
  deriveRequestHash,
  verifySignedResponse,
  type SignedResponse,
} from "./vendor/airnode-v2.ts";
import { toHex } from "viem";

const now = Date.parse("2026-10-31T03:00:00Z");
const nowSeconds = now / 1000;
const candidates = () => [
  {
    id: "market-a",
    conditionId: "condition-a",
    eligible: true,
    closed: false,
    endDate: new Date(now + 600_000).toISOString(),
    outcomes: ["Up", "Down"],
  },
  {
    id: "market-b",
    conditionId: "condition-b",
    eligible: true,
    closed: false,
    endDate: new Date(now + 900_000).toISOString(),
    outcomes: ["Yes", "No"],
  },
];
const proposal = () => ({
  marketIds: ["market-a", "market-b"],
  selectedOutcomeIndexes: [0, 1],
  operator: "AND",
  reason: "Combine two permitted outcomes.",
});
const envelope = (timestamp = String(nowSeconds)): SignedResponse => ({
  airnode: AIRNODE,
  requestHash: ("0x" + "11".repeat(32)) as `0x${string}`,
  timestamp,
  data: '{"updatedAt":"2026-10-31T03:00:00Z"}',
  signature: ("0x" + "22".repeat(65)) as `0x${string}`,
});
const updated = (ageSeconds: number) => ({
  updatedAt: new Date(now - ageSeconds * 1000).toISOString(),
});
const fixture = (name: string) =>
  JSON.parse(
    fs.readFileSync(
      fileURLToPath(
        new URL(`../evidence/source-audit/${name}`, import.meta.url),
      ),
      "utf8",
    ),
  );

test("proposal accepts only the supplied two distinct open markets and preserves selected outcomes", () => {
  assert.deepEqual(validateProposal(proposal(), candidates(), now), proposal());
  assert.equal(
    validateProposal({ ...proposal(), operator: "OR" }, candidates(), now)
      .operator,
    "OR",
  );
});
test("proposal rejects unknown IDs and repeated IDs even when the output shape is valid", () => {
  assert.throws(
    () =>
      validateProposal(
        { ...proposal(), marketIds: ["market-a", "invented"] },
        candidates(),
        now,
      ),
    /unavailable/,
  );
  assert.throws(
    () =>
      validateProposal(
        { ...proposal(), marketIds: ["market-a", "market-a"] },
        candidates(),
        now,
      ),
    /distinct/,
  );
});
test("proposal rejects closed, ineligible, expired and imminently closing candidates", () => {
  for (const change of [
    { closed: true },
    { eligible: false },
    { endDate: new Date(now - 1).toISOString() },
    { endDate: new Date(now + 89_999).toISOString() },
  ]) {
    const pool = candidates();
    Object.assign(pool[0]!, change);
    assert.throws(
      () => validateProposal(proposal(), pool, now),
      /unavailable|closing/,
    );
  }
});
test("proposal rejects non-binary outcome indexes, fractions and coercible strings", () => {
  for (const selectedOutcomeIndexes of [
    [-1, 0],
    [0, 2],
    [0, 0.5],
    ["0", 1],
    [true, 0],
    [0],
    [0, 1, 0],
  ]) {
    assert.throws(() =>
      validateProposal(
        { ...proposal(), selectedOutcomeIndexes },
        candidates(),
        now,
      ),
    );
  }
});
test("proposal rejects unsupported operators and unexpected model fields", () => {
  for (const operator of ["XOR", "and", "", null])
    assert.throws(() =>
      validateProposal({ ...proposal(), operator }, candidates(), now),
    );
  for (const extra of [
    { recipient: "0xattacker" },
    { calldata: "0xdeadbeef" },
    { privateKey: "forbidden" },
    { tool: "transfer" },
  ])
    assert.throws(() =>
      validateProposal({ ...proposal(), ...extra }, candidates(), now),
    );
});
test("proposal rejects malformed schema and oversized rationale", () => {
  for (const value of [
    null,
    [],
    {},
    { ...proposal(), marketIds: ["market-a"] },
    { ...proposal(), reason: "" },
    { ...proposal(), reason: "x".repeat(401) },
  ])
    assert.throws(() => validateProposal(value, candidates(), now));
});
test("proposal fails closed on an invalid candidate end date", () => {
  const pool = candidates();
  pool[0]!.endDate = "not-a-timestamp";
  assert.throws(() => validateProposal(proposal(), pool, now));
});

test("fresh envelope cannot refresh an old source observation", () => {
  assert.throws(
    () => checkTiming(envelope(), updated(MAX_SOURCE_AGE + 1), nowSeconds),
    /Upstream/,
  );
  assert.equal(
    checkTiming(envelope(), updated(MAX_SOURCE_AGE), nowSeconds),
    nowSeconds - MAX_SOURCE_AGE,
  );
});
test("source and envelope freshness are independent checks at their exact boundaries", () => {
  assert.equal(
    checkTiming(
      envelope(String(nowSeconds - MAX_ENVELOPE_AGE)),
      updated(0),
      nowSeconds,
    ),
    nowSeconds,
  );
  assert.throws(
    () =>
      checkTiming(
        envelope(String(nowSeconds - MAX_ENVELOPE_AGE - 1)),
        updated(0),
        nowSeconds,
      ),
    /Envelope/,
  );
});
test("source update timestamp must parse and cannot exceed the future tolerance", () => {
  for (const updatedAt of [undefined, null, "not-an-ISO-date", ""])
    assert.throws(
      () => checkTiming(envelope(), { updatedAt }, nowSeconds),
      /Upstream/,
    );
  assert.throws(
    () => checkTiming(envelope(), updated(-31), nowSeconds),
    /Upstream/,
  );
  assert.equal(
    checkTiming(envelope(), updated(-30), nowSeconds),
    nowSeconds + 30,
  );
});
test("envelope time must be a safe integer and cannot exceed future tolerance", () => {
  for (const timestamp of [
    "NaN",
    "Infinity",
    "1793415600.5",
    "9007199254740992",
  ])
    assert.throws(
      () => checkTiming(envelope(timestamp), updated(0), nowSeconds),
      /Envelope/,
    );
  assert.throws(
    () =>
      checkTiming(envelope(String(nowSeconds + 31)), updated(0), nowSeconds),
    /Envelope/,
  );
  assert.equal(
    checkTiming(envelope(String(nowSeconds + 30)), updated(0), nowSeconds),
    nowSeconds,
  );
});
test("microsecond source strings are parsed without treating signature time as source time", () => {
  const data = { updatedAt: "2026-10-31T02:59:59.558265Z" };
  assert.equal(
    checkTiming(envelope(), data, nowSeconds),
    Date.parse(data.updatedAt) / 1000,
  );
});

test("binary array parser handles actual JSON-string fields and rejects malformed outcomes", () => {
  assert.deepEqual(outcomesOf('["Up", "Down"]'), ["Up", "Down"]);
  for (const value of [
    "[]",
    '["same","same"]',
    '["only"]',
    "[0,1]",
    '["a","b","c"]',
    "not-json",
    null,
    {},
    '["' + "x".repeat(121) + '","b"]',
  ])
    assert.throws(() => outcomesOf(value));
});
test("semantic outcome hash ignores JSON whitespace but binds order and exact labels", () => {
  assert.equal(
    outcomeHash(outcomesOf('["Up", "Down"]')),
    outcomeHash(outcomesOf('["Up","Down"]')),
  );
  assert.notEqual(outcomeHash(["Up", "Down"]), outcomeHash(["Down", "Up"]));
  assert.notEqual(outcomeHash(["Up", "Down"]), outcomeHash(["UP", "Down"]));
});
test("request identity binds market ID, operation, projection and parameter types", () => {
  const open = requestFor("6405900");
  const hash = deriveRequestHash(open);
  assert.notEqual(hash, deriveRequestHash(requestFor("6405901")));
  assert.notEqual(hash, deriveRequestHash(requestFor("6405900", true)));
  assert.notEqual(
    hash,
    deriveRequestHash({ ...open, operation: "getMarketBySlug" }),
  );
  assert.notEqual(
    hash,
    deriveRequestHash({ ...open, parameters: { id: 6405900 } }),
  );
  assert.notEqual(
    hash,
    deriveRequestHash({
      operation: open.operation,
      parameters: open.parameters,
    }),
  );
  assert.notEqual(
    hash,
    deriveRequestHash({
      ...open,
      responseProjection: { ...createProjection, updatedAt: "/createdAt" },
    }),
  );
});
test("request identity is stable under object-key order, including a reordered phase projection", () => {
  const request = requestFor("6405900", true);
  assert.equal(
    deriveRequestHash(request),
    deriveRequestHash({
      ...request,
      responseProjection: Object.fromEntries(
        Object.entries(settlementProjection).reverse(),
      ),
    }),
  );
  const a = {
    operation: "op",
    parameters: { z: { b: 1, a: 2 }, a: ["Up", "Down"] },
  };
  const b = {
    operation: "op",
    parameters: { a: ["Up", "Down"], z: { a: 2, b: 1 } },
  };
  assert.equal(deriveRequestHash(a), deriveRequestHash(b));
  assert.notEqual(
    deriveRequestHash(a),
    deriveRequestHash({
      ...b,
      parameters: { ...b.parameters, a: ["Down", "Up"] },
    }),
  );
});
test("proof serialization preserves signed UTF-8 bytes, field order, nested strings and whitespace", () => {
  const data =
    ' {"question":"Straße → Up", "outcomes":"[\\"Up\\", \\"Down\\"]", "closed":false}\n';
  const response = { ...envelope(), data };
  const args = proofArgs(response);
  assert.equal(args.data, toHex(data));
  assert.equal(Buffer.from(args.data.slice(2), "hex").toString("utf8"), data);
  assert.equal(args.timestamp, BigInt(response.timestamp));
  assert.equal(args.signature, response.signature);
});
test("real create and terminal artifacts match independently locked request hashes and signer", async () => {
  for (const name of ["create-6405900.json", "settlement-6437686.json"]) {
    const { request, response } = fixture(name);
    assert.equal(deriveRequestHash(request), response.requestHash);
    await verifySignedResponse(response, AIRNODE, deriveRequestHash(request));
    assert.equal(proofArgs(response).data, toHex(response.data));
  }
});
test("edited signed data, timestamp and wrong phase cannot pass real attestation checks", async () => {
  const { request, response } = fixture("create-6405900.json");
  const hash = deriveRequestHash(request);
  await assert.rejects(
    verifySignedResponse(
      { ...response, data: response.data.replace("false", "true") },
      AIRNODE,
      hash,
    ),
  );
  await assert.rejects(
    verifySignedResponse(
      { ...response, timestamp: String(BigInt(response.timestamp) + 1n) },
      AIRNODE,
      hash,
    ),
  );
  await assert.rejects(
    verifySignedResponse(
      response,
      AIRNODE,
      deriveRequestHash(requestFor("6405900", true)),
    ),
    /request/,
  );
});
test("re-serializing equivalent signed JSON is not a valid way to construct a proof", async () => {
  const { request, response } = fixture("create-6405900.json");
  const formatted = JSON.stringify(JSON.parse(response.data), null, 2);
  assert.notEqual(formatted, response.data);
  await assert.rejects(
    verifySignedResponse(
      { ...response, data: formatted },
      AIRNODE,
      deriveRequestHash(request),
    ),
  );
});
