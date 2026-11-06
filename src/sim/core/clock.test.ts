import { describe, expect, it } from 'vitest';
import { FixedStepClock, TICK_S } from './clock';

describe('FixedStepClock (fixed time step)', () => {
  it('uses 20 ms ticks', () => {
    expect(TICK_S).toBeCloseTo(0.02);
  });

  it('turns one second of 60 fps frames into exactly 50 ticks', () => {
    const clock = new FixedStepClock();
    let ticks = 0;
    for (let i = 0; i < 60; i++) ticks += clock.advance(1 / 60, 1);
    expect(ticks).toBe(50);
  });

  it('runs proportionally more ticks at higher speed', () => {
    const clock = new FixedStepClock();
    let ticks = 0;
    for (let i = 0; i < 60; i++) ticks += clock.advance(1 / 60, 4);
    expect(ticks).toBe(200);
  });

  it('carries leftover time to the next frame and exposes it for interpolation', () => {
    const clock = new FixedStepClock();
    expect(clock.advance(0.03, 1)).toBe(1); // 30 ms: one tick, 10 ms left over
    expect(clock.alpha).toBeCloseTo(0.5);
    expect(clock.advance(0.01, 1)).toBe(1); // 10 + 10 ms: one more tick
    expect(clock.alpha).toBeCloseTo(0);
  });

  it('caps catch-up after a long stall instead of freezing', () => {
    const clock = new FixedStepClock(0.25);
    expect(clock.advance(5, 1)).toBe(12); // only 0.25 s of the 5 s gap is processed
  });

  it('does nothing at zero speed or with negative elapsed time', () => {
    const clock = new FixedStepClock();
    expect(clock.advance(1, 0)).toBe(0);
    expect(clock.advance(-1, 1)).toBe(0);
  });
});
