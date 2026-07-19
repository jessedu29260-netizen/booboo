// GENERATED from design/tokens.json by scripts/gen-tokens.mjs — DO NOT EDIT
export const COLOR = {
  "bg": "#06080e",
  "bgLift": "#0a0d15",
  "card": "#0f131c",
  "line": "#1c2130",
  "lineHi": "#2b3243",
  "text": "#E8DCC4",
  "dim": "#8a8268",
  "faint": "#585240",
  "gold": "#c9a04a",
  "goldHi": "#E8C877",
  "teal": "#4ECDC4",
  "violet": "#a78bd0",
  "green": "#5fae7e",
  "amber": "#d6a23e",
  "red": "#d05a5a"
} as const;

/** Verb → colour. One relation, one hue, on every surface. */
export const VERB_COLOR: Record<string, string> = {
  "reports_to": "#c9a04a",
  "declares": "#E8C877",
  "amends": "#E8C877",
  "inherits": "#8a8268",
  "owns": "#4ECDC4",
  "reads": "#3a7a74",
  "escalates_to": "#d05a5a",
  "covers": "#5fae7e",
  "supplies": "#a8815a",
  "audits": "#a78bd0",
  "spine": "#29242f",
  "tether": "#29242f"
};

/** Ranked alarm states — luminance rank 1 (CRAFT §1). Worst first. */
export const FLAG_ORDER = ["critical","overdue","stale","orphan"] as const;
export type FlagKind = (typeof FLAG_ORDER)[number];
export const FLAG_COLOR: Record<FlagKind, string> = {
  critical: "#d05a5a",
  overdue: "#d6a23e",
  stale: "#c9a04a",
  orphan: "#8a8268",
};

/** Per-band rim/disc/label, keyed by the Pemberton band names. */
export const BAND = {
  "gm": {
    "rim": "#c9a04a",
    "disc": "#3a2e22",
    "label": "GOLD · GENERAL MANAGER"
  },
  "executive": {
    "rim": "#9aa5a0",
    "disc": "#26302c",
    "label": "SILVER · DEPARTMENT HEADS"
  },
  "staff": {
    "rim": "#a8815a",
    "disc": "#2e2620",
    "label": "BRONZE · STAFF AGENTS"
  },
  "ledger": {
    "rim": "#6a5aa0",
    "disc": "#2a2342",
    "label": "THE LEDGER · MEMORY"
  }
} as const;

export const EASING = {
  "swift": "cubic-bezier(0.2, 0.7, 0.25, 1)",
  "settle": "cubic-bezier(0.16, 1, 0.3, 1)"
} as const;
export const DURATION = {
  "micro": 120,
  "state": 300,
  "camera": 800,
  "entrance": 3500
} as const;
export const Z = {
  "canvas": 0,
  "hud": 10,
  "dossier": 20,
  "palette": 30,
  "toast": 40
} as const;
