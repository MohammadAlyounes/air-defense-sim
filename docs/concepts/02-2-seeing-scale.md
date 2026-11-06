### Seeing scale — why heights are stretched and aircraft enlarged

At true scale the battlespace is a thin sheet, 80 km across but only 11 km tall at an airliner's cruising height, and a 2 m drone 30 km away would be a twentieth of a pixel. So the 3D view stretches heights (×2 by default) and draws each aircraft at a fixed size on screen, however far away it is. Labels always show the true altitude.

- **Formula:** `drawn height = true height × stretch`
- **Example:** a cruise-missile-like target flying 50 m above the ground is drawn 100 m up at ×2, and 200 m up at ×4.
- **See it:** switch the 3D view's Heights control between ×1, ×2 and ×4 and watch the drop lines grow.

<!-- more -->

## Going deeper

**Constant on-screen size.** For a camera with a vertical field of view `θ`, an object of size `s` at distance `d` covers `s / (2 d tan(θ/2))` of the screen height. Solving for `s` keeps it at a fixed number of pixels: `s = 2 d tan(θ/2) × pixels / screen height`. The 3D view applies this to every aircraft and to the radar site, every frame. Bigger types get a few more pixels (a drone 24, an airliner 36), so size still hints at what you are looking at.

**Why stretch heights at all?** Altitude matters in air defense: low flyers hide below the radar horizon (Step 5), and an interceptor's reach has a ceiling (Step 8). With heights stretched, the difference between 50 m and 300 m stays visible.

**What is never stretched.** The simulation always uses true heights. Stretching happens only when drawing, after the physics is done.
