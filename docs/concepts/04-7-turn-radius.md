### Turn radius — why fast things turn wide

To turn, an aircraft banks and tilts its lift sideways, and the sideways part of the lift bends its path into a circle. At the same bank, the circle grows with the square of the speed, so fast aircraft turn wide. Pulling a higher load factor (the lift divided by the weight, counted in g) tightens the turn.

- **Formula:** `r = V² / (g · √(n² − 1))`, with the load factor `n = 1 / cos(bank)` in a level turn
- **Example:** at 340 m/s a fast jet's routine 60° bank (2 g) turns on a 6.8 km radius and a hard 6 g break on 2.0 km; a 40 m/s drone banked at 35° turns on 233 m.
- **See it:** drop a cruise-missile-like target 30 km out: it flies a dog-leg and rounds the corner on a 5.9 km arc. Drop a fast jet: when an interceptor closes to 6 km, it breaks hard away at 6 g.

<!-- more -->

## Going deeper

**Where the formula comes from.** In a level, coordinated turn the lift `L = n·W` is tilted by the bank angle `φ`. Its vertical part carries the weight, `L·cos φ = W`, so `n = 1 / cos φ`. Its horizontal part, `W·√(n² − 1)`, is the centripetal force `m·V² / r` that bends the path. That gives the turn rate `ω = g·√(n² − 1) / V` and the radius `r = V / ω`.

**Routes and lead turns.** Waypoints are joined by straight legs. An aircraft starts its turn onto the next leg early, `r · tan(Δψ / 2)` before the waypoint for a change of heading `Δψ`, so it rolls out on the new leg instead of overshooting it. A cruise-missile-like target flies a dog-leg (off to one side halfway, then back in), so its first leg does not point at its target, but only on routes at least three turn radii long.

**The evasive break.** A fast jet that an interceptor is guided at waits until it is 6 km away, then turns at 6 g to fly at right angles to the interceptor's line of sight. That forces the interceptor into its hardest turn, and the jet also flies across the search radar's beam, where its echo can fall into the clutter notch. It holds the break for 6 s, once per interceptor, then turns back toward its target. The tracker follows the break through a wider second gate. All the numbers are illustrative.
