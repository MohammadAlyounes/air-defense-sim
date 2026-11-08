### Standard atmosphere — why the air thins and cools with height

The air near the ground is squeezed by the weight of all the air above it, so it is densest at the bottom and thins out with height. It also cools by 6.5 °C for every kilometre up to 11 km, then stays at −56.5 °C. Thinner air means less drag, so the same interceptor flies farther and arrives faster against a high target.

- **Formula:** `ρ = p / (R · T)`, with `T = 15 °C − 6.5 °C/km × h` and the pressure `p` set by the weight of the air above
- **Example:** at 5 km the air is at −17.5 °C and 540 hPa, with 60% of its sea-level density (0.736 kg/m³); at 11 km it is down to 30% (0.364 kg/m³).
- **See it:** switch on the engagement envelope in the 3D view: for the first 3 km its edge leans outward, because the interceptor flies through thinner air.

<!-- more -->

## Going deeper

**The International Standard Atmosphere (ISA).** An agreed average atmosphere, used to compare aircraft and instruments: 15 °C and 1013.25 hPa at sea level, with a fixed temperature gradient in each layer. The simulator uses its first three layers: the troposphere (cooling 6.5 °C per km up to 11 km), the lower stratosphere (−56.5 °C from 11 to 20 km) and the layer above it (warming 1 °C per km up to 32 km).

**Pressure from the weight of the air.** Each thin layer of air holds up the weight of the air above it, `dp/dh = −ρ·g`. With the ideal gas law `ρ = p / (R·T)`, where `R = 287 J/(kg·K)` for dry air, this gives `p = p_b · (T / T_b)^(−g / (L·R))` in a layer whose temperature changes at the rate `L`, and `p = p_b · e^(−g·(h − h_b) / (R·T))` in a layer at constant temperature (`p_b`, `T_b`, `h_b`: the values at the layer's base).

**The speed of sound** depends only on the temperature, `a = √(γ·R·T)` with `γ = 1.4`: 340 m/s at sea level, 295 m/s at 11 km.

**Compared with the exponential model.** The simpler `ρ = 1.225 kg/m³ · e^(−h / 8.5 km)`, used before Step 4 and kept for tests, halves the density at 5.9 km. The standard atmosphere halves it near 6.6 km, so its air is a little denser at mid altitudes. Heights are measured from the battery's ground, which the simulator treats as sea level.
