### Gating and association — which echo belongs to which track

With several targets, false alarms and noise, the tracker must decide which new echo continues which track, without knowing what made it. It draws a "gate" around each track's predicted position, sized by its uncertainty, and only echoes inside the gate are candidates. The closest pairs, measured in standard deviations, are matched first; leftover echoes start new tentative tracks.

- **Formula:** `d² = νᵀ · S⁻¹ · ν < 16.3`, where ν is the gap between the echo and the prediction and S its expected spread (the 99.9% limit for three dimensions)
- **Example:** a track predicted to ±100 m: an echo 250 m off is 2.5 standard deviations (d² = 6.3) and joins it; one 500 m off is 5 standard deviations (d² = 25) and starts a new track instead.
- **See it:** drop a drone swarm: six echoes close together. Watch the tracks settle into one per drone after a few sweeps, and press T to see which track follows which drone.

<!-- more -->

## Going deeper

**Global nearest neighbour.** Every echo-track pair inside its gate is scored by `d²`. The best pair is taken first, then the best remaining one, and so on, so each echo feeds at most one track and each track gets at most one echo per antenna pass. This simple rule works well when targets are well separated, and can swap tracks when they are close: real trackers add multi-hypothesis methods for that.

**Batches, not single echoes.** The beam sweeps a swarm over several ticks. If each echo were matched the moment it arrived, the first one swept could grab a new track that belongs to its neighbour. So echoes are matched in batches covering 0.2 s of sweep (18°), and each is committed 0.2 s after it was received.

**Starting and dropping tracks.** A new track starts with an unknown velocity (±120 m/s), so its first gate is wide. The second echo confirms it and fixes the velocity. A tentative track whose next look brings nothing is dropped; that is how false alarms disappear. Confirmed tracks survive three silent turns.

**Perception only.** The tracker uses only measured positions. Each track also keeps a link to the aircraft behind its last echo, but only the truth overlay, the tests and the physics read it.
