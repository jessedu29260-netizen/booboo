import { describe, it, expect } from "vitest";
import { truncateLabel, MAX_LABEL_CHARS } from "../src/label.js";

describe("truncateLabel", () => {
  it("leaves short labels untouched", () => {
    expect(truncateLabel("Core")).toBe("Core");
  });

  it("passes a label exactly at the cap through untouched", () => {
    const label = "x".repeat(MAX_LABEL_CHARS);
    expect(truncateLabel(label)).toBe(label);
    expect(truncateLabel(label).length).toBe(MAX_LABEL_CHARS);
  });

  it("truncates a pathological label to the cap, with an ellipsis", () => {
    const pathological = "n".repeat(50_000); // no whitespace — real-world dump-suspect shape
    const out = truncateLabel(pathological);
    expect(out.length).toBe(MAX_LABEL_CHARS);
    expect(out.endsWith("…")).toBe(true);
  });
});
