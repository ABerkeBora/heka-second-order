import express from "express";
import fs from "node:fs";
import path from "node:path";
import { root, state, save, exclusive, cleanError } from "./store.ts";
import {
  publicState,
  discoverMarkets,
  compose,
  authorize,
  runIntent,
  submitEvidence,
  tamperChecks,
} from "./engine.ts";
const { acquireExecutor } = await import("./chain.ts");
acquireExecutor();
const app = express();
app.disable("x-powered-by");
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (req.method !== "GET") {
    const origin = req.headers.origin;
    if (origin && !/^http:\/\/(127\.0\.0\.1|localhost):3101$/.test(origin)) {
      res.status(403).json({ error: "Local same-origin requests only" });
      return;
    }
    if (!req.is("application/json")) {
      res.status(415).json({ error: "Send application/json" });
      return;
    }
  }
  next();
});
app.use(express.json({ limit: "32kb" }));
const route =
  (handler: (req: any) => Promise<any>) => async (req: any, res: any) => {
    try {
      res.json(await exclusive(() => handler(req)));
    } catch (error) {
      res.status(400).json({ error: cleanError(error), state: publicState() });
    }
  };
app.get("/api/state", (_, res) => res.json(publicState()));
app.post(
  "/api/discover",
  route(() => discoverMarkets()),
);
app.post(
  "/api/propose",
  route(async (req) => {
    if (
      typeof req.body.objective !== "string" ||
      req.body.objective.length > 1000
    )
      throw Error("Provide an objective of at most 1000 characters");
    return compose(req.body.objective);
  }),
);
app.post(
  "/api/authorize",
  route(async (req) => {
    const i = await authorize(
      req.body.proposalId,
      req.body.side,
      String(req.body.stakeUnits),
    );
    void exclusive(() => runIntent(i)).catch(() => {});
    return i;
  }),
);
app.post(
  "/api/run",
  route(async (req) => {
    const targets = req.body.intentId
      ? state.intents.filter((i) => i.id === req.body.intentId)
      : state.intents.filter(
          (i) => !["claimed", "refunded"].includes(i.status),
        );
    for (const i of targets) await runIntent(i);
    return publicState();
  }),
);
app.post(
  "/api/evidence",
  route((req) =>
    submitEvidence(
      req.body.marketId,
      Number(req.body.sourceIndex),
      req.body.envelope,
    ),
  ),
);
app.post(
  "/api/tamper-check",
  route(async (req) => {
    const i = state.intents.find(
      (i) => i.contractAddress === req.body.marketId,
    );
    if (!i)
      throw Error("Fund this basket before running its funding proof checks");
    return tamperChecks(i);
  }),
);
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(root, "dist")));
  app.get("/{*splat}", (_, res) =>
    res.sendFile(path.join(root, "dist", "index.html")),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT || 3101);
if (port !== 3101) throw Error("This project owns port 3101 only");
app.listen(port, "127.0.0.1", () =>
  console.log(`Second Order is ready at http://localhost:${port}`),
);
let busy = false;
setInterval(() => {
  if (busy) return;
  busy = true;
  exclusive(async () => {
    for (const intent of state.intents.filter(
      (i) => !["claimed", "refunded"].includes(i.status),
    )) {
      try {
        await runIntent(intent);
      } catch {}
    }
  }).finally(() => {
    busy = false;
  });
}, 30000).unref();
