### Antenna rotation — why blips jump instead of gliding

A search radar's antenna spins, so it sees each aircraft only when its beam sweeps past. Between passes the screen keeps showing the last echo, slowly fading like the phosphor of an old radar tube. A faster spin refreshes the picture more often, but leaves the beam less time on each target.

- **Formula:** `refresh interval = 360° ÷ rotation rate` (here, one turn every 4 s)
- **Example:** a fast jet at 340 m/s moves 1.36 km between two passes of the beam.
- **See it:** watch a fast-moving blip on the radar scope: each new echo lands a short jump ahead of the last one.

<!-- more -->

## Going deeper

**How the simulator paints a target.** The antenna starts pointing north and turns clockwise, one full turn every 4 seconds. During each 20 ms tick it sweeps 1.8°. Every aircraft whose bearing falls inside that thin slice, and that is within range, produces one detection (a _plot_): its position at that moment.

**Why the scope is a circle.** This display is called a PPI (plan position indicator). The battery sits at the centre, north is up, and distance from the centre is ground range. The rings are every 10 km, out to the radar's 40 km range.

**What is simplified in this step.** Detection is perfect: every aircraft in range is painted on every pass, at its exact position. Later steps make it realistic: how strongly a target reflects radio waves (radar cross section), noise in the measured position, the curve of the Earth hiding low flyers, hills masking targets, and ground clutter.
