#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// The Pemberton Grand — deterministic demo-brain generator.  (see DESIGN.md)
//
// Emits three artifacts beside this file:
//   pemberton.booboo.json       the snapshot (BoobooGraph, ~2,400 nodes)
//   org.pemberton.booboo.json   the authority file (BOrg — booboo_boot's source)
//   journal.seed.jsonl          pre-seeded remember/report entries (the trace)
//
// DESIGN CHOICES (documented here because JSON carries no comments):
//
// • Layers: meta.layers = [gm, executive, staff, ledger] exactly. THE HOUSE
//   STANDARD apex node lives IN the "gm" band (tier 0, type "contract") rather
//   than a fifth thin layer — a 1-node layer would cost a whole Z-plane of
//   vertical space in the viewer's even layer spacing, while tier 0 + weight 1.0
//   in the gm band keeps it visually apex beside the GM without distorting the
//   band stack. It is also the graph root (meta.root = "standard"), so the spine
//   reads Standard → GM → heads → staff → rosters: law above even the GM,
//   exactly the DESIGN band table (apex `standard` above `gm`).
//
// • Clusters: exactly the 9 department keys, nothing else. House-level nodes
//   (standard, GM, house/executive/guest-registry buckets + their contents, the
//   orphan) carry cluster null, so the viewer's exactly-9-clusters even-ring
//   branch triggers. Same sector key on every band = one vertical column per
//   department.
//
// • Spine edges are NOT emitted as links — `parent` carries hierarchy per
//   SPEC.md rule 3 ("parent draws a spine edge"); links[] hold semantic verbs
//   only (reports_to · declares · amends · inherits · owns · reads ·
//   escalates_to · covers · supplies · audits). Observations attach via parent
//   (position), never rendered edges — per DESIGN edge budget.
//
// • The SEALED wall (ledger:guest-registry): the shipped wall mechanism lives
//   in the BUILD config (`walls:` list, applied pre-emit in
//   packages/build/src/build.ts:38-45 by cluster / data.__wall) — NOT in the
//   org file. This dataset is authored directly (this script plays the builder
//   role), so the wall is applied the same way, at emit: the bucket node is
//   emitted (visible, data.sealed=true), and ZERO content nodes are parented or
//   clustered into it. Sealed data never enters the JSON. The org file lists
//   "guest-registry" in no agent's buckets for the same reason.
//
// • Org file: gm root + 9 heads + 52 named-role staff. Tier-3 roster instances
//   (Room Attendant 01–24 etc.) are snapshot-only: the org defines durable
//   ROLES ("roles are durable, agents are disposable" — DESIGN), not roster
//   headcount. Known semantics note: orgBootSlice inherits buckets down the
//   whole chain (spec/src/index.ts:189-197), so "executive" on the gm root is
//   inherited by every agent's boot slice — the org cannot express
//   "GM + heads only". The precise executive reach is encoded in the snapshot
//   (reads edges, bucket data.reach); DESIGN's enforcement-honesty note covers
//   this: a governance model, not a cryptographic ACL.
//
// • journal.seed.jsonl entries mimic JournalWriter output EXACTLY
//   (packages/serve/src/journal.ts:101-116): {node,link} per line, layer
//   "memory"/"reports" (the writer's fallback — the snapshot deliberately does
//   not declare those layers), tier 3, weight 0.2, link type recalls/filed.
//   NOTE: the default replay path for pemberton.booboo.json is
//   pemberton.booboo.journal.jsonl (journalPathFor strips only ".json") — to
//   replay the seed, pass `--journal examples/pemberton/journal.seed.jsonl`
//   (cli.ts --journal flag) or copy the file to the default name.
//
// • The snapshot is written COMPACT (single line): it is generated data served
//   over the wire by the hosted demo — regenerate, don't hand-edit. The org
//   file is pretty-printed: it is a SOURCE the panel edits and git diffs.
//
// • Determinism: no Math.random. All variation derives from an FNV-1a hash
//   (ported from packages/viewer/app/main.tsx synth()) over SEED+id. The only
//   run-dependent input is the generation timestamp (required: DESIGN bakes
//   "3 major incidents within the LAST 7 DAYS" — recency is relative by spec).
//
// Node >= 18, plain JS, no deps beyond @booboo-brain/spec's built dist.
// ═══════════════════════════════════════════════════════════════════════════════

import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validate, validateOrg } from "../../packages/spec/dist/index.js";

const OUT = dirname(fileURLToPath(import.meta.url));

// ── determinism ──────────────────────────────────────────────────────────────
const SEED = "pemberton-v1";
function h(s) {
  const t = SEED + "|" + s;
  let x = 2166136261;
  for (let i = 0; i < t.length; i++) {
    x ^= t.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  return ((x >>> 0) % 1000000) / 1000000;
}
const hi = (s, n) => Math.floor(h(s) * n) % n;
const pick = (s, arr) => arr[hi(s, arr.length)];
const h4 = (s) => Math.floor(h(s) * 0xffff).toString(16).padStart(4, "0");

const DAY = 86400000;
const NOW = Date.now(); // anchor — recency of baked incidents is relative to generation time
const iso = (msAgo) => new Date(NOW - msAgo).toISOString();
const isoDays = (d) => iso(d * DAY);
const dayLabel = (d) => new Date(NOW - d * DAY).toISOString().slice(0, 10);
// last 03:00 UTC before now — the Night Audit's run
const _d = new Date(NOW);
const _three = Date.UTC(_d.getUTCFullYear(), _d.getUTCMonth(), _d.getUTCDate(), 3, 0, 0);
const NIGHT_AUDIT_RUN = _three <= NOW ? _three : _three - DAY;

// ── the nine departments (fixed order = sector enumeration order, DESIGN) ────
const DEPTS = [
  { key: "front-office",        name: "Front Office",          emoji: "🛎️" },
  { key: "f-and-b",             name: "F&B",                   emoji: "🍽️" },
  { key: "housekeeping",        name: "Housekeeping",          emoji: "🧺" },
  { key: "engineering",         name: "Engineering",           emoji: "🔧" },
  { key: "spa-leisure",         name: "Spa & Leisure",         emoji: "💆" },
  { key: "events-banqueting",   name: "Events & Banqueting",   emoji: "🎪" },
  { key: "security",            name: "Security",              emoji: "🛡️" },
  { key: "finance-procurement", name: "Finance & Procurement", emoji: "📒" },
  { key: "people-culture",      name: "People & Culture",      emoji: "👥" },
];

// ── the services the house runs on ──────────────────────────────────────────
// Real vendors, named honestly: a five-star hotel is a mesh of third-party
// systems, and a brain that can't see them is only half the operation. `brand`
// is a simpleicons slug the panel renders as the real mark; nothing here
// implies endorsement — it's the same "works with" usage any integrations page
// carries. Each hangs off the department that actually depends on it.
const INTEGRATIONS = [
  { slug: "pms", name: "SAP Hospitality", vendor: "SAP", brand: "sap", emoji: "🏨", dept: "front-office", cadence: 1,
    category: "property management", role: "Rooms, rates and folios — the system of record for every stay",
    duty: "Sync arrivals, departures and folio balances; never overwrite a human's note on a reservation." },
  { slug: "bookingcom", name: "Booking.com", vendor: "Booking.com", brand: "bookingdotcom", emoji: "🌐", dept: "front-office", cadence: 2,
    category: "distribution", role: "OTA channel — inventory and rates pushed, reservations pulled",
    duty: "Keep availability truthful; an oversell is a red flag, not a rounding error." },
  { slug: "whatsapp", name: "WhatsApp Business", vendor: "WhatsApp", brand: "whatsapp", emoji: "💬", dept: "front-office", cadence: 6,
    category: "guest messaging", role: "Pre-arrival and in-stay messages to guests",
    duty: "Never message a guest after 21:00 local unless it is a safety matter." },
  { slug: "stripe", name: "Stripe", vendor: "Stripe", brand: "stripe", emoji: "💳", dept: "finance-procurement", cadence: 1,
    category: "payments", role: "Card capture, deposits and refunds",
    duty: "Reconcile against the PMS folio nightly; flag any mismatch to the Night Audit." },
  { slug: "xero", name: "Xero", vendor: "Xero", brand: "xero", emoji: "📊", dept: "finance-procurement", cadence: 24,
    category: "accounting", role: "Ledger, payables and the monthly close",
    duty: "Post only what the Night Audit has already reconciled." },
  { slug: "n8n", name: "n8n", vendor: "n8n", brand: "n8n", emoji: "🔗", dept: "finance-procurement", cadence: 1,
    category: "automation", role: "The glue — every cross-system workflow in the house",
    duty: "You move data between systems; you never invent it. Fail loudly." },
  { slug: "tripadvisor", name: "Tripadvisor", vendor: "Tripadvisor", brand: "tripadvisor", emoji: "🍴", dept: "f-and-b", cadence: 2,
    category: "covers & reputation", role: "Restaurant covers, waitlist and the review that follows",
    duty: "Protect the brigade's pace — never seat beyond the kitchen's agreed covers." },
  { slug: "alliancelaundry", name: "Alliance Laundry", vendor: "Alliance Laundry Systems", brand: null, emoji: "🧻", dept: "housekeeping", cadence: 12,
    category: "linen contract", role: "Contracted linen collection and return",
    duty: "Track linen out versus in; a shortfall is a procurement problem, not a housekeeping one." },
  { slug: "sodexo", name: "Sodexo Clean", vendor: "Sodexo", brand: null, emoji: "🧽", dept: "housekeeping", cadence: 24,
    category: "contract cleaning", role: "Deep-clean and public-area contract crew",
    duty: "Log every completed area; an unlogged deep-clean did not happen." },
  { slug: "siemens", name: "Siemens BMS", vendor: "Siemens", brand: "siemens", emoji: "🌡️", dept: "engineering", cadence: 1,
    category: "building management", role: "HVAC, lifts and plant telemetry",
    duty: "Escalate any lift fault or water alarm to Engineering within the minute." },
  { slug: "telegram", name: "Telegram", vendor: "Telegram", brand: "telegram", emoji: "📣", dept: "people-culture", cadence: 1,
    category: "internal comms", role: "Shift handover and duty-manager escalation",
    duty: "Escalations go to a channel, never a DM — handovers must survive a person leaving." },
  { slug: "verkada", name: "Verkada", vendor: "Verkada", brand: null, emoji: "📹", dept: "security", cadence: 1,
    category: "access & CCTV", role: "Door access, key custody and camera events",
    duty: "Access logs are evidence: append only, never edit, never delete." },
  { slug: "square", name: "Square", vendor: "Square", brand: "square", emoji: "🧾", dept: "f-and-b", cadence: 2,
    category: "point of sale", role: "Bar and restaurant terminals",
    duty: "Every cover closed on a terminal must land in the folio before the Night Audit." },
  { slug: "googlecalendar", name: "Google Calendar", vendor: "Google", brand: "googlecalendar", emoji: "📅", dept: "events-banqueting", cadence: 4,
    category: "scheduling", role: "Function diary — every event, setup and teardown",
    duty: "A room double-booked is a red flag; refuse the write and escalate." },
];

// The executive committee — rank II is a table of seats, not one office. These
// are ROLES (the doctrine holds: roles are durable, agents are disposable); the
// humans filling them are the principals, never nodes.
const EXEC_SEATS = [
  { key: "general-manager", name: "General Manager", duty: "chairs the table; the only amending hand on the House Standard" },
  { key: "deputy-gm", name: "Deputy General Manager", duty: "runs the house day to day; deputises on every decision" },
  { key: "director-finance", name: "Director of Finance", duty: "owns the ledger, the budget and the monthly close" },
  { key: "director-people", name: "Director of People & Culture", duty: "owns the roster, training and everyone on it" },
];

const PERSONAS = {
  executive: "Meets at 09:00 daily; decides in the room, signs every amendment in ink.",
  "front-office": "First voice a guest hears; never lets a request die in a handover.",
  "f-and-b": "Runs service like a brigade; tastes everything twice.",
  housekeeping: "Precise, spares no linen, escalates before apologising.",
  engineering: "Keeps the invisible running; distrusts any gauge it hasn't tapped.",
  "spa-leisure": "Serene front, chlorine-checked back; the calm is engineered.",
  "events-banqueting": "Choreographs 400 covers without raising a voice.",
  security: "Sees every door; forgets no face; logs before judging.",
  "finance-procurement": "Counts what the house spends before the house feels it.",
  "people-culture": "Knows every rota clash before it happens; guards the roster's humans.",
};

// tier-2 named-role staff (real hotel roles, DESIGN list) — 52 total
const STAFF = {
  "front-office": [
    ["night-porter", "Night Porter"], ["concierge", "Concierge"], ["guest-relations", "Guest Relations"],
    ["reception", "Reception"], ["reservations", "Reservations"], ["bell-desk", "Bell Desk"],
  ],
  "f-and-b": [
    ["head-chef", "Head Chef"], ["sommelier", "Sommelier"], ["chef-de-rang", "Chef de Rang"],
    ["room-service", "Room Service"], ["pastry-chef", "Pastry Chef"],
    ["restaurant-manager", "Restaurant Manager"], ["bar-manager", "Bar Manager"],
  ],
  housekeeping: [
    ["floor-supervisor-east", "Floor Supervisor East"], ["floor-supervisor-west", "Floor Supervisor West"],
    ["laundry", "Laundry"], ["minibar", "Minibar"], ["linen-room", "Linen Room"], ["turndown", "Turndown"],
  ],
  engineering: [
    ["lift-engineer", "Lift Engineer"], ["hvac", "HVAC"], ["night-engineer", "Night Engineer"],
    ["pool-plant", "Pool Plant"], ["electrician", "Electrician"], ["decorator", "Painter & Decorator"],
  ],
  "spa-leisure": [
    ["therapist-rota", "Therapist Rota"], ["pool-attendant", "Pool Attendant"], ["gym-attendant", "Gym Attendant"],
    ["spa-reception", "Spa Reception"], ["treatments-lead", "Treatments Lead"],
  ],
  "events-banqueting": [
    ["wedding-coordinator", "Wedding Coordinator"], ["av", "AV"], ["banqueting-supervisor", "Banqueting Supervisor"],
    ["events-sales", "Events Sales"], ["florist", "Florist"], ["setup-crew-lead", "Setup Crew Lead"],
  ],
  security: [
    ["night-watch", "Night Watch"], ["cctv", "CCTV"], ["key-custody", "Key Custody"],
    ["door-team", "Door Team"], ["loading-bay", "Loading Bay"],
  ],
  "finance-procurement": [
    ["procurement", "Procurement"], ["payables", "Payables"], ["night-audit", "Night Audit"],
    ["receivables", "Receivables"], ["cost-controller", "Cost Controller"], ["paymaster", "Paymaster"],
  ],
  "people-culture": [
    ["rota", "Rota"], ["training", "Training"], ["recruitment", "Recruitment"],
    ["staff-welfare", "Staff Welfare"], ["payroll-liaison", "Payroll Liaison"],
  ],
};

// tier-3 generated rosters — 50 total (snapshot-only; not org roles)
const ROSTERS = [
  { dept: "housekeeping", slug: "room-attendant", label: "Room Attendant", n: 24,
    parentFor: (i) => (i <= 12 ? "agent:housekeeping-floor-supervisor-east" : "agent:housekeeping-floor-supervisor-west") },
  { dept: "f-and-b", slug: "commis-waiter", label: "Commis Waiter", n: 12,
    parentFor: () => "agent:f-and-b-restaurant-manager" },
  { dept: "f-and-b", slug: "kitchen-porter", label: "Kitchen Porter", n: 8,
    parentFor: () => "agent:f-and-b-head-chef" },
  { dept: "security", slug: "officer", label: "Security Officer", n: 6,
    parentFor: () => "agent:security-night-watch" },
];

// ── build the snapshot ───────────────────────────────────────────────────────
const nodes = [];
const links = [];
const N = (n) => { nodes.push(n); return n; };
const L = (source, target, type, weight) => { links.push({ source, target, type, weight }); };

// apex: THE HOUSE STANDARD — the root, in the gm band (see header)
N({
  id: "standard", type: "contract", layer: "gm", label: "THE HOUSE STANDARD",
  weight: 1.0, tier: 0, parent: null, cluster: null, icon: "⚖️",
  data: {
    desc: "The one law of the house — declared by the GM, inherited by every agent, amendable only from the top.",
    sections: [
      "§ 1 — The guest is never wrong twice",
      "§ 5 — Every escalation in writing within 15 minutes",
      "§ 9 — No department's ledger goes dark overnight",
      "§ 14 — Water-damage response",
      "§ 21 — The guest registry is sealed to all agents",
    ],
    amended: [{ section: "§ 14 — Water-damage response", at: iso(0.9 * DAY), by: "agent:executive" }],
  },
});

// gold band: the GM's agent
N({
  id: "agent:executive", type: "agent", layer: "gm", label: "THE EXECUTIVE",
  weight: 0.95, tier: 0, parent: "standard", cluster: null, icon: "🎩",
  // Rank II is a BODY, not a person (Jesse, 2026-07-19). A general manager is
  // one seat at a table; the thing that actually holds the House Standard and
  // that nine departments report into is the executive committee. Modelling it
  // as a single human was also why its dossier read "0 memories, 0 reports" —
  // one node was carrying what a committee does.
  data: { desc: PERSONAS.executive, health: "green", lastBoot: iso(0.2 * DAY), seats: EXEC_SEATS.map((s) => s.name) },
});
L("agent:executive", "standard", "declares", 0.9);
L("agent:executive", "standard", "amends", 1.0); // the unique modify-down authority (the trace, beat 4)
L("agent:executive", "standard", "inherits", 0.4);

// silver band: 9 department heads + their SOP contracts orbiting beside them
for (const d of DEPTS) {
  const head = `agent:${d.key}`;
  const sop = `contract:sop-${d.key}`;
  N({
    id: head, type: "agent", layer: "executive", label: d.name.toUpperCase(),
    weight: 0.8, tier: 1, parent: "agent:executive", cluster: d.key, icon: d.emoji,
    data: {
      desc: PERSONAS[d.key],
      health: d.key === "engineering" ? "amber" : "green",
      ...(d.key === "engineering" ? { note: "Lift E2 out of service · rooms 405/409 OOS (water damage)" } : {}),
      lastBoot: iso((0.1 + h(head + ":boot") * 0.9) * DAY),
    },
  });
  N({
    id: sop, type: "contract", layer: "executive", label: `SOP · ${d.name}`,
    weight: 0.55, tier: 1, parent: head, cluster: d.key, icon: "📜",
    data: { desc: `Standing operating procedure for ${d.name} — declared by its head, inherited by every ${d.name} agent.` },
  });
  L(head, "agent:executive", "reports_to", 0.8);
  L(head, "agent:executive", "escalates_to", 0.6);
  L(head, sop, "declares", 0.9);
  L(head, "standard", "inherits", 0.4);
}
// the trace, beat 2: Housekeeping escalates the Room 407 leak across sectors
L("agent:housekeeping", "agent:engineering", "escalates_to", 0.6);

// bronze band: 52 named-role staff (tier 2)
const staffIds = [];
for (const d of DEPTS) {
  for (const [slug, label] of STAFF[d.key]) {
    const id = `agent:${d.key}-${slug}`;
    staffIds.push(id);
    const stale = id === "agent:spa-leisure-pool-attendant"; // 🟡 dark-agent flag (DESIGN)
    N({
      id, type: "agent", layer: "staff", label,
      weight: 0.5, tier: 2, parent: `agent:${d.key}`, cluster: d.key,
      data: {
        role: label, dept: d.name,
        lastBoot: stale ? isoDays(12) : iso((0.2 + h(id + ":boot") * 2.8) * DAY),
        ...(stale ? { flag: "stale", note: "No boot in 12 days — dark agent" } : {}),
        ...(id === "agent:finance-procurement-night-audit"
          ? { automation: true, cadence: 24, lastRun: new Date(NIGHT_AUDIT_RUN).toISOString(), runsAt: "03:00", desc: "The 03:00 run — reconciles every ledger while the house sleeps. Crons live in the graph like anyone else." }
          : {}),
      },
    });
    L(id, `agent:${d.key}`, "reports_to", 0.8);
    L(id, "standard", "inherits", 0.4);
    L(id, `contract:sop-${d.key}`, "inherits", 0.4);
  }
}

// shift cover pairs (dossier data; tier2↔tier2, not rendered per edge budget)
for (const [a, b] of [
  ["front-office-night-porter", "front-office-concierge"],
  ["engineering-night-engineer", "engineering-hvac"],
  ["f-and-b-room-service", "f-and-b-chef-de-rang"],
  ["security-night-watch", "security-cctv"],
  ["housekeeping-turndown", "housekeeping-minibar"],
  ["spa-leisure-pool-attendant", "spa-leisure-gym-attendant"],
]) L(`agent:${a}`, `agent:${b}`, "covers", 0.3);

// Procurement supplies every other department
for (const d of DEPTS) if (d.key !== "finance-procurement")
  L("agent:finance-procurement-procurement", `agent:${d.key}`, "supplies", 0.4);

// tier-3 rosters — 50 generated agents
for (const r of ROSTERS) {
  for (let i = 1; i <= r.n; i++) {
    const nn = String(i).padStart(2, "0");
    const id = `agent:${r.dept}-${r.slug}-${nn}`;
    N({
      id, type: "agent", layer: "staff", label: `${r.label} ${nn}`,
      weight: 0.3, tier: 3, parent: r.parentFor(i), cluster: r.dept,
      data: { role: r.label, lastBoot: iso((0.3 + h(id + ":boot") * 6.7) * DAY) },
    });
    L(id, "standard", "inherits", 0.4);
    L(id, `contract:sop-${r.dept}`, "inherits", 0.4);
  }
}

// ── THE LEDGER: 12 buckets ───────────────────────────────────────────────────
const BUCKETS = [
  { id: "bucket:house", label: "ledger:house", parent: "agent:executive", cluster: null,
    reach: "all agents read", icon: "🗄️" },
  ...DEPTS.map((d) => ({
    id: `bucket:${d.key}`, label: `ledger:${d.key}`, parent: `agent:${d.key}`, cluster: d.key,
    reach: "department reads/writes; head owns", icon: "🗄️",
  })),
  { id: "bucket:executive", label: "ledger:executive", parent: "agent:executive", cluster: null,
    reach: "GM + heads", icon: "🗄️" },
  { id: "bucket:guest-registry", label: "ledger:guest-registry", parent: "agent:executive", cluster: null,
    reach: "SEALED — node visible, contents never emitted", icon: "🔒", sealed: true },
];
for (const b of BUCKETS) {
  N({
    id: b.id, type: "bucket", layer: "ledger", label: b.label,
    weight: 0.7, tier: 1, parent: b.parent, cluster: b.cluster, icon: b.icon,
    data: { reach: b.reach, ...(b.sealed ? { sealed: true, desc: "The wall itself: this bucket exists in the graph, its contents never leave the builder. Zero child nodes by construction." } : {}) },
  });
}
for (const d of DEPTS) {
  L(`agent:${d.key}`, `bucket:${d.key}`, "owns", 0.7);
  L(`agent:${d.key}`, "bucket:house", "reads", 0.35);
  L(`agent:${d.key}`, "bucket:executive", "reads", 0.35);
}
for (const b of ["bucket:house", "bucket:executive", "bucket:guest-registry"])
  L("agent:executive", b, "owns", 0.7);
for (const d of DEPTS)
  for (const [slug] of STAFF[d.key]) L(`agent:${d.key}-${slug}`, `bucket:${d.key}`, "reads", 0.35);
// the Night Audit walks the money ledgers at 03:00
for (const b of ["bucket:finance-procurement", "bucket:f-and-b", "bucket:front-office", "bucket:events-banqueting", "bucket:house"])
  L("agent:finance-procurement-night-audit", b, "audits", 0.5);

// ── documents (~180, owned by buckets; access = bucket reach) ────────────────
const DOC_KINDS = [
  ["rota", "Rota — current week"], ["rota", "Rota — next week"],
  ["checklist", "Opening checklist"], ["checklist", "Closing checklist"],
  ["supplier-contract", "Supplier contract — consumables"], ["supplier-contract", "Supplier contract — equipment"], ["supplier-contract", "Supplier contract — services"],
  ["sop-annex", "SOP annex A"], ["sop-annex", "SOP annex B"],
  ["manual", "Equipment manual"], ["manual", "Systems manual"],
  ["certificate", "Compliance certificate"],
  ["floor-plan", "Floor plan"],
  ["risk-assessment", "Risk assessment"],
  ["stock-list", "Stock list"],
  ["training-pack", "Training pack"],
  ["maintenance-log", "Maintenance log"],
  ["budget", "Budget worksheet"],
]; // 18 per department bucket
let docCount = 0;
const doc = (id, label, bucket, cluster, kind, extra = {}) => {
  docCount++;
  N({
    id, type: "document", layer: "ledger", label,
    weight: 0.25, tier: 3, parent: bucket, cluster,
    data: { kind, owner: bucket, updated: isoDays(1 + h(id) * 120), ...extra },
  });
};
for (const d of DEPTS) {
  DOC_KINDS.forEach(([kind, title], i) => {
    const id = `doc:${d.key}-${kind}-${i}`;
    // 🟠 the overdue flag: Engineering's lift inspection certificate, past due
    if (d.key === "engineering" && kind === "certificate") {
      doc(id, "Lift E2 — LOLER inspection certificate", `bucket:${d.key}`, d.key, kind,
        { flag: "overdue", due: isoDays(23), note: "Inspection 23 days past due — feeds Engineering's amber" });
    } else {
      doc(id, `${d.name} — ${title}`, `bucket:${d.key}`, d.key, kind);
    }
  });
}
[
  ["annex", "House Standard annex A — arrivals"], ["annex", "House Standard annex B — nights"],
  ["annex", "House Standard annex C — incidents"], ["annex", "House Standard annex D — amendments log"],
  ["plan", "Fire & evacuation plan"], ["plan", "Master floor plan"],
  ["pack", "Contractor induction pack"], ["plan", "Winter deep-clean masterplan"],
  ["manual", "Brand voice book"], ["list", "Emergency contact tree"],
].forEach(([kind, title], i) => doc(`doc:house-${i}`, title, "bucket:house", null, kind));
[
  ["report", "P&L pack — last month"], ["forecast", "Occupancy forecast — next quarter"],
  ["proposal", "Capex proposal — lift modernisation"], ["minutes", "Board minutes — this month"],
  ["report", "Payroll summary — last month"], ["review", "Energy review"], ["schedule", "Insurance schedule"],
].forEach(([kind, title], i) => doc(`doc:executive-${i}`, title, "bucket:executive", null, kind));
// ⚪ the orphan flag: a supplier contract no bucket owns (no parent, no links)
docCount++;
N({
  id: "doc:orphan-supplier-contract-linens", type: "document", layer: "ledger",
  label: "Supplier contract — Alba Linens (unfiled)",
  weight: 0.25, tier: 3, parent: null, cluster: null,
  data: { kind: "supplier-contract", flag: "orphan", note: "Ingested but never filed to a bucket — the ingestion-quality gate" },
});

// ── observations (~2,100) ────────────────────────────────────────────────────
let obsCount = 0;
const obs = (id, label, bucket, cluster, data, weight) => {
  obsCount++;
  N({
    id, type: "observation", layer: "ledger", label,
    weight: weight ?? 0.12 + h(id + ":w") * 0.08, tier: 3, parent: bucket, cluster, data,
  });
};

// routine observations — 1,910 over the last 90 days
const ROUTINE_KINDS = ["shift-log", "inspection", "stocktake", "delivery", "meter-reading", "maintenance-note", "training-log", "walkthrough"];
const ROUTINE = {
  "front-office": 240, "f-and-b": 260, housekeeping: 280, engineering: 250, "spa-leisure": 140,
  "events-banqueting": 160, security: 180, "finance-procurement": 200, "people-culture": 100,
  house: 70, executive: 30,
};
for (const [bk, count] of Object.entries(ROUTINE)) {
  const dept = DEPTS.find((d) => d.key === bk);
  const cluster = dept ? dept.key : null;
  const bucket = `bucket:${bk}`;
  const deptStaff = dept ? STAFF[dept.key].map(([slug]) => `agent:${dept.key}-${slug}`) : ["agent:executive"];
  for (let i = 0; i < count; i++) {
    const id = `obs:${bk}-${String(i).padStart(4, "0")}`;
    const kind = pick(id + ":k", ROUTINE_KINDS);
    const dOff = 0.05 + h(id + ":d") * 89.9; // last 90 days
    obs(id, `${kind} · ${dayLabel(dOff)}`, bucket, cluster, {
      kind, date: isoDays(dOff),
      subject: pick(id + ":s", deptStaff),
      note: `${dept ? dept.name : bk} ${kind.replace(/-/g, " ")} — routine, no exceptions raised`,
    });
  }
}

// incidents — 3 MAJOR in the last 7 days (the baked ASK answer), 12 recent
// minors, 19 older. No other kind="incident" severity="major" inside 7 days.
const MAJOR_INCIDENTS = [
  {
    id: "obs:incident-room-407-leak", bucket: "bucket:housekeeping", cluster: "housekeeping",
    label: "🔴 Water leak — Room 407", dOff: 1.2,
    data: {
      kind: "incident", severity: "major", flag: "critical", room: "407",
      loggedBy: "agent:housekeeping-room-attendant-07", escalatedTo: "agent:engineering",
      note: "Standing water at turndown, east wall saturated. Riser isolated; 405/409 OOS as precaution. House Standard § 14 amended next morning.",
    },
    weight: 0.4, // the flag must find the eye at default zoom
  },
  {
    id: "obs:incident-lift-e2-entrapment", bucket: "bucket:engineering", cluster: "engineering",
    label: "Lift E2 entrapment", dOff: 3.4,
    data: {
      kind: "incident", severity: "major",
      loggedBy: "agent:engineering-lift-engineer",
      note: "Guest lift E2 stopped between floors 3–4; 40-minute entrapment, released by engineer. Out of service pending overdue LOLER inspection.",
    },
    weight: 0.3,
  },
  {
    id: "obs:incident-gala-power-failure", bucket: "bucket:events-banqueting", cluster: "events-banqueting",
    label: "Ballroom power failure", dOff: 5.7,
    data: {
      kind: "incident", severity: "major",
      loggedBy: "agent:events-banqueting-av",
      note: "Full power loss in the ballroom 22:14 during the gala dinner, 11 minutes on generator; distribution board fault traced by Engineering.",
    },
    weight: 0.3,
  },
];
for (const m of MAJOR_INCIDENTS) {
  obs(m.id, m.label, m.bucket, m.cluster, { ...m.data, date: isoDays(m.dOff) }, m.weight);
}
const MINOR_BUCKETS = ["front-office", "f-and-b", "housekeeping", "engineering", "spa-leisure", "events-banqueting", "security", "finance-procurement", "people-culture", "house", "f-and-b", "security"];
MINOR_BUCKETS.forEach((bk, i) => {
  const id = `obs:incident-minor-${String(i).padStart(2, "0")}`;
  const dept = DEPTS.find((d) => d.key === bk);
  const dOff = 0.1 + h(id + ":d") * 6.8; // inside the week, all minor
  obs(id, `minor incident · ${dayLabel(dOff)}`, `bucket:${bk}`, dept ? dept.key : null, {
    kind: "incident", severity: "minor", date: isoDays(dOff),
    note: pick(id + ":n", [
      "Broken glass cleared, no injury", "Smoke detector false alarm, reset",
      "Key card reader jammed, freed", "Slip reported, wet-floor signage reviewed",
      "Delivery trolley damaged a door frame", "Guest corridor light out, replaced",
    ]),
  });
});
for (let i = 0; i < 19; i++) {
  const id = `obs:incident-old-${String(i).padStart(2, "0")}`;
  const bk = pick(id + ":b", DEPTS).key;
  const dOff = 8 + h(id + ":d") * 170; // strictly older than the week
  const severity = h(id + ":sev") < 0.35 ? "major" : "minor";
  obs(id, `${severity} incident · ${dayLabel(dOff)}`, `bucket:${bk}`, bk, {
    kind: "incident", severity, date: isoDays(dOff),
    note: "Closed incident from the archive — outside the current week",
  });
}

// absences — 5 years of HR records in ledger:people-culture.
// One roster agent is the unmistakable outlier (the baked ASK answer).
const OUTLIER = "agent:housekeeping-room-attendant-07";
const OUTLIER_COUNT = 98; // within the DESIGN 90–110 window
const ABSENTEES = [
  [OUTLIER, OUTLIER_COUNT],
  ["agent:housekeeping-room-attendant-14", 14],
  ["agent:f-and-b-commis-waiter-03", 12],
  ["agent:front-office-night-porter", 9],
  ["agent:engineering-hvac", 8],
  ["agent:security-cctv", 6],
  ["agent:spa-leisure-pool-attendant", 5],
  ["agent:events-banqueting-setup-crew-lead", 4],
]; // 7 background absentees at 3–15 each → the outlier is definitive
let absenceCount = 0;
for (const [subject, count] of ABSENTEES) {
  const short = subject.replace("agent:", "");
  for (let i = 0; i < count; i++) {
    const id = `obs:absence-${short}-${String(i).padStart(3, "0")}`;
    // spread deterministically across ~5 years (4d .. ~1,820d ago)
    const dOff = 4 + (i / count) * 1780 + h(id + ":j") * 30;
    const days = 1 + hi(id + ":len", 3);
    absenceCount++;
    obs(id, `absence · ${short} · ${dayLabel(dOff)}`, "bucket:people-culture", "people-culture", {
      kind: "absence", subject, date: isoDays(dOff), days,
      note: pick(id + ":n", ["sickness", "sickness", "unauthorised", "emergency leave", "late return"]),
    });
  }
}

// ── reports (~430): what the house has CLOSED, across three years ────────────
// A house running for years must SHOW years. Observations alone are a stream of
// raw noticing; a report is an agent closing something and handing it upward.
// Every report therefore carries `to` — its recipient — because "who does this
// go to?" is the question the graph must answer on its face, not by inference:
//   staff  → their department head
//   head   → the GM        (and lands in ledger:executive, which the GM reads)
//   GM     → the House Standard itself (the only thing above it)
// Bucket = where it lands; `to` = who receives it. Both are rendered.
let repCount = 0;
const rep = (id, agentId, toId, atMsAgo, summary, status, bucket, cluster) => {
  repCount++;
  N({
    id, type: "report", layer: "ledger",
    label: summary.length > 74 ? summary.slice(0, 71) + "…" : summary,
    weight: 0.2, tier: 3, parent: agentId, cluster,
    data: { agent: agentId.replace("agent:", ""), to: toId, at: iso(atMsAgo), summary, status, bucket },
  });
};

// what each department closes, month after month — plausible, never lorem
const MONTHLY = {
  "front-office": ["Arrivals ran clean; {n} late check-outs absorbed without a complaint.", "Handover log complete every night; {n} guest requests carried across shifts, none dropped.", "OTA rates reconciled; {n} overbooking risks caught before arrival."],
  "f-and-b": ["Covers up on the month; {n} supplier substitutions handled without a menu change.", "Allergen matrix re-verified across every station; {n} corrections filed.", "Cellar stocktake closed; {n} lines re-ordered, no 86s on service."],
  housekeeping: ["Turndown standard held; {n} deep-cleans completed to schedule.", "Linen contract audited; {n} items written off, replacement order raised.", "{n} rooms returned to service after maintenance; all inspected twice."],
  engineering: ["Planned maintenance closed; {n} reactive jobs raised and cleared.", "Plant readings within tolerance; {n} valves exercised on the quarterly round.", "{n} lift call-outs logged; service contract response times met."],
  "spa-leisure": ["Pool chemistry within limits all month; {n} manual corrections logged.", "Therapist rota covered; {n} shift swaps absorbed without cancelling a booking.", "{n} treatments delivered; equipment service due dates all current."],
  "events-banqueting": ["{n} functions delivered; setup and teardown to plan on every one.", "AV inventory reconciled; {n} items sent for repair, all returned.", "Function diary clean; {n} provisional holds converted or released on time."],
  security: ["{n} incidents logged; all closed within the standard's window.", "Key custody audit complete; {n} discrepancies found and resolved same day.", "Camera coverage verified; {n} door controllers firmware-patched."],
  "finance-procurement": ["Month-end closed on time; {n} invoices matched, none aged past terms.", "{n} supplier contracts reviewed; two re-tendered at better rates.", "Capex tracking current; {n} purchase orders raised against approved budget."],
  "people-culture": ["Rota published ahead of every week; {n} clashes resolved before publication.", "{n} training modules completed across the house.", "Absence tracked and followed up; {n} return-to-work conversations held."],
};
const MONTHS_BACK = 36; // three years of closes — the "years old company" evidence
for (const d of DEPTS) {
  for (let m = 1; m <= MONTHS_BACK; m++) {
    const id = `rep:${d.key}-m${String(m).padStart(2, "0")}`;
    const tpl = pick(id, MONTHLY[d.key]);
    const n = 3 + hi(id + ":n", 40);
    // Engineering's most recent closes carry the amber it is actually running
    // ONLY m=1 carries the live-incident text. m=2 originally described the
    // riser-valve replacement too — a repair the journal dates to AFTER the
    // leak, narrated in a close from 35 days before it. Same class of error as
    // the two below, caught by widening the causality assertion.
    const recentEng = d.key === "engineering" && m === 1;
    // m=1 is THIS month's close, filed days ago — not a month ago. The first
    // offset was m*30.4, which dated the most recent close 32 days back while
    // its text cites the Room 407 leak from ~1 day ago: a report quoting an
    // incident that had not happened yet. Engineering's m=1 is pinned tighter
    // still (0.4d) because it reports ON that leak, so it must land AFTER both
    // the incident (1.1d) and the staff reports that escalated it (0.55–1.05d).
    // Caught on the live render, twice — dates are a chain, not a decoration.
    const ageDays = recentEng && m === 1 ? 0.4 : (m - 1) * 30.4 + 2 + h(id + ":j") * 5;
    rep(
      id, `agent:${d.key}`, "agent:executive", ageDays * DAY,
      recentEng
        ? "Lift E2 remains out of service — LOLER re-inspection overdue; riser isolated on floor 4 after the Room 407 leak, 405/409 held OOS."
        : tpl.replace("{n}", String(n)),
      recentEng || (d.key === "engineering" && m === 2) ? "warn" : (h(id + ":s") > 0.94 ? "warn" : "ok"),
      "bucket:executive", d.key,
    );
  }
}
// the GM closes to the House Standard — the only authority above it
for (let m = 1; m <= MONTHS_BACK; m++) {
  const id = `rep:gm-m${String(m).padStart(2, "0")}`;
  const n = 2 + hi(id + ":n", 8);
  // m=1 is the GM's amendment RESPONDING to the leak, so it must land last in
  // the causal chain: leak 1.2d → attendant 1.05d → night engineer 0.55d →
  // Engineering's close 0.4d → the GM amends the Standard 0.25d. The assertion
  // below enforces it; this ordering is the 30-second trace told in filed work.
  const ageDays = m === 1 ? 0.25 : (m - 1) * 30.4 + 1 + h(id + ":j") * 4;
  rep(id, "agent:executive", "standard", ageDays * DAY,
    m === 1
      ? "Amended the House Standard § 14 (water-damage response) after the Room 407 leak; every department re-booted against the new clause."
      : `House review closed: ${n} standing items carried, all nine departments reporting; no clause amendments this month.`,
    "ok", "bucket:executive", null);
}
// the Night Audit's 03:00 run — the crons-in-the-graph story, nightly for 60 days
for (let i = 1; i <= 60; i++) {
  const id = `rep:night-audit-${String(i).padStart(3, "0")}`;
  rep(id, "agent:finance-procurement-night-audit", "agent:finance-procurement",
    NOW - (NIGHT_AUDIT_RUN - (i - 1) * DAY),
    i === 1
      ? "03:00 run: ledgers reconciled across 12 buckets. Flagged: Lift E2 LOLER certificate 23 days overdue; three major incidents filed to the executive ledger this week."
      : `03:00 run: ledgers reconciled across 12 buckets; ${hi(id + ":f", 4)} exceptions raised, all routed to their department.`,
    "ok", "bucket:finance-procurement", "finance-procurement");
}
// a handful of staff-level closes on the live incident — staff report to their head
[
  ["housekeeping-room-attendant-07", "housekeeping", 1.05, "Logged standing water in Room 407 at turndown and escalated to Engineering within nine minutes; floor sealed pending isolation.", "warn"],
  ["engineering-lift-engineer", "engineering", 0.95, "Attended lift E2; entrapment cleared, car parked and locked off. Will not return to service until the LOLER re-inspection is signed.", "warn"],
  ["engineering-night-engineer", "engineering", 0.55, "Riser isolation valve on floor 4 replaced; dehumidifiers running in 407, readings falling. Rooms 405/409 stay OOS overnight.", "ok"],
  ["security-night-watch", "security", 0.8, "Escorted the contractor to floor 4 out of hours; access logged, keys returned and reconciled at shift end.", "ok"],
  ["front-office-night-porter", "front-office", 0.7, "Moved the 407 guest to 512 with an apology and a bottle; no complaint raised, note left on the profile.", "ok"],
].forEach(([who, dept, days, summary, status]) => {
  rep(`rep:${who}-live`, `agent:${who}`, `agent:${dept}`, days * DAY, summary, status, `bucket:${dept}`, dept);
});

// ── the graph ────────────────────────────────────────────────────────────────
const graph = {
  booboo: "1.0",
  meta: {
    root: "standard",
    title: "The Pemberton Grand",
    layers: [
      { name: "gm", color: "#c9a04a", label: "GOLD · THE EXECUTIVE" },
      { name: "executive", color: "#b9c2d0", label: "SILVER · DEPARTMENT HEADS" },
      { name: "staff", color: "#b0793f", label: "BRONZE · STAFF AGENTS" },
      { name: "ledger", color: "#a78bd0", label: "THE LEDGER · MEMORY" },
    ],
    generated: new Date(NOW).toISOString(),
    counts: { nodes: nodes.length, links: links.length },
    quality: { orphans: 1, authored: 0, dumps: 0 },
  },
  nodes,
  links,
};

// ── the organigram (authority file — exact BOrg schema, spec/src/index.ts) ───
const org = {
  booboo_org: "1.0",
  title: "The Pemberton Grand",
  root: "executive",
  updated: new Date(NOW).toISOString(),
  agents: [
    {
      id: "executive", name: "The Executive", emoji: "🎩",
      role: EXEC_SEATS.map((s) => s.name).join(" · "),
      rules: ["rules/HOUSE_STANDARD.md"],
      buckets: ["house", "executive"],
      boot: "You are the Pemberton Grand's executive committee agent. Boot with booboo_boot('executive'). The table holds the House Standard; it alone amends it, always in writing. Route work to the nine heads; never do a department's job yourselves.",
      data: { seats: EXEC_SEATS },
    },
    ...DEPTS.map((d) => ({
      id: d.key, name: d.name, emoji: d.emoji, parent: "executive",
      role: PERSONAS[d.key],
      rules: [`rules/sop/${d.key.toUpperCase().replace(/-/g, "_")}.md`],
      buckets: [d.key],
      boot: `You are the ${d.name} head agent of the Pemberton Grand. Boot with booboo_boot('${d.key}'). Obey the House Standard first, your SOP second. Work only your own buckets; escalate to the Executive in writing.`,
    })),
    ...DEPTS.flatMap((d) =>
      STAFF[d.key].map(([slug, label]) => ({
        // No `role` here on purpose: the department is already the lane the
        // card sits in, so "Lift Engineer — Engineering" said nothing a
        // second time that the lane hadn't already said once. The card face
        // shows facts instead (health · bucket reach · rule count · last
        // report) — see Panel.tsx AgentCard.
        id: `${d.key}-${slug}`, name: label, parent: d.key,
        ...(d.key === "finance-procurement" && slug === "night-audit"
          ? {
              kind: "automation", cadence: 24, emoji: "🌙",
              boot: "You are the Night Audit. You run at 03:00, unattended. Boot with booboo_boot('finance-procurement-night-audit'), reconcile every ledger you audit, file one report, and stand down.",
            }
          : {}),
      })),
    ),
    // ── the machines the house actually runs on ────────────────────────────
    // A real hotel is a mesh of third-party services. Each is an `automation`
    // owned by the department that depends on it, carrying a `data.brand` slug
    // the panel renders as the real mark (simpleicons). This is what makes the
    // Pemberton read as an operation rather than a diagram: you can see, at a
    // glance, that Front Office lives on a PMS and a channel manager, that
    // money moves through Stripe, that the glue is n8n.
    ...INTEGRATIONS.map((m) => ({
      id: `svc-${m.slug}`,
      name: m.name,
      parent: m.dept,
      kind: "automation",
      emoji: m.emoji,
      cadence: m.cadence,
      role: m.role,
      boot: `You are the ${m.name} connector for the Pemberton Grand. Boot with booboo_boot('svc-${m.slug}'). ${m.duty}`,
      data: { brand: m.brand, vendor: m.vendor, category: m.category },
    })),
  ],
};

// ── the seed journal (exact JournalWriter shape — serve/src/journal.ts) ──────
const jEntry = (kind, agent, atMsAgo, text, extra = {}) => {
  const at = iso(atMsAgo);
  const parent = `agent:${agent}`;
  const cluster = extra.bucket ?? agent;
  const id = `${kind === "report" ? "rep" : "mem"}:${agent}:${Math.floor(NOW - atMsAgo).toString(36)}:${h4(agent + text)}`;
  const label = (extra.title ?? text).slice(0, 80);
  const data =
    kind === "report"
      ? { agent, at, summary: text, status: extra.status ?? "ok" }
      : { agent, at, text, kind: extra.kind ?? "context", bucket: cluster };
  return {
    node: { id, type: kind, layer: kind === "report" ? "reports" : "memory", label, weight: 0.2, tier: 3, parent, cluster, data },
    link: { source: parent, target: id, type: kind === "report" ? "filed" : "recalls" },
  };
};
const journal = [
  jEntry("memory", "housekeeping", 1.1 * DAY,
    "Room attendant 07 logged standing water in Room 407 at turndown; carpet saturated along the east wall. Escalated to Engineering within 9 minutes. [[obs:incident-room-407-leak]]",
    { kind: "incident", bucket: "housekeeping", title: "Room 407 leak logged + escalated" }),
  jEntry("report", "engineering", 1.0 * DAY,
    "Isolated the 4th-floor riser; dehumidifiers running in 407, rooms 405/409 out of service as a precaution. Lift E2 remains OOS pending the overdue LOLER re-inspection.",
    { status: "warn" }),
  jEntry("memory", "executive", 0.9 * DAY,
    "Amended the House Standard § 14 — water-damage response: any standing-water report now triggers riser isolation and adjacent-room checks within 15 minutes, no sign-off required. [[standard]]",
    { kind: "decision", bucket: "executive", title: "House Standard § 14 amended" }),
  jEntry("memory", "engineering", 0.6 * DAY,
    "The floor-4 riser isolation valve was seized half-open — replaced it and added a quarterly valve-exercise round to the maintenance log. [[obs:incident-room-407-leak]]",
    { kind: "pattern", bucket: "engineering", title: "Seized riser valve replaced" }),
  jEntry("report", "finance-procurement-night-audit", NOW - NIGHT_AUDIT_RUN,
    "03:00 run: ledgers reconciled across 12 buckets. Flagged: Lift E2 LOLER certificate 23 days overdue; three major incidents filed to the executive ledger this week.",
    { status: "ok" }),
];

// ── verify against reality, then emit ────────────────────────────────────────
const fail = (msg) => { console.error(`✗ ${msg}`); process.exitCode = 1; };

// count assertions (the DESIGN budget)
const byType = {};
for (const n of nodes) byType[n.type] = (byType[n.type] ?? 0) + 1;
const byLayer = {};
for (const n of nodes) byLayer[n.layer] = (byLayer[n.layer] ?? 0) + 1;
const byVerb = {};
for (const l of links) byVerb[l.type] = (byVerb[l.type] ?? 0) + 1;

if (obsCount !== 2100) fail(`observation count ${obsCount} ≠ 2100`);
if (docCount !== 180) fail(`document count ${docCount} ≠ 180`);
if (repCount !== 425) fail(`report count ${repCount} ≠ 425`);
if (nodes.length !== 2839) fail(`node count ${nodes.length} ≠ 2839`);

// Every report must name a recipient that EXISTS. "Who does this go to?" is the
// question the dossier answers on its face — a dangling `to` would render a
// recipient the graph cannot show, which is worse than showing none.
const ids = new Set(nodes.map((n) => n.id));
const reports = nodes.filter((n) => n.type === "report");
const noTo = reports.filter((r) => !r.data?.to);
const badTo = reports.filter((r) => r.data?.to && !ids.has(r.data.to));
if (noTo.length) fail(`${noTo.length} reports carry no recipient (data.to)`);
if (badTo.length) fail(`${badTo.length} reports name a recipient that is not a node: ${badTo.slice(0, 3).map((r) => r.data.to).join(", ")}`);
// three years of history, not a week of it
const spanDays = (NOW - Math.min(...reports.map((r) => Date.parse(r.data.at)))) / DAY;
if (spanDays < 1000) fail(`report history spans only ${Math.round(spanDays)} days — a years-old house must show years`);
// CAUSALITY: a report may not cite an incident that had not happened yet. This
// shipped wrong twice (a monthly close dated 32d, then 3.2d, describing a leak
// from 1.1d ago) because dates were tuned by eye instead of asserted.
const leakAt = Date.parse(nodes.find((n) => n.id === "obs:incident-room-407-leak").data.date);
for (const r of reports.filter((x) => /Room 407|riser|405\/409/i.test(x.data.summary))) {
  if (Date.parse(r.data.at) < leakAt) {
    fail(`report ${r.id} cites the Room 407 leak but is dated BEFORE it (${r.data.at} < ${new Date(leakAt).toISOString()})`);
  }
}

const clusters = new Set(nodes.map((n) => n.cluster).filter((c) => c != null));
if (clusters.size !== 9) fail(`distinct clusters ${clusters.size} ≠ 9 (even-ring branch needs exactly 9)`);

const flagged = nodes.filter((n) => n.data?.flag);
if (flagged.length !== 4) fail(`flagged nodes ${flagged.length} ≠ 4: ${flagged.map((n) => n.id).join(", ")}`);

const weekMajors = nodes.filter((n) =>
  n.data?.kind === "incident" && n.data?.severity === "major" &&
  NOW - Date.parse(n.data.date) < 7 * DAY);
if (weekMajors.length !== 3) fail(`major incidents in last 7 days ${weekMajors.length} ≠ 3`);

const absBySubject = {};
for (const n of nodes) if (n.data?.kind === "absence") absBySubject[n.data.subject] = (absBySubject[n.data.subject] ?? 0) + 1;
const sortedAbs = Object.entries(absBySubject).sort((a, b) => b[1] - a[1]);
if (sortedAbs[0][0] !== OUTLIER || sortedAbs[0][1] < 90 || sortedAbs[0][1] > 110) fail(`absence outlier wrong: ${JSON.stringify(sortedAbs[0])}`);
if (sortedAbs[0][1] < 2 * sortedAbs[1][1]) fail(`absence outlier not definitive: ${sortedAbs[0][1]} vs ${sortedAbs[1][1]}`);

// the sealed bucket must have zero contents — the wall, applied at emit
const sealedKids = nodes.filter((n) => n.parent === "bucket:guest-registry" || n.cluster === "guest-registry");
if (sealedKids.length) fail(`SEALED bucket has ${sealedKids.length} content node(s) — the wall leaked`);

// spec validation — the contract
const v = validate(graph);
const vo = validateOrg(org);
if (!v.ok) for (const e of v.errors) fail(`snapshot: ${e}`);
if (!vo.ok) for (const e of vo.errors) fail(`org: ${e}`);

// journal entries must not collide with snapshot ids, and parents must exist
const idSet = new Set(nodes.map((n) => n.id));
for (const e of journal) {
  if (idSet.has(e.node.id)) fail(`journal id collides with snapshot: ${e.node.id}`);
  if (!idSet.has(e.node.parent)) fail(`journal parent missing from snapshot: ${e.node.parent}`);
}

if (process.exitCode) {
  console.error("✗ NOT EMITTED — fix the failures above");
  process.exit(1);
}

const snapPath = join(OUT, "pemberton.booboo.json");
const orgPath = join(OUT, "org.pemberton.booboo.json");
const journalPath = join(OUT, "journal.seed.jsonl");
writeFileSync(snapPath, JSON.stringify(graph)); // compact: generated, served over the wire
writeFileSync(orgPath, JSON.stringify(org, null, 2) + "\n"); // pretty: a SOURCE the panel edits
writeFileSync(journalPath, journal.map((e) => JSON.stringify(e)).join("\n") + "\n");

console.log(`🏨 The Pemberton Grand — generated ${new Date(NOW).toISOString()}`);
console.log(`   nodes ${nodes.length} · links ${links.length} · layers ${graph.meta.layers.length} · clusters ${clusters.size}`);
console.log(`   by layer  · ${Object.entries(byLayer).map(([k, c]) => `${k}:${c}`).join(" · ")}`);
console.log(`   by type   · ${Object.entries(byType).map(([k, c]) => `${k}:${c}`).join(" · ")}`);
console.log(`   verbs     · ${Object.entries(byVerb).map(([k, c]) => `${k}:${c}`).join(" · ")}`);
console.log(`   flags     · ${flagged.map((n) => `${n.data.flag}→${n.id}`).join(" · ")}`);
console.log(`   incidents (major, last 7d) · ${weekMajors.map((n) => n.id).join(" · ")}`);
console.log(`   absence outlier · ${sortedAbs[0][0]} ×${sortedAbs[0][1]} (next: ${sortedAbs[1][0]} ×${sortedAbs[1][1]})`);
console.log(`   validate(snapshot) · ok:${v.ok} · errors:${v.errors.length} · warnings:${v.warnings.length}${v.warnings.length ? "\n     " + v.warnings.slice(0, 5).join("\n     ") : ""}`);
console.log(`   validateOrg        · ok:${vo.ok} · errors:${vo.errors.length} · warnings:${vo.warnings.length}${vo.warnings.length ? "\n     " + vo.warnings.slice(0, 5).join("\n     ") : ""}`);
console.log(`   journal seed · ${journal.length} entries (replay with --journal examples/pemberton/journal.seed.jsonl)`);
console.log(`   → ${snapPath}`);
console.log(`   → ${orgPath}`);
console.log(`   → ${journalPath}`);
