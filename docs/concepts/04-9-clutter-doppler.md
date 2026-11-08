### Clutter and Doppler — why a crossing drone vanishes

The radar's beam lights the ground as well as the sky, and the ground sends back an echo, called clutter, far stronger than a small drone's. The radar tells them apart by the Doppler shift: the echo of anything moving toward or away from the radar comes back at a slightly changed frequency, and the ground's does not. Filtering out the unshifted echoes removes the clutter, but also any target whose speed along the line of sight is too small, like one flying across the beam.

- **Formula:** `f_D = 2 · v_r / λ`, with the radial speed `v_r = v · cos(angle between its path and the line of sight)`
- **Example:** with a 10 cm wavelength, a drone flying straight at the radar at 40 m/s shifts its echo by 800 Hz. Flying across the beam 6 km out, it stays inside the ±10 m/s notch for 78 s, long enough for its track to be lost.
- **See it:** set Blind zones to "clutter" to see the ground the radar lights. Select any aircraft: the inspector's Doppler line shows its radial speed and whether the notch hides it.

<!-- more -->

## Going deeper

**Which ground is lit.** Only ground the radar can see sends clutter back: over flat land that is everything inside the antenna's own horizon, about 14 km from a 12 m mast, plus hillsides facing the radar farther out. Ground behind a hill or below the horizon is in shadow. The search radar's beam is a tall fan, so a target's echo arrives together with the echo of the ground at the same distance on the same bearing: below a low flyer, farther out for a high one.

**The low-Doppler notch.** A pulse-Doppler radar sorts echoes by their frequency shift. Where the target's echo shares its distance with lit ground, the radar throws away everything whose radial speed is under 10 m/s, coming or going. Outside that notch the clutter is assumed to be removed perfectly. Away from lit ground nothing is thrown away, so a crossing target is seen as usual.

**Why it matters.** Crossing the beam is the classic way to hide from a Doppler radar: a fast jet's evasive break does it by chance, and a slow drone flying into a strong headwind can come close to hovering over the ground. All the numbers are illustrative.
