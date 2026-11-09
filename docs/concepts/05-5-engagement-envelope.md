### Engagement envelope — where the battery can reach

An interceptor can only meet a target it can reach in time, before its motor's energy is spent and air drag has slowed it down. The set of places it can reach within its longest planned flight forms a dome over the battery: the engagement envelope. A threat outside it must wait until it flies in; a threat inside the 1.5 km minimum range is already too close.

- **Formula:** `R_max(h) = √(reach(t_max, ρ(h/2))² − h²)`, where `reach` is the interceptor's straight-line reach with drag in air of density ρ, with a 10% margin
- **Example:** with a 34 s planned flight, the dome reaches about 17 km at ground level and a little farther, 17.2 km, at 3 km up, where the thinner air saps less speed; it closes over the top just below 20 km.
- **See it:** press the umbrella button in the 3D view to show the dome. Drop a jet 35 km out: the command node waits ("out of reach for now") until the jet enters it.

<!-- more -->

## Going deeper

**How the planner uses it.** For each threat the command node searches for the earliest flight time `t` at which `0.9 · reach(t) ≥ |p + v·t|`: the predicted intercept point. If no such `t` exists within 34 s, the target is outside the envelope for now. The dome in the 3D view is the same calculation for a target that is standing still.

**Energy, not only distance.** Near the edge of the envelope the interceptor arrives slow, after 30 s of coasting. Slow interceptors steer less sharply, which lowers the chance of a kill: the edge of the envelope is not where you want to engage.

**What real envelopes add.** Real envelopes depend on the target's speed and heading, on altitude limits of the radar and on the fuze. These are left out on purpose: the textbook idea is reach versus time.
