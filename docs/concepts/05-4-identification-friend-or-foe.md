### Identification friend-or-foe — why silence is evidence, not proof

The battery interrogates every confirmed track by radio: a friendly aircraft's transponder (a radio that replies on its own) answers, a civil one broadcasts its code, a hostile stays silent. A transponder can fail, so each silent check only makes "hostile" more likely, and it takes two in a row to declare it. What the track flies like adds evidence: silent and flying like a drone, a cruise missile or a jet, it is "suspect" at once; silent but flying like an airliner along a civil corridor, it is never called hostile on silence alone.

- **Formula:** `odds(hostile after n silent checks) = odds(hostile before) × 10ⁿ`, because a hostile is always silent and a friend only on 1 check in 10
- **Example:** starting from even odds, one silent check makes a track 10 to 1 hostile (91%) and two make it 100 to 1 (99%): there the battery declares it hostile.
- **See it:** select any track: the inspector's "Classifier" line says what it flies like, and "Why?" counts its silent checks. The green lanes on the scope are the civil corridors.

<!-- more -->

## Going deeper

**Odds and likelihood ratios.** Bayes' rule is simplest in odds form: the odds after a piece of evidence are the odds before, times the likelihood ratio, how much likelier that evidence is from a hostile than from a friend. Silence has probability 1 from a hostile and 0.1 from a friend, so each silent check multiplies the odds by 10. Against civil traffic, whose code is received on 98% of checks, one silence is worth a factor of 50.

**The catch: independent checks.** Multiplying the factors assumes each check fails on its own, as it does here (a new draw every check). A real transponder that is broken stays broken, so a second silence would add much less. That is why real identification never rests on one kind of evidence alone.

**The kinematic classifier.** From the track's filtered speed and height, not the truth, it sorts each track into five round-number classes chosen to separate this simulator's traffic: under 80 m/s is drone-like; 120 m/s or more under 300 m above the ground is cruise-missile-like; 290 m/s or more is jet-like; 180 m/s or more at 8 km or higher is airliner-like; anything else is an ordinary aircraft. The first three are speeds or heights no friendly or civil aircraft here flies, so a silent track flying one of them is "suspect" after one check instead of "unknown".

**Civil corridors.** Two fictional lanes, 10 km wide and 8 to 13 km up, pass 18 km north and 22 km south-west of the battery, clear of every defended asset. A track inside a lane, within 30° of its direction and flying like an airliner, is assumed civil: an airliner whose code was not received stays "unknown" instead of turning hostile. The rule has a price: a hostile flying exactly like an airliner along the lane would stay unknown too. Its course is still evaluated, and under weapons FREE an unknown track that threatens an asset can still be engaged.

**The symbols.** Each identity has a colour and a shape, like the frames on military situation maps: a diamond for hostile (red) and suspect (orange, dashed), a four-lobed quatrefoil for unknown (yellow) and identifying (yellow, dashed), a circle for friend (blue) and a square for civil (green).
