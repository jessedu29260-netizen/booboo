# Structuring a brain as an organised org

booboo renders any graph, but a *company brain* reads best as an **organised org** —
tiers stacked top-to-bottom, each node in a section. This is a convention on top of the
spec (no new fields), so the viewer draws structure instead of a hairball.

## The contract

- **Tiers = `meta.layers[]`** — ordered apex → floor. Each layer is one horizontal plane.
  Put the root/leadership tier first, the deepest/most-numerous (memory, logs) last.
- **A node's tier = `node.layer`** — must match a declared layer.
- **A node's section = `node.cluster`** — the vertical grouping *within* its tier. Nodes
  sharing a `cluster` line up as a column. **The section axis may differ per tier** — one
  tier can be sectioned by team, another by type. That's fine; each tier groups by whatever
  is true for it.
- **`node.parent`** draws the hierarchy spine (flow between tiers); **`node.tier`** (0 = apex)
  ranks importance within a plane so structural nodes read bigger than noise.

## The one rule: every node has a place

Every node **must** have a valid `layer`, and **should** have a `cluster`. A node with no
section isn't a rendering problem — it's a **data smell**: something in your system that
nothing owns. Fix it at the source. A clean brain is the point; the picture just shows you
where it isn't clean yet.

## Don't fabricate structure

Section by what's *true* in the data. If a tier genuinely isn't team-scoped (shared
infrastructure, portfolio-wide memory, cross-cutting workflows), section it by its own
natural axis — don't force it into columns it doesn't belong to. Honest "organised chaos"
beats a tidy lie.

## Example — a company brain

```
layers (top → bottom):   hq · teams · workflows · logs · knowledge · memory
sections:                hq→root · teams→by-team · workflows→by-family ·
                         logs→by-source · knowledge→by-team · memory→by-type
```

## It's live, not a picture

The org file is the source your agents boot from — so editing the structure (move a node to
a new parent/tier, retag a section) should write back to that file, and agents pick up the
new shape on their next boot. The graph is an instrument you operate, not a diagram you read.
