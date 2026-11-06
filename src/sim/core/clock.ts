/** The simulation advances 50 times per second: one tick is 20 ms of simulated time. */
export const TICK_HZ = 50;
export const TICK_S = 1 / TICK_HZ;

/**
 * Turns irregular frame times into a whole number of fixed ticks (the "fixed time step").
 *
 * The real elapsed time is passed in by the app's render loop; this class never reads a clock,
 * so it stays deterministic and testable. Leftover time is carried to the next frame and also
 * gives the renderer an interpolation factor for smooth motion between ticks.
 */
export class FixedStepClock {
  private accumulatorS = 0;
  private readonly maxFrameS: number;

  /**
   * @param maxFrameS Longest real-time gap processed in one frame. After a stall (for example a
   *   background tab), the simulation slows down briefly instead of freezing while it catches up.
   */
  constructor(maxFrameS = 0.25) {
    this.maxFrameS = maxFrameS;
  }

  /** Adds `elapsedRealS` of real time played at `speed`× and returns how many ticks to run now. */
  advance(elapsedRealS: number, speed: number): number {
    const realS = Math.min(Math.max(0, elapsedRealS), this.maxFrameS);
    this.accumulatorS += realS * Math.max(0, speed);
    const ticks = Math.floor(this.accumulatorS / TICK_S + 1e-9);
    this.accumulatorS = Math.max(0, this.accumulatorS - ticks * TICK_S);
    return ticks;
  }

  /** Progress from the last tick toward the next one, from 0 to 1. */
  get alpha(): number {
    return Math.min(1, this.accumulatorS / TICK_S);
  }

  reset(): void {
    this.accumulatorS = 0;
  }
}
