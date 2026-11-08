### Wind — why a drone crabs sideways

Aircraft fly through the air, and the air itself moves, so their path over the ground is their own velocity plus the wind's. To hold a track, an aircraft turns its nose partly into the wind; what is left of its airspeed, plus the wind along its track, is its speed over the ground. Near the ground the wind is slowed by friction, so it grows with height.

- **Formula:** `ground speed = √(V² − w⊥²) + w∥`, with the wind at height h `w(h) = w₁₀ · (h / 10 m)^(1/7)`
- **Example:** an 8 m/s surface wind blows at 13 m/s at a drone's 300 m. Flying into it, a 40 m/s drone covers the ground at 27 m/s, a third slower; a 240 m/s cruise-missile-like target at 50 m loses only 4%.
- **See it:** the wind arrow on the radar scope shows this run's wind. Select a drone: the inspector shows its airspeed, the wind it meets and how far its nose is turned into it.

<!-- more -->

## Going deeper

**The wind triangle.** Three velocities add up: the aircraft's through the air (its heading and airspeed `V`), the air's over the ground (the wind `w`), and their sum, the aircraft's over the ground (its track and ground speed). Split the wind into a part along the track, `w∥`, and a part across it, `w⊥`. To cancel `w⊥`, the nose turns into the wind by the crab angle `asin(w⊥ / V)`; the rest of the airspeed, `√(V² − w⊥²)`, plus `w∥` carries it along the track. A crosswind stronger than the airspeed cannot be cancelled: the aircraft drifts.

**Wind and height.** Friction with the ground slows the air near the surface. The classic one-seventh power law, `w(h) = w₁₀ · (h / 10 m)^(1/7)`, is a fair average over open land: at 300 m the wind is 1.6 times the 10 m wind, at 6 km 2.5 times.

**In the simulator.** Each run draws its own wind from its seed: 2 to 12 m/s at 10 m, from any direction, the same over the whole map and steady (no gusts). Everything flies through it: interceptors too, whose drag depends on their speed through the air rather than over the ground. The numbers are illustrative.
