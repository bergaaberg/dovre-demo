/** Northwind Shop: the demo's custom app pack, on the demo and on an ordinary signed-in Dovre. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { demoWorker } from "../../../src/worker.ts";
import { northwindShopPack } from "../index.ts";
import { demoShopData, type ShopData } from "../data.ts";
// Core's own test helpers: a signed-in app over a real (in-memory) database.
import { H, assertInert, signedIn, snapshot } from "../../../node_modules/dovre/test/helpers.ts";

const at = (path: string, init?: RequestInit) => new Request(`https://demo.dovre.dev${path}`, init);
const createDemoWorker = demoWorker;

test("demo: custom app pack (Northwind Shop) renders /shop, ticket details, nav, packs list, and today card", async () => {
  const w = createDemoWorker();

  // /shop page
  const shopRes = await w.fetch(at("/shop"));
  assert.equal(shopRes.status, 200);
  const shopHtml = await shopRes.text();
  assert.match(shopHtml, /Northwind Shop/);
  assert.match(shopHtml, /Storefront ops: metrics, support tickets &amp; actions/);
  assert.match(shopHtml, /Customers/);
  assert.match(shopHtml, /14,820/);
  assert.match(shopHtml, /Active in 7 days/);
  assert.match(shopHtml, /Orders today/);
  assert.match(shopHtml, /412/);
  assert.match(shopHtml, /Refunds this week/);
  assert.match(shopHtml, /Daily revenue/);
  assert.match(shopHtml, /Target/);
  assert.match(shopHtml, /Orders by state/);
  assert.match(shopHtml, /Sign-up → first-order funnel/);
  assert.match(shopHtml, /Support queue/);
  assert.match(shopHtml, /href="\/shop\/tickets\/t-101"/);

  // Ticket detail page
  const ticketRes = await w.fetch(at("/shop/tickets/t-101"));
  assert.equal(ticketRes.status, 200);
  const ticketHtml = await ticketRes.text();
  assert.match(ticketHtml, /Ticket #t-101/);
  assert.match(ticketHtml, /Payment failed on checkout for order #ORD-9821/);
  assert.match(ticketHtml, /Astrid Lind/);
  assert.match(ticketHtml, /astrid\.lind@example\.com/);
  assert.match(ticketHtml, /ORD-9821/);
  assert.match(ticketHtml, /\$149\.00/);
  assert.match(ticketHtml, /Resend receipt/);
  assert.match(ticketHtml, /Refund order/);
  assert.match(ticketHtml, /Unlock account/);
  assert.match(ticketHtml, /Extend free shipping/);
  assert.match(ticketHtml, /Customer details/);
  assert.match(ticketHtml, /Recent customer orders/);
  assert.match(ticketHtml, /Ticket thread/);

  // Nav, Today card, glance & brief on homepage
  const homeRes = await w.fetch(at("/"));
  assert.equal(homeRes.status, 200);
  const homeHtml = await homeRes.text();
  assert.match(homeHtml, /href="\/shop"/); // In nav
  assert.match(homeHtml, /Northwind Shop/); // Today card
  assert.match(homeHtml, /3 tickets waiting over an hour/);
  assert.match(homeHtml, /1 failed payment/);
  assert.match(homeHtml, /Shop orders/); // Glance
  assert.match(homeHtml, /412/);
  assert.match(homeHtml, /3 support tickets wait over an hour/); // Briefing lede

  // Needs hook produces needs for tickets waiting over an hour
  const shop = northwindShopPack();
  const needs = shop.needs?.({} as any) ?? [];
  assert.equal(needs.length, 3);
  assert.match(needs[0]!.title, /Support ticket waiting over an hour/);
  assert.equal(needs[0]!.ring, "tickets");

  // Packs page
  const packsRes = await w.fetch(at("/packs"));
  assert.equal(packsRes.status, 200);
  const packsHtml = await packsRes.text();
  assert.match(packsHtml, /Northwind Shop/);
  assert.match(packsHtml, /Storefront ops: metrics, support tickets &amp; actions/);
});

/** The demo's shop with hostile text in every field a visitor could see: only tests have it, never the demo. */
function hostileShop(): ShopData {
  const d = demoShopData();
  const t = d.tickets[0]!;
  const order = { ...t.order, id: H, items: [H] };
  return { ...d, tickets: [{ ...t, id: "t-hostile", subject: H, customer: { ...t.customer, id: "c-hostile", name: H, email: H }, order, recentOrders: [order], thread: [{ id: "m-h", from: "customer", author: H, at: H, text: `${H} javascript:alert(1)` }] }, ...d.tickets.slice(1)] };
}

test("demo: Northwind Shop hostile input stays inert, and the demo itself ships none", async () => {
  assert.ok(!JSON.stringify(demoShopData()).includes("<script"), "no hostile fixtures in the demo's own data");
  assert.equal((await createDemoWorker().fetch(at("/shop/tickets/t-hostile"))).status, 404);

  const { get } = signedIn(snapshot(), {}, { packs: [northwindShopPack({ data: hostileShop })] });
  for (const path of ["/shop", "/shop/tickets/t-hostile", "/", `/search?q=${encodeURIComponent("t-hostile")}`]) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    const body = await res.text();
    assertInert(`shop ${path}`, body);
    assert.ok(!body.includes('href="javascript:'), `${path}: javascript: href`);
  }
  assert.equal((await get(`/shop/tickets/${encodeURIComponent(H)}`)).status, 404);
});

test("demo: Northwind Shop's lines are counted from its data, not typed in", () => {
  const d = demoShopData();
  const fewer = { ...d, stats: { ...d.stats, ordersToday: 77 }, tickets: d.tickets.filter((t) => t.id !== "t-101") };
  const pack = northwindShopPack({ data: () => fewer });
  assert.deepEqual(pack.glance?.({} as never), [{ label: "Shop orders", value: 77 }]);
  const brief = JSON.stringify(pack.brief?.({} as never));
  assert.match(brief, /2 support tickets wait over an hour/);
  assert.doesNotMatch(brief, /failed payment/);
  assert.match(String(pack.bino?.({} as never)), /^2 support tickets waiting over an hour \(oldest 1h 18m\)\. 77 orders today, 0 failed payments\.$/);
  assert.equal(pack.needs?.({} as never)?.length, 2);
});

test("Northwind Shop: each support action re-checks, logs to the actions table, and refuses with why", async () => {
  const { post, get, db } = signedIn(snapshot(), {}, { packs: [northwindShopPack({ data: () => demoShopData() })] });
  const paid = demoShopData().tickets.find((t) => t.order.state === "paid")!;
  const locked = demoShopData().tickets.find((t) => t.customer.status === "locked")?.customer;

  assert.equal((await post(`/shop/tickets/${paid.id}/refund`, {})).status, 303);
  assert.match(await (await get(`/shop/tickets/${paid.id}`)).text(), /refunded/);
  const again = await post(`/shop/tickets/${paid.id}/refund`, {});
  assert.equal(again.status, 409, "a refunded order isn't refunded twice");
  assert.match(await again.text(), /already refunded/);
  assert.equal((await post("/shop/tickets/t-101/refund", {})).status, 409, "a failed payment has nothing to refund");
  assert.equal((await post("/shop/tickets/t-101/resend-receipt", {})).status, 409, "nor a receipt");
  assert.equal((await post(`/shop/tickets/${paid.id}/resend-receipt`, {})).status, 303);
  assert.equal((await post("/shop/tickets/nope/refund", {})).status, 409);
  if (locked) {
    assert.equal((await post(`/shop/customers/${locked.id}/unlock`, {})).status, 303);
    assert.equal((await post(`/shop/customers/${locked.id}/unlock`, {})).status, 409, "unlocked already");
  }
  assert.equal((await post(`/shop/customers/${paid.customer.id}/extend-shipping`, {})).status, 303);
  assert.equal((await post(`/shop/customers/${paid.customer.id}/extend-shipping`, {})).status, 409, "extended already");
  assert.equal((await post(`/shop/tickets/${paid.id}/refund`, {}, { origin: "https://evil.example" })).status, 403, "another site's form");

  const log = (await db.DB.prepare("SELECT kind, target, ok FROM actions ORDER BY id").all<{ kind: string; target: string; ok: number }>()).results;
  assert.deepEqual(log.slice(0, 2).map((l) => ({ ...l })), [{ kind: "shop.refund", target: `order ${paid.order.id}`, ok: 1 }, { kind: "shop.refund", target: `order ${paid.order.id}`, ok: 0 }]);
  assert.equal(log.filter((l) => l.ok).length, locked ? 4 : 3);
  assert.ok(log.every((l) => l.kind.startsWith("shop.")));
});

test("demo: Northwind Shop support actions answer 403 read-only page on POST", async () => {
  const w = createDemoWorker();
  const actions = [
    "/shop/tickets/t-101/refund",
    "/shop/tickets/t-101/resend-receipt",
    "/shop/customers/c-101/unlock",
    "/shop/customers/c-101/extend-shipping",
  ];

  for (const actionPath of actions) {
    const res = await w.fetch(at(actionPath, {
      method: "POST",
      headers: { origin: "https://demo.dovre.dev" },
    }));
    assert.equal(res.status, 403, `${actionPath} should answer 403`);
    const text = await res.text();
    assert.match(text, /Read-only demo/);
    assert.match(text, /a demo over made-up data/);
    assert.match(text, /href="https:\/\/dovre\.dev\/"/);
  }
});


test("refund rate: this week's refunds over this week's orders", async () => {
  const { demoShopData, refundRate } = await import("../data.ts");
  const { percent } = await import("../format.ts");
  const stats = demoShopData(0).stats;
  assert.equal(percent(refundRate(stats)), "1.7 %");
  assert.equal(percent(0), "0.0 %");
});
