/**
 * demo.dovre.dev: hosted Dovre's pages over made-up data. Core's createDemoWorker keeps the
 * safety boundary (no bindings, no secrets, an empty database, every write but Bino's refused);
 * this repo supplies only made-up data and packs.
 */
import { createDemoWorker } from "dovre/demo/worker.ts";
import type { Pack } from "dovre/packs/types.ts";
import { createAvatarPack } from "dovre-packs/packs/avatar/index.ts";
import { northwindShopPack } from "../packs/shop/index.ts";
import { snapshot } from "./fixtures.ts";
import { answerLinear, demoLinearPack } from "./linear.ts";

/** The demo, with its own Linear (tests feed it other data) and any extra packs. */
export function demoWorker(o: { linear?: ReturnType<typeof demoLinearPack>; packs?: Pack[] } = {}) {
  const linear = o.linear ?? demoLinearPack();
  return createDemoWorker({
    fixtures: { snapshot },
    // The avatar (dovre-packs, for fun) is loaded but off, as for a new tenant: the Packs page lists it.
    packs: [northwindShopPack(), linear, createAvatarPack(), ...(o.packs ?? [])],
    // Made up: the Linear pack needs a key to run, and its fetch never leaves the Worker.
    layout: { tabs: ["/prs", "/agents", "/deploys"], packsOff: ["avatar"] },
    settings: { LINEAR_API_KEY: "lin_demo_not_a_key" },
    answers: [{ match: /\blinear\b/, answer: () => answerLinear(linear.kept()) }],
  });
}

type Hit = { event: string; key?: string };
type Bindings = { ASSETS?: { fetch(req: Request): Promise<Response> }; VISITS?: { note(hits: Hit[]): Promise<number> } };

const SITE = new Set(["dovre.dev", "www.dovre.dev"]);
const SAY = /^\/bino\/(?:new|c\/[0-9a-f-]{36}\/say)$/i;
const SEGMENT = /^[a-z0-9][a-z0-9-]{0,31}$/;

/**
 * What a request to the demo counts for the operator (dovre-control's visits.ts): a question to
 * Bino, a page a browser opened, and where a visit came from (dovre.dev or elsewhere). Only page
 * loads a browser navigated to count (Sec-Fetch-Mode), so most crawlers and the page's own
 * requests don't. Nothing about the visitor is sent, only the event and its key.
 */
export function demoHits(request: Request): Hit[] {
  const url = new URL(request.url);
  if (request.method === "POST") return SAY.test(url.pathname) ? [{ event: "demo-bino" }] : [];
  if (request.method !== "GET" || request.headers.get("sec-fetch-mode") !== "navigate" || request.headers.get("sec-fetch-dest") !== "document") return [];
  const seg = url.pathname.split("/").filter(Boolean)[0] ?? "today";
  const hits: Hit[] = SEGMENT.test(seg) ? [{ event: "demo-page", key: seg }] : [];
  let from = "";
  try {
    from = new URL(request.headers.get("referer") ?? "").hostname;
  } catch {}
  if (from !== url.hostname) hits.push({ event: "demo-open", key: SITE.has(from) ? "site" : "other" });
  return hits;
}

/**
 * The demo, counting its use on control's `Visits` entrypoint (the VISITS service binding) beside
 * it. Core's demo itself still gets no binding but its assets.
 */
export function countedDemo(demo = demoWorker()) {
  return {
    async fetch(request: Request, env: Bindings = {}, ctx?: { waitUntil(p: Promise<unknown>): void }): Promise<Response> {
      const hits = env.VISITS ? demoHits(request) : [];
      if (hits.length) {
        const noted = env.VISITS!.note(hits).catch((e) => console.error(`visits: ${(e as Error)?.message ?? e}`));
        ctx?.waitUntil(noted);
      }
      return demo.fetch(request, { ASSETS: env.ASSETS });
    },
  };
}

export default countedDemo();
