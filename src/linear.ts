/**
 * Linear in the demo (bergaaberg/dovre#41): the real Linear pack from dovre-packs, fed a fake
 * Linear that answers its GraphQL from made-up data. It never reaches api.linear.app, and writes
 * answer "done" but nothing is kept.
 */
import { createLinearPack } from "dovre-packs/packs/linear/index.ts";
import { type LinearKept, PRIORITY } from "dovre-packs/packs/linear/data.ts";

export const LINEAR_WORKSPACE = "northwind";
export const LINEAR_TEAM = { key: "NW", name: "Northwind Web" };

type RawIssue = {
  identifier: string;
  title: string;
  priority: number;
  updatedAt: string;
  team: { key: string };
  state: { name: string; type: string };
  project?: { name: string };
  cycle?: { number: number } | null;
};

const ago = (now: number, min: number) => new Date(now - min * 60_000).toISOString();

const issue = (
  now: number,
  key: string,
  title: string,
  priority: number,
  state: [string, string],
  min: number,
  o: Partial<RawIssue> = {},
): RawIssue => ({
  identifier: key,
  title,
  priority,
  updatedAt: ago(now, min),
  team: { key: LINEAR_TEAM.key },
  state: { name: state[0], type: state[1] },
  project: { name: "Checkout" },
  cycle: { number: 14 },
  ...o,
});

const STARTED: [string, string] = ["In Progress", "started"];
const REVIEW: [string, string] = ["In Review", "started"];
const TODO: [string, string] = ["Todo", "unstarted"];
const BACKLOG: [string, string] = ["Backlog", "backlog"];
const TRIAGE: [string, string] = ["Triage", "triage"];

/** What a fake Linear holds for the demo visitor: four assigned, a cycle part way through, two to triage. */
export function linearFixtures(now = Date.now()) {
  const mine = [
    issue(now, "NW-142", "Card payments fail on a gateway timeout", 1, STARTED, 18),
    issue(now, "NW-138", "Show the delivery estimate in the basket", 2, REVIEW, 25),
    issue(now, "NW-131", "Product images miss the edge cache", 3, TODO, 52, { project: { name: "Catalog" } }),
    issue(now, "NW-127", "Dark mode for the order history page", 4, BACKLOG, 140, { project: { name: "Web" }, cycle: null }),
  ];
  const untriaged = [
    issue(now, "NW-150", "Search shows old prices after a sale ends", 0, TRIAGE, 70, { project: { name: "Catalog" }, cycle: null }),
    issue(now, "NW-151", "Password reset email arrives twice", 0, TRIAGE, 95, { project: undefined, cycle: null }),
  ];
  return {
    viewer: { name: "Kari Demo" },
    organization: { urlKey: LINEAR_WORKSPACE },
    issues: { nodes: mine },
    teams: {
      nodes: [
        {
          ...LINEAR_TEAM,
          activeCycle: { number: 14, startsAt: ago(now, 4 * 24 * 60), endsAt: new Date(now + 3 * 24 * 3600_000).toISOString(), progress: 58, issueCount: 12, completedIssueCount: 7 },
          issues: { nodes: untriaged },
        },
      ],
    },
  };
}

/** A fake api.linear.app: answers each of the pack's queries by its name, from `data`. */
export function fakeLinear(data: (now?: number) => ReturnType<typeof linearFixtures> = linearFixtures): typeof fetch {
  return (async (_input: string | URL | Request, init?: RequestInit) => {
    const { query = "", variables = {} } = JSON.parse(String(init?.body ?? "{}")) as { query?: string; variables?: Record<string, unknown> };
    const d = data();
    const all = [...d.issues.nodes, ...d.teams.nodes.flatMap((t) => t.issues.nodes)];
    const answer = (body: unknown) => new Response(JSON.stringify({ data: body }), { headers: { "content-type": "application/json" } });
    if (/query DovreLinear\s*\{/.test(query)) return answer(d);
    if (/DovreLinearTeam/.test(query)) return answer({ teams: { nodes: d.teams.nodes.filter((t) => t.key === variables.key).map((t) => ({ id: `team-${t.key}`, key: t.key, name: t.name })) } });
    if (/DovreLinearIssue/.test(query)) {
      const i = all.find((x) => x.identifier === variables.key);
      return answer({ issue: i ? { id: `issue-${i.identifier}`, identifier: i.identifier, title: i.title, state: i.state, team: i.team } : null });
    }
    // Writes say they worked; nothing is kept, so the next read shows the same made-up data.
    if (/DovreLinearCreate/.test(query)) return answer({ issueCreate: { success: true, issue: { identifier: `${LINEAR_TEAM.key}-152`, title: String(variables.title ?? "") } } });
    if (/DovreLinearComment/.test(query)) return answer({ commentCreate: { success: true } });
    return new Response(JSON.stringify({ errors: [{ message: "Not in the demo." }] }), { headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

/** Where an issue's link goes in the demo: its External link page, never a real workspace. */
export const linearHref = (key: string) => `/elsewhere/linear.app/${LINEAR_WORKSPACE}/issue/${key}`;

export function demoLinearPack(data?: (now?: number) => ReturnType<typeof linearFixtures>) {
  return createLinearPack({ fetchFn: fakeLinear(data), issueHref: linearHref });
}

/** Bino's scripted answer to "what's on my Linear?", counted from what the pack read. */
export function answerLinear(k: LinearKept | undefined): string {
  if (!k?.ok) return "Linear hasn't answered yet.";
  if (!k.mine.length) return "Nothing on Linear is assigned to you.";
  const lines = k.mine.map((i) => `• **${i.key}** ${i.title} — ${i.state}, ${PRIORITY[i.priority] ?? "No priority"}`);
  const urgent = k.mine.filter((i) => i.priority === 1).length;
  const out = [`You have ${k.mine.length} open Linear ${k.mine.length === 1 ? "issue" : "issues"}${urgent ? ` (${urgent} urgent)` : ""}:\n\n${lines.join("\n")}`];
  for (const t of k.teams) {
    if (t.cycle) out.push(`${t.name}'s cycle ${t.cycle.number} is ${t.cycle.progress}% done (${t.cycle.completed} of ${t.cycle.issues}).`);
    if (t.untriaged.length) out.push(`${t.untriaged.length} ${t.untriaged.length === 1 ? "issue waits" : "issues wait"} for triage in ${t.key}.`);
  }
  return out.join("\n\n");
}
