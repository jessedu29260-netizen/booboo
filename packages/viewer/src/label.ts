// A pathological label (a multi-KB string with no whitespace, from malformed/adversarial
// source data) must never reach the DOM — it'd blow up layout width and per-frame text
// measurement. Kept dependency-free (no React/Three) so it's unit-testable in isolation.
export const MAX_LABEL_CHARS = 60;

export function truncateLabel(label: string, max = MAX_LABEL_CHARS): string {
  return label.length <= max ? label : label.slice(0, max - 1) + "…";
}
