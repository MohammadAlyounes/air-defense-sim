### Proportional navigation — why the interceptor leads its target

An interceptor that always points at its target ends up in a long tail chase. Instead, it watches the line of sight to the target and turns just enough to stop that line from rotating: if the line of sight holds still while the distance shrinks, the two are on a collision course. Sailors use the same rule to spot a collision: constant bearing, decreasing range.

- **Formula:** `a = N × Vc × λ̇` (sideways acceleration = navigation constant × closing speed × line-of-sight turn rate), with `N = 4`
- **Example:** closing at 500 m/s while the line of sight turns at 0.02 rad/s, the interceptor steers at 4 × 500 × 0.02 = 40 m/s², about 4 g.
- **See it:** watch an interceptor on the scope or in the 3D view: it flies toward the cyan cross (the predicted intercept point), not toward where the target is now.

<!-- more -->

## Going deeper

**In three dimensions.** Let `r` point from the interceptor to the target and `v_rel` be the target's velocity relative to the interceptor. The line of sight turns at `Ω = (r × v_rel) / |r|²` and the closing speed is `Vc = −(r · v_rel) / |r|`. True proportional navigation commands `a = N · Vc · (Ω × r̂)`, plus a term that cancels gravity, limited to the interceptor's g-limit (30 g here).

**The predicted intercept point.** Before launching, the command node looks for the earliest time `t` at which the interceptor's reach equals the target's future distance: `reach(t) = |p + v · t|`, using the track's position `p` and estimated velocity `v`. It assigns a launcher only if that point is within 34 s of flight and outside the 1.5 km minimum range.

**Endgame accuracy.** At a closing speed near 1 km/s, one 20 ms tick is 20 m, far coarser than the 15 m lethal radius. So interceptors move in 2 ms sub-steps, and within each sub-step the closest approach between the two straight paths is found exactly: `s* = −(r₀ · Δr) / |Δr|²`. The fuze goes off at that point.

**What later steps add.** Air drag slows the coasting interceptor (Step 4). Radar noise and a Kalman filter make the track, and so the guidance, imperfect (Steps 4 and 5). Fire channels, kill probability and engagement doctrine arrive in Step 6.
