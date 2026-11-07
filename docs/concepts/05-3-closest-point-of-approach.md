### Closest point of approach — how the battery decides what is a threat

A hostile aircraft is only a threat if its course will bring it close to something the battery defends. Projecting its track straight ahead gives the moment it will be closest to each defended asset, and how close: the closest point of approach (CPA). If that distance falls inside an asset's threat ring, and the moment is still ahead, the track is a threat, and threats are ranked by how soon they arrive.

- **Formula:** `t_cpa = −(r · v) / |v|²` and `d_cpa = |r + v · t_cpa|`, with `r` the track's position relative to the asset and `v` its velocity
- **Example:** a target 20 km east and 10 km south of the town, flying north-west at 280 m/s, is closest to the town in about 75 s, at 7 km: outside the town's 2.5 km ring, so not a threat to it. Turn it 20° toward the town and it becomes one.
- **See it:** select a hostile track: the inspector's "Why?" names the asset it threatens, how close it will pass and when. The header's "Next impact" counts down to the most urgent one.

<!-- more -->

## Going deeper

**Where the formula comes from.** Along a straight course the position relative to the asset is `r + v·t`. Its squared length is smallest where its derivative `2 v · (r + v·t)` is zero, which gives `t_cpa`. A negative `t_cpa` means the closest point is already behind: the aircraft is flying away.

**The defended assets.** The battery itself (threat ring 5 km, a hostile within 2 km has got through), a town 7.6 km west-north-west (2.5 km and 1.5 km) and a power plant 6.7 km south-east (1.5 km and 0.8 km). Scenario hostiles head for one of the three at random.

**Perception, not truth.** The CPA uses the track's filtered position and velocity, so a noisy track can look like a threat and then stop being one, or the other way round. Far out, a heading error of a few degrees moves the CPA by kilometres; that is why the Kalman filter matters for the decision, not only for the display.
