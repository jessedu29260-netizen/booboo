---
"@booboo-brain/viewer": minor
"@booboo-brain/panel": patch
---

Make both faces work below desktop width — the first time either has been looked at on a phone.

**viewer** — the camera now fits to aspect. `fov` in three.js is the *vertical*
angle, so the horizontal one is whatever the viewport leaves you: a comfortable
~37° at 1600×1000, and ~11° at 390×844, which put the camera inside the building
looking at three light-shafts edge-on. It dollies back instead of widening the
lens, because holding the horizontal angle costs a 73° vertical fov on a phone
and that much distortion turns a measured orrery into a fisheye. Desktop framing
is unchanged (the factor is exactly 1 at the aspect the scene was composed at),
and a resize only re-frames when the fit actually changes, so it can no longer
throw away a user's zoom and pan.

Also on narrow: the orientation card docks to the bottom instead of covering the
top third of the scene it is explaining, the 3D band labels are dropped (pulled
back far enough to fit a phone they overprint into a smear, and the card already
names the bands in order), the fourteen-slider drawer is hidden (its button sat
on top of the hint line), and the band legend is dropped as a second copy of what
the card already says. Touch devices are told "drag to turn · pinch to zoom · tap
a node" rather than to scroll and press a key they do not have.

**panel** — the auto-fit is floored at 45%. The arithmetic that gives a laptop a
readable 70% gives a phone 20%, where a plate is a coloured rectangle with a grey
smudge for a name; below the floor it stops shrinking and the board scrolls. And
the root is no longer auto-selected on a narrow viewport — there the dossier is
not a right rail but a sheet over half the screen, so a visitor's first sight of
the staff board was a card about one agent covering it. This is the same argument
the `?embed=1` case already made, applied one breakpoint further down.
