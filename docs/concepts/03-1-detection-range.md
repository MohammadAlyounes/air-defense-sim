### Detection range — why small drones are seen late

A radar sees an object by the echo it sends back, and that echo weakens very fast with distance: twice as far gives one sixteenth of the signal. So the range at which an object is first detected grows only with the fourth root of its radar cross section, which is how big it looks to radar. An object with a hundredth of the cross section is seen at about a third of the range.

- **Formula:** `R_detect = R_ref × (σ / 1 m²)^(1/4)`, with `R_ref = 30 km` here
- **Example:** a small drone (σ = 0.01 m²) is first seen at 30 × 0.01^¼ ≈ 9.5 km; a fast jet (2 m²) at about 36 km.
- **See it:** drag a drone onto the map: the readout says the radar sees it from 9.5 km, and the scope stays empty until it gets there.

<!-- more -->

## Going deeper

**Where the fourth power comes from.** The radar's pulse spreads out on the way to the target (one factor of `1/R²`), and the echo spreads out again on the way back (another `1/R²`). The radar range equation puts it together: `P_received = P_t · G² · λ² · σ / ((4π)³ · R⁴)`. Detection needs the signal to stand out from the receiver's noise by a threshold, so the farthest detection range is proportional to `σ^(1/4)`.

**The numbers in the simulator.** Each radar size class has an illustrative, round cross section: tiny 0.01 m² (small drone), small 0.1 m² (cruise-missile-like target), medium 2 m² (fast jet, friendly aircraft) and large 40 m² (airliner). The detection ranges follow: 9.5 km, 16.9 km, 35.7 km and 40 km. The airliner would be seen at 75 km, but the radar ignores echoes beyond its 40 km instrumented range.

**Why it matters.** Time is everything in air defense. A drone first seen at 9.5 km and flying at 40 m/s leaves about four minutes; a cruise-missile-like target first seen at 17 km and flying at 240 m/s leaves about 70 seconds.

**What Step 5 adds.** Detection becomes a probability (the Swerling model): even inside the range an echo can be missed, and false alarms appear. The radar horizon and the terrain also block the view, so low flyers can hide.
