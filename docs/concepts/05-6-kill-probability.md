### Kill probability — why one interceptor is not always enough

Even an interceptor that passes within its lethal radius does not always destroy its target. The chance that it does is the single-shot kill probability, Pk. It is lower against fast, agile targets and when the interceptor arrives slow after a long flight. So the battery looks after every shot and fires again if the target survived, until the threat is down or it is too late.

- **Formula:** `Pk = Pk_target × clamp(v_interceptor / 600 m/s, 0.5, 1)`, with Pk_target = 0.95 (slow), 0.85 (medium) or 0.75 (above 250 m/s); two shots give `1 − (1 − Pk)²`
- **Example:** a fast jet met by an interceptor slowed to 450 m/s: Pk = 0.75 × 0.75 = 0.56. A second shot raises the chance to 1 − 0.44² = 0.81.
- **See it:** the approval card, the log and the inspector show the chance of a kill for each shot. Watch for "burst … but survived" in the event log, followed by a second launch.

<!-- more -->

## Going deeper

**A generic teaching model.** Real kill probabilities depend on guidance accuracy, fuze and warhead details that this project deliberately leaves out (see SAFETY.md). The model here keeps two textbook trends: agile targets are harder, and an interceptor that has bled its energy manoeuvres less well.

**Shoot-look-shoot.** After each shot the battery waits for the radar's next look before firing again at the same target. It saves interceptors (no second round wasted on a target already destroyed) at the cost of time. Against fast threats close in, firing two at once (shoot-shoot-look) would buy a higher chance sooner for twice the interceptors; this battery always fires one at a time.

**Fire channels and saturation.** The tracking radar can guide only three engagements at once. When more threats arrive than channels, the rest must wait their turn: the defense is saturated. A drone swarm does exactly that: many cheap targets at once.
