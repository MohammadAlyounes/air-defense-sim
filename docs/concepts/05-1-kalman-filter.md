### Kalman filter — how the tracker sees through the noise

Every radar echo is a little off, so joining the raw blips would give a jittery track and a wild velocity. A Kalman filter keeps a best guess of position and velocity, together with how unsure it is, and moves the guess forward between echoes. When a new echo arrives, it blends the guess and the echo in proportion to how much it trusts each.

- **Formula:** `x̂ ← x̂⁻ + K · (z − x̂⁻)`, with the gain `K = P⁻ / (P⁻ + R)` (in one dimension: P⁻ is the prediction's variance, R the echo's)
- **Example:** a prediction good to ±80 m and an echo good to ±80 m give K = 0.5: the new estimate lies halfway, good to ±57 m (80 / √2). After a dozen echoes a jet's speed is known to within a few m/s, where two raw echoes 4 s apart could be 30 m/s off.
- **See it:** the faint ellipse around each track on the scope is its 2σ uncertainty, and the track table's ±1σ column shrinks as echoes come in. Press T to compare tracks with the truth.

<!-- more -->

## Going deeper

**The model.** The state is position and velocity in three dimensions, `x = [p, v]`, and the filter assumes a constant velocity with small random accelerations (white-noise acceleration). Each cycle predicts `x⁻ = F x` and `P⁻ = F P Fᵀ + Q`, then updates with the measured position `z`:

```
S = H P⁻ Hᵀ + R        K = P⁻ Hᵀ S⁻¹        x = x⁻ + K (z − H x⁻)        P = (I − K H) P⁻
```

**Measurement noise in metres.** The radar measures range, bearing and elevation. Their errors (30 m, 0.15° and 0.25°) become a covariance in metres through the Jacobian of the conversion, `R = J · diag(σ²) · Jᵀ`. Far out, bearing errors dominate, so the ellipse stretches sideways: 80 m across at 30 km, but only 30 m deep.

**Process noise.** `Q` lets the filter allow for manoeuvres: 4 m²/s³ horizontally and 30 m²/s³ vertically, where terrain-following targets keep changing height. More process noise means a filter that follows turns faster but smooths less.

**A check of honesty.** If the filter's uncertainty is right, the normalized innovation `νᵀ S⁻¹ ν` averages 3 (a chi-square value with three degrees of freedom). The unit tests check exactly that.
