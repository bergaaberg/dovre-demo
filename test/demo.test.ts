/** demo.dovre.dev: its pages, its packs on made-up data, and nothing that leaves the demo. */
import { test } from "node:test";
import assert from "node:assert/strict";
import demo, { countedDemo, demoHits, demoWorker } from "../src/worker.ts";
import { demoLinearPack, linearFixtures } from "../src/linear.ts";

const at = (path: string, init?: RequestInit) => new Request(`https://demo.dovre.dev${path}`, init);
const H = `<script>alert(1)</script><img src=x onerror=alert(1)>`;
const text = async (path: string, w = demo) => {
  const res = await w.fetch(at(path));
  assert.equal(res.status, 200, path);
  return res.text();
};

test("every page draws, says it's a demo, isn't indexed, and every link stays in the demo or goes to dovre.dev", async () => {
  const pages = ["/", "/prs", "/deploys", "/agents", "/packs", "/settings", "/stats", "/todo", "/bino", "/shop", "/shop/tickets/t-101", "/linear", "/elsewhere/linear.app/northwind/issue/NW-142"];
  for (const path of pages) {
    const res = await demo.fetch(at(path));
    assert.equal(res.status, 200, path);
    assert.equal(res.headers.get("x-robots-tag"), "noindex", path);
    const page = await res.text();
    assert.match(page, /This is a demo\./, path);
    for (const [, href] of page.matchAll(/<a\b[^>]*\bhref="([^"]*)"/gi)) {
      assert.ok(href!.startsWith("/") || href!.startsWith("https://dovre.dev/"), `${path} links out of the demo: ${href}`);
      assert.notEqual(href, "#", path);
    }
  }
});

test("Linear: the real pack reads the made-up workspace: Today's card, glance and opening line, and its page", async () => {
  const today = await text("/");
  assert.match(today, /Linear/);
  assert.match(today, /NW-142/, "the card lists my issues");
  assert.match(today, /1 urgent Linear issue/, "the opening line");
  const page = await text("/linear");
  for (const key of ["NW-142", "NW-138", "NW-131", "NW-127", "NW-150", "NW-151"]) assert.match(page, new RegExp(key), key);
  assert.match(page, /href="\/elsewhere\/linear\.app\/northwind\/issue\/NW-142"/);
  assert.doesNotMatch(page, /https:\/\/linear\.app/);
  assert.match(await text("/packs"), /Linear/);
});

test("Linear: the waiting deploy's changelog links the issues it names", async () => {
  // Today folds the changelog under the deploy's row; Deploys shows it too.
  for (const path of ["/", "/deploys"]) {
    const page = await text(path);
    assert.match(page, /href="\/elsewhere\/linear\.app\/northwind\/issue\/NW-118"/, path);
    assert.match(page, /href="\/elsewhere\/linear\.app\/northwind\/issue\/NW-127"/, path);
  }
  assert.match(await text("/elsewhere/linear.app/northwind/issue/NW-118"), /opens <strong>NW-118<\/strong> on linear\.app/);
});

const ask = (q: string, w = demo) => w.fetch(at("/bino/new", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ text: q }).toString() }));

test("Bino answers what's on my Linear from what the pack read, and its other answers still work", async () => {
  const res = await ask("what's on my Linear?");
  assert.equal(res.status, 200);
  const page = await res.text();
  assert.match(page, /4 open Linear issues \(1 urgent\)/);
  assert.match(page, /NW-142/);
  assert.match(page, /cycle 14 is 58% done/);
  assert.match(page, /2 issues wait for triage/);
  assert.match(await (await ask("what's red?")).text(), /northwind\/catalog/);
});

test("Linear writes stop at the read-only page; nothing is kept", async () => {
  for (const path of ["/bino/c/d0e0b001-0000-4000-8000-000000000001/act/0/0", "/linear"]) {
    const res = await demo.fetch(at(path, { method: "POST", headers: { origin: "https://demo.dovre.dev" } }));
    assert.equal(res.status, 403, path);
    assert.match(await res.text(), /Read-only demo/);
  }
});

test("the made-up data has no markup; hostile Linear data (tests only) stays inert", async () => {
  assert.ok(!JSON.stringify(linearFixtures()).includes("<"), "no hostile fixtures in the deployed demo");
  const hostile = (now?: number) => {
    const d = linearFixtures(now);
    const [first, ...rest] = d.issues.nodes;
    return { ...d, viewer: { name: H }, issues: { nodes: [{ ...first!, title: H, state: { name: H, type: "started" }, project: { name: H } }, ...rest] }, teams: { nodes: d.teams.nodes.map((t) => ({ ...t, name: H })) } };
  };
  const w = demoWorker({ linear: demoLinearPack(hostile) });
  for (const path of ["/", "/linear"]) {
    const page = await text(path, w);
    assert.ok(!page.includes("<script>alert(1)"), `${path}: script`);
    assert.ok(!page.includes("<img src=x"), `${path}: img`);
  }
  const said = await (await ask("what's on my linear", w)).text();
  assert.ok(!said.includes("<script>alert(1)") && !said.includes("<img src=x"), "Bino's answer");
});

test("the avatar (dovre-packs) is off: not in Today's header or on Bino's button, still listed on the Packs page", async () => {
  const today = await text("/");
  assert.doesNotMatch(today, /class="av-hero/);
  assert.doesNotMatch(today, /data-av="dock"/);
  assert.match(await text("/packs"), /[Aa]vatar/);
});

test("visits: browser page loads, opens from dovre.dev and Bino questions count; nothing about the visitor is sent", async () => {
  const nav = (path: string, referer?: string) =>
    at(path, { headers: { "sec-fetch-mode": "navigate", "sec-fetch-dest": "document", ...(referer ? { referer } : {}), "user-agent": "Mozilla/5.0", "cf-connecting-ip": "203.0.113.9" } });
  assert.deepEqual(demoHits(nav("/", "https://dovre.dev/pricing/")), [{ event: "demo-page", key: "today" }, { event: "demo-open", key: "site" }]);
  assert.deepEqual(demoHits(nav("/prs", "https://demo.dovre.dev/")), [{ event: "demo-page", key: "prs" }]);
  assert.deepEqual(demoHits(nav("/agents/x")), [{ event: "demo-page", key: "agents" }, { event: "demo-open", key: "other" }]);
  assert.deepEqual(demoHits(nav("/%3Cscript%3E", "https://demo.dovre.dev/")), []);
  assert.deepEqual(demoHits(at("/prs")), [], "not a browser navigation: a crawler or the page's own fetch");
  assert.deepEqual(demoHits(at("/bino/new", { method: "POST" })), [{ event: "demo-bino" }]);
  assert.deepEqual(demoHits(at("/settings", { method: "POST" })), []);

  const sent: unknown[] = [];
  const waits: Promise<unknown>[] = [];
  const res = await countedDemo().fetch(nav("/", "https://dovre.dev/"), { VISITS: { note: async (h) => (sent.push(h), 1) } }, { waitUntil: (p) => waits.push(p) });
  await Promise.all(waits);
  assert.equal(res.status, 200);
  assert.deepEqual(sent, [[{ event: "demo-page", key: "today" }, { event: "demo-open", key: "site" }]]);
  // Control being down never breaks a page.
  const down = await countedDemo().fetch(nav("/prs"), { VISITS: { note: async () => Promise.reject(new Error("down")) } });
  assert.equal(down.status, 200);
});
