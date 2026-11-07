### Air drag — why an interceptor's reach depends on altitude

Once its motor burns out, an interceptor coasts and the air slows it down. Drag grows with the square of speed and with air density, and the air thins out with height, halving about every 6 km. So the same interceptor reaches farther, and arrives faster, against a high target than against a low one.

- **Formula:** `a_drag = ρ(h) · v² / (2β)`, with `ρ(h) = 1.225 kg/m³ × e^(−h / 8.5 km)` and ballistic coefficient `β = 20,000 kg/m²`
- **Example:** at sea level and 760 m/s, drag slows it by 17.7 m/s² (almost 2 g); after 10 s of coasting it is down to 617 m/s and has flown 6.8 km instead of 7.6 km.
- **See it:** drop a fast jet high and a cruise-missile-like target low at the same distance: the low one is intercepted closer in, after a slower flight.

<!-- more -->

## Going deeper

**The ballistic coefficient.** `β = m / (Cd · A)` combines the mass `m`, the drag coefficient `Cd` and the frontal area `A`: a heavy, slender body has a high `β` and keeps its speed. The value here is an illustrative round number for a generic, fictional interceptor.

**A closed form for planning.** With drag alone, `dv/dt = −k·v²` with `k = ρ / (2β)` integrates to `v(t) = v₀ / (1 + k·v₀·t)` and a distance `s(t) = ln(1 + k·v₀·t) / k`. The command node uses this to predict how far an interceptor can fly in a given time, taking the air density halfway up to the target. The flight itself is integrated step by step, with drag, gravity, thrust and steering.

**The atmosphere model.** Density falls exponentially with a scale height of 8.5 km, the simplest textbook atmosphere. It sits behind a small interface, so a fuller standard-atmosphere table can replace it later.
