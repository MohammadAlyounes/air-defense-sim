### Detection probability — why the radar sometimes misses, and sometimes sees ghosts

A radar decides "target or not" by checking whether the echo rises above a threshold set over the receiver's noise. A real target's echo flickers from scan to scan as it turns, so near its maximum range it is only seen on some looks. Set the threshold lower and you see more, but random noise also crosses it more often: those are false alarms.

- **Formula:** `Pd = Pfa^(1 / (1 + SNR))` for a flickering (Swerling 1) target, with `SNR ∝ σ / R⁴`
- **Example:** with a false-alarm chance Pfa = 10⁻⁶ per cell, a drone at its 9.5 km "50% range" is seen on half the looks, and on 85% of them at 6.6 km. Over 600,000 cells per turn, about 0.6 false alarms appear each turn.
- **See it:** watch for lone blips that appear once and vanish: the log calls them "dropped", because a second echo never came to confirm them.

<!-- more -->

## Going deeper

**The two numbers that set the trade-off.** The probability of false alarm (Pfa) is the chance that noise alone crosses the threshold in one range-and-bearing cell. The signal-to-noise ratio (SNR) is how much stronger the echo is than the noise; from the radar equation it grows with the radar cross section `σ` and falls with `R⁴`. For a target whose echo fluctuates randomly (the Swerling 1 model), the detection probability is `Pd = Pfa^(1/(1+SNR))`, so Pd = 50% needs an SNR of about 19 (12.8 dB) when Pfa = 10⁻⁶.

**Measurement noise.** Every echo is measured with small random errors: 30 m in range, 0.15° in bearing and 0.25° in elevation (one standard deviation). A 0.15° error is 80 m sideways at 30 km, which is why the blips jitter and why velocities estimated from two echoes are rough. Step 5 smooths them with a Kalman filter.

**How false alarms are filtered.** A single echo only starts a tentative track. It is confirmed when the next look brings a second echo; otherwise it is dropped. Noise rarely strikes twice in the same place, so false alarms almost never become tracks, and they are never engaged.
