### Rules of engagement — why speed and safety pull in opposite directions

Before firing, the battery must decide what a track is. It interrogates it with an identification check (IFF): friendly aircraft answer, civil aircraft broadcast a transponder code, hostiles stay silent. But a friendly transponder can fail, so silence is evidence, not proof, and the rules decide how much evidence is enough.

- **Formula:** chance a friend stays silent on `n` checks = `0.1ⁿ`; weapons TIGHT wait for 2 silent checks (1 in 100), weapons FREE fire after 1 (1 in 10)
- **Example:** FREE engages a jet 4 s sooner than TIGHT, but out of every ten friendly aircraft with a faulty transponder heading for a defended asset, about one would be shot down. Under TIGHT, about one in a hundred.
- **See it:** click "WCS TIGHT" in the header to switch to FREE or HOLD, and "AUTO" to SEMI-AUTO to approve every shot yourself (A to approve, H to hold fire).

<!-- more -->

## Going deeper

**Weapons control status.** HOLD: do not fire. TIGHT: fire only at tracks identified as hostile, here after two unanswered checks 4 s apart. FREE: fire at anything not identified as friendly or civil, including "unknown" tracks that have missed only one check.

**Operator modes.** In AUTO the command node fires on its own within the rules. In SEMI-AUTO it proposes each shot with the evidence (identity, threatened asset, intercept point, chance of a kill) and waits; the proposal lapses if the shot becomes impossible. Holding fire keeps the track from being proposed again for 20 s.

**Mistakes count as failures.** A friendly or civil aircraft shot down is an identification error. It is counted in the header next to leaks, and the result card says what went wrong. Every rule change and every approval is a recorded command, so a run with a mistake can be replayed exactly and studied.
