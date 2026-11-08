### Radar cross section — why a hundred times smaller is only three times closer

The radar cross section (RCS, written σ) is how big an object looks to radar: the area of an ideal reflector that would send back the same echo. It depends on shape, material and the angle it is seen from, not just on size: flat panels facing the radar flash brightly, rounded or angled shapes scatter the energy elsewhere. Because the echo weakens with the fourth power of range, even large changes in σ move the detection range surprisingly little.

- **Formula:** `P_received = P_t · G² · λ² · σ / ((4π)³ · R⁴)`, so the detection range grows as `(P_t · σ)^(1/4)`
- **Example:** doubling the transmitter power buys only 19% more range (2^¼ = 1.19). To see a 0.01 m² drone as far out as a 2 m² jet, the radar would need 200 times the power.
- **See it:** each palette card shows its radar size; while you place one, the readout says from how far the radar should see it: about 9.5 km for a drone, 36 km for a fast jet.

<!-- more -->

## Going deeper

**The terms of the radar equation.** `P_t` is the transmitted power, `G` the antenna gain (how tightly it focuses the energy, used once on the way out and once on the way back), `λ` the wavelength and `R` the range. The `(4π)³` and the `R⁴` come from the energy spreading over a sphere twice: out to the target, and back from it.

**Decibels.** Cross sections span a huge range, so they are often given in decibels relative to 1 m² (dBsm): 0.01 m² is −20 dBsm and 40 m² is +16 dBsm. The simulator uses four illustrative classes: tiny 0.01 m² (small drone), small 0.1 m² (cruise-missile-like target), medium 2 m² (fast jet, friendly aircraft) and large 40 m² (airliner).

**What is left out.** A real cross section flickers as the target turns (the Swerling model on the detection probability card captures that on average) and changes strongly with the angle it is seen from. Here each class has one fixed σ, the same from every side.
