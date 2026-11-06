import { FixedStepClock, Simulation, TICK_S, type SimEvent, type Snapshot } from '../../sim';
import { describeEvent, describeNow, nearestRecentEcho } from './narrator';
import { SPEED_PRESETS, type LaunchOptions } from './params';
import { createSimStore, type LogEntry, type SimStore, type SimUiState } from './store';

/** What the renderer needs each frame: the last two ticks and how far we are between them. */
export interface RenderFrame {
  previous: Snapshot;
  current: Snapshot;
  /** 0 = show `previous`, 1 = show `current`. */
  alpha: number;
}

type FrameListener = (frame: RenderFrame) => void;

const LOG_LIMIT = 100;
const PUBLISH_INTERVAL_MS = 100;

/**
 * Drives the simulation in real time. Each animation frame it converts the elapsed wall-clock
 * time (times the playback speed) into whole 20 ms ticks, so the simulation itself never sees
 * the frame rate. This is the only place where real time meets simulated time.
 */
export class SimController {
  readonly store: SimStore;
  private sim: Simulation;
  private readonly clock = new FixedStepClock();
  private previous: Snapshot;
  private current: Snapshot;
  private running: boolean;
  private speed: number;
  private log: LogEntry[] = [];
  private logSeq = 0;
  private rafId: number | null = null;
  private lastFrameMs: number | null = null;
  private lastPublishMs = Number.NEGATIVE_INFINITY;
  private readonly listeners = new Set<FrameListener>();

  constructor(options: LaunchOptions) {
    this.speed = options.speed;
    this.running = !options.paused;
    this.sim = new Simulation({ seed: options.seed });
    this.current = this.sim.snapshot();
    this.previous = this.current;
    if (options.startAtS > 0) this.advance(Math.round(options.startAtS / TICK_S));
    this.store = createSimStore(this.uiState());
  }

  start(): void {
    if (this.rafId !== null) return;
    this.lastFrameMs = null;
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  play(): void {
    if (this.running) return;
    this.running = true;
    this.clock.reset();
    this.publish();
  }

  pause(): void {
    if (!this.running) return;
    this.running = false;
    this.previous = this.current;
    this.publish();
    this.emitFrame();
  }

  toggle(): void {
    if (this.running) this.pause();
    else this.play();
  }

  /** Pauses, then advances exactly `ticks` ticks (50 ticks = one simulated second). */
  step(ticks = 1): void {
    if (this.running) this.pause();
    this.advance(ticks);
    this.previous = this.current;
    this.publish();
    this.emitFrame();
  }

  setSpeed(speed: number): void {
    if (!SPEED_PRESETS.includes(speed) || speed === this.speed) return;
    this.speed = speed;
    this.publish();
  }

  faster(): void {
    const next = SPEED_PRESETS[SPEED_PRESETS.indexOf(this.speed) + 1];
    if (next !== undefined) this.setSpeed(next);
  }

  slower(): void {
    const next = SPEED_PRESETS[SPEED_PRESETS.indexOf(this.speed) - 1];
    if (next !== undefined) this.setSpeed(next);
  }

  /** Starts the run over. With the same seed, everything happens again exactly the same way. */
  restart(seed = this.sim.seed): void {
    this.sim = new Simulation({ seed });
    this.clock.reset();
    this.log = [];
    this.logSeq = 0;
    this.current = this.sim.snapshot();
    this.previous = this.current;
    this.publish();
    this.emitFrame();
  }

  /** Starts a different run: new random seed (randomness here is fine, it is outside the sim). */
  newSeed(): void {
    this.restart(Math.floor(Math.random() * 1_000_000));
  }

  getFrame(): RenderFrame {
    return {
      previous: this.previous,
      current: this.current,
      alpha: this.running ? this.clock.alpha : 1,
    };
  }

  /** Calls `listener` after every frame (and once right away). Returns an unsubscribe function. */
  onFrame(listener: FrameListener): () => void {
    this.listeners.add(listener);
    listener(this.getFrame());
    return () => this.listeners.delete(listener);
  }

  private loop = (nowMs: number): void => {
    const elapsedS = this.lastFrameMs === null ? 0 : (nowMs - this.lastFrameMs) / 1000;
    this.lastFrameMs = nowMs;
    if (this.running) {
      const ticks = this.clock.advance(elapsedS, this.speed);
      if (ticks > 0) this.advance(ticks);
    }
    this.emitFrame();
    if (nowMs - this.lastPublishMs >= PUBLISH_INTERVAL_MS) this.publish(nowMs);
    this.rafId = requestAnimationFrame(this.loop);
  };

  private advance(ticks: number): void {
    const events: SimEvent[] = [];
    for (let i = 0; i < ticks; i++) {
      if (i === ticks - 1) this.previous = this.sim.snapshot();
      events.push(...this.sim.step());
    }
    this.current = this.sim.snapshot();
    this.record(events);
  }

  private record(events: readonly SimEvent[]): void {
    for (const event of events) {
      this.log.unshift({ id: ++this.logSeq, timeS: event.timeS, ...describeEvent(event) });
    }
    if (this.log.length > LOG_LIMIT) this.log.length = LOG_LIMIT;
  }

  private emitFrame(): void {
    const frame = this.getFrame();
    for (const listener of this.listeners) listener(frame);
  }

  private uiState(): SimUiState {
    const { tick, timeS, contactsHeld, radar } = this.current;
    return {
      running: this.running,
      speed: this.speed,
      seed: this.sim.seed,
      tick,
      timeS,
      contactsHeld,
      now: describeNow({
        running: this.running,
        tick,
        timeS,
        periodS: radar.periodS,
        contactsHeld,
        nearest: nearestRecentEcho(this.current),
      }),
      log: [...this.log],
    };
  }

  private publish(nowMs = performance.now()): void {
    this.lastPublishMs = nowMs;
    this.store.setState(this.uiState());
  }
}
