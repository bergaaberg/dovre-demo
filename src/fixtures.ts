/**
 * The demo's made-up data: core's Northwind fixtures (dovre/demo/fixtures.ts), plus what this
 * repo's packs need to show their part. Here, the waiting deploy's changelog names Linear issues,
 * so `NW-123` linking shows on Today and Deploys.
 */
import type { Snapshot } from "dovre/gather.ts";
import { DEMO_ORG, demoSnapshot } from "dovre/demo/fixtures.ts";

export function snapshot(now = Date.now()): Snapshot {
  const s = demoSnapshot(now);
  const deploy = s.deploys.ok ? s.deploys.value[0] : undefined;
  if (!deploy) return s;
  const changelogs = new Map(s.changelogs);
  changelogs.set(deploy.id, {
    ok: true,
    value: {
      repo: deploy.repo,
      env: "production",
      prodSha: "4b3a291",
      prodAt: new Date(now - 26 * 3600_000).toISOString(),
      head: deploy.headSha,
      commits: 3,
      files: 9,
      additions: 214,
      deletions: 61,
      changes: [
        { kind: "feature", title: "Faster first paint on the front page", author: "lise-demo", sha: "9f8e7d6", text: "Faster first paint on the front page\n\nInline the hero styles. Closes NW-118." },
        { kind: "fix", title: "Order history keeps its scroll position", author: "kari-demo", sha: "7c1d2e0", text: "Order history keeps its scroll position\n\nPart of NW-127." },
        { kind: "other", title: "Tidy the checkout copy", author: "ola-demo", sha: "51aa0b3", text: "Tidy the checkout copy" },
      ],
      compareUrl: `/elsewhere/${DEMO_ORG}/web/compare/4b3a291...9f8e7d6`,
    },
  });
  return { ...s, changelogs };
}
