### Air drag — why an interceptor's reach depends on altitude

Once its motor burns out, an interceptor coasts and the air slows it down. Drag grows with the square of speed and with air density, and the air thins out with height: at 6.6 km it is half as dense as at sea level. So the same interceptor reaches farther, and arrives faster, against a high target than against a low one.

- **Formula:** `a_drag = ρ(h) · v² / (2β)`, with the density `ρ(h)` of the standard atmosphere (1.225 kg/m³ at sea level) and the ballistic coefficient `β = 20,000 kg/m²`
- **Example:** at sea level and 760 m/s, drag slows it by 17.7 m/s² (almost 2 g); after 10 s of coasting it is down to 617 m/s and has flown 6.8 km instead of 7.6 km.
- **See it:** drop a fast jet high and a cruise-missile-like target low at the same distance: the low one is intercepted closer in, after a slower flight.

<!-- more -->

## Going deeper

**The ballistic coefficient.** `β = m / (Cd · A)` combines the mass `m`, the drag coefficient `Cd` and the frontal area `A`: a heavy, slender body has a high `β` and keeps its speed. The value here is an illustrative round number for a generic, fictional interceptor.

**A closed form for planning.** With drag alone, `dv/dt = −k·v²` with `k = ρ / (2β)` integrates to `v(t) = v₀ / (1 + k·v₀·t)` and a distance `s(t) = ln(1 + k·v₀·t) / k`. The command node uses this to predict how far an interceptor can fly in a given time, taking the air density halfway up to the target. The flight itself is integrated step by step, with drag, gravity, thrust and steering.

**The atmosphere model.** Since Step 4 the density comes from the International Standard Atmosphere (see the standard atmosphere card): the temperature falls with height, the pressure follows from the weight of the air above, and `ρ = p / (R·T)`. Before that it fell exponentially with a scale height of 8.5 km, the simplest textbook atmosphere, which is kept for comparison. Both sit behind the same small interface.

**Wind.** Drag depends on the speed through the air, so the simulator subtracts the wind from the interceptor's velocity before computing it. At 700 m/s a 15 m/s wind changes the drag by about 4%.
