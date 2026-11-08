### Radar horizon — why the Earth's curve hides low flyers

Radar waves travel in almost straight lines, but the Earth curves away beneath them, so far enough out even open ground hides a low target. The air bends radio waves slightly back down, which the textbook "4/3 Earth" model handles by drawing the Earth a third larger than it is. The higher the antenna and the higher the target, the farther the horizon.

- **Formula:** `d ≈ 4.12 km × (√h_radar + √h_target)`, heights in metres
- **Example:** with the 12 m antenna, a target at 50 m is below the horizon beyond 4.12 × (3.5 + 7.1) ≈ 43 km; a jet at 6,000 m stays in view out to 330 km.
- **See it:** select a low aircraft far out: the inspector's "Radar view" row says when it is below the horizon.

<!-- more -->

## Going deeper

**Where the formula comes from.** A straight line from a height `h` touches a sphere of radius `R` at a distance `d = √(2·R·h)` (Pythagoras, with `h` much smaller than `R`). The radar and the target each have their own tangent distance, and the two add up. With the effective radius `R = 4/3 × 6,371 km = 8,495 km`, `√(2R) ≈ 4.12 km` per square-root metre.

**How the simulator uses it.** Positions stay on a flat local map, which is accurate to a few metres over 40 km. Only lines of sight are curved: at ground distance `d` the Earth (and every hill on it) sinks by `d² / (2R)`, which is 94 m at 40 km. The radar sees a target only if the straight line from its antenna clears that curved ground everywhere in between.

**Why it matters.** Over 40 km the horizon only bites for targets flying a few tens of metres up, but those are exactly the cruise-missile-like targets that hug the ground. Higher antennas push the horizon out, which is why real radars sit on masts and hills.
