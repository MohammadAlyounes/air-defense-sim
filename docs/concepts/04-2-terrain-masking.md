### Terrain masking — why hills hide what flies low behind them

A hill casts a "radar shadow", much like a shadow from a lamp at the radar's antenna. A target flying low behind the hill sits inside that shadow and cannot be seen, however strong the radar. The shadow is deeper the taller the hill, the closer it stands to the radar, and the farther the target is behind it.

- **Formula:** behind a hill of height `H` at distance `d₁`, a target at distance `d₂` is seen only above `h ≈ H × d₂ / d₁` (antenna near the ground)
- **Example:** a 400 m ridge 10 km out hides everything below about 1,200 m at 30 km, so a target flying 50 m above the ground stays hidden until it crosses the ridge.
- **See it:** switch on "Blind zones" under the scope: orange shows where the radar cannot see a target at 50 m, 300 m or 1 km above the ground.

<!-- more -->

## Going deeper

**How the coverage map is computed.** Walking out from the radar along each bearing, the simulator keeps the steepest angle up to any ground it has passed, Earth curvature included. Anything farther out is visible only above that angle, which gives the lowest visible height at every range. One pass per bearing (720 bearings, 200 samples each) builds the whole map in a few milliseconds.

**The landscape is made up.** The hills are generated from a seed with smooth noise and a few sharp ridges, so they match no real place. The battery stands in a flat valley 6 km wide; beyond it the hills rise to about 750 m. The ground is open to the north and east, while ridges to the south and west hide low flyers until they are 7 to 10 km out.

**Why it matters.** Terrain is the low flyer's best friend: a cruise-missile-like target that would be seen at 17 km over open ground may pop up only a few kilometres out from behind a ridge, leaving seconds instead of a minute. The placement readout warns you when the terrain will hide what you drop.
