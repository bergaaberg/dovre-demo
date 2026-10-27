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
    // The avatar (dovre-packs, for fun): Today's header and Bino's button.
    packs: [northwindShopPack(), linear, createAvatarPack(), ...(o.packs ?? [])],
    // Made up: the Linear pack needs a key to run, and its fetch never leaves the Worker.
    settings: { LINEAR_API_KEY: "lin_demo_not_a_key" },
    answers: [{ match: /\blinear\b/, answer: () => answerLinear(linear.kept()) }],
  });
}

export default demoWorker();
