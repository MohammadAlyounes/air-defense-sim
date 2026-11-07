# Concept cards

Short, plain-language explanations of the physics and engineering behind the simulator. Each card is used in three places: the README, these docs, and the in-app tooltips and lessons.

## Format

```
### <Concept> — <one-line hook>

<At most 3 plain sentences. Explain any jargon you use.>

- **Formula:** `<one line>`
- **Example:** <one concrete number example>
- **See it:** <where to see it in the simulator>
```

## Example

### Radar horizon — why low flyers hide

The Earth curves away, so a radar cannot see targets below its horizon. Radio waves bend slightly around the curve, so we model an Earth 4/3 larger than the real one.

- **Formula:** `d ≈ 4.12 × (√h_radar + √h_target)` km, heights in metres
- **Example:** a radar mast of 12 m sees a target flying at 50 m only within ~43 km.
- **See it:** Lesson 2, or the target-altitude slider on the coverage map (Step 4).

## Index

Cards are added as their steps land. File names are `NN-M-slug.md`: step `NN`, order `M` within the step.

| Step | Concepts                                                                                                                                                                                                                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | [Fixed time step and determinism](01-1-fixed-time-step.md) · [Antenna rotation](01-2-antenna-rotation.md)                                                                                                                                        |
| 2    | [Local coordinates](02-1-local-coordinates.md) · [Seeing scale](02-2-seeing-scale.md)                                                                                                                                                            |
| 3    | [Detection range](03-1-detection-range.md) · [Proportional navigation](03-2-proportional-navigation.md)                                                                                                                                          |
| 4    | [Radar horizon](04-1-radar-horizon.md) · [Terrain masking](04-2-terrain-masking.md) · [Detection probability](04-3-detection-probability.md) · [Air drag](04-4-air-drag.md) · coming: turn radius · radar equation and RCS · clutter and Doppler |
| 5    | [Kalman filter](05-1-kalman-filter.md) · [Gating and association](05-2-gating-association.md) · [Closest point of approach](05-3-closest-point-of-approach.md) · coming: identification friend-or-foe                                            |
| 6    | [Engagement envelope](06-1-engagement-envelope.md) · [Kill probability](06-2-kill-probability.md) · [Rules of engagement](06-3-rules-of-engagement.md) · coming: missile energy · kill assessment · saturation                                   |
| 7    | Monte Carlo and probability                                                                                                                                                                                                                      |
