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
- **See it:** Lesson 2, or the target-altitude slider on the coverage map (Step 5).

## Index

Cards are added as their steps land. File names are `NN-M-slug.md`: step `NN`, order `M` within the step.

| Step | Concepts                                                                                                  |
| ---- | --------------------------------------------------------------------------------------------------------- |
| 1    | [Fixed time step and determinism](01-1-fixed-time-step.md) · [Antenna rotation](01-2-antenna-rotation.md) |
| 2    | [Local coordinates](02-1-local-coordinates.md) · [Seeing scale](02-2-seeing-scale.md)                     |
| 3    | Detection range · proportional navigation                                                                 |
| 4    | Air density · drag · turn radius                                                                          |
| 5    | Radar equation · radar horizon · terrain masking · clutter                                                |
| 6    | Noise and the Kalman filter                                                                               |
| 7    | Identification friend-or-foe · closest point of approach                                                  |
| 8    | Engagement envelope · missile energy · kill probability                                                   |
| 9    | Kill assessment · saturation                                                                              |
| 12   | Monte Carlo and probability                                                                               |
