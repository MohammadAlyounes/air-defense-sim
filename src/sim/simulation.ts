import { TICK_S } from './core/clock';
import { fnv1a } from './core/hash';
import { Rng } from './core/rng';
import { add, bearing, groundRange, headingVector, scale, vec3, type Vec3 } from './core/vec';
import { antennaAzimuth, DEFAULT_SEARCH_RADAR, sweptOver, type SearchRadarConfig } from './radar';
import {
  DEFAULT_AUTO_TRAFFIC,
  nextArrivalTick,
  planFlight,
  type AutoTrafficConfig,
} from './scenario';
import { TRAFFIC, type AircraftType } from './traffic';
import type { Aircraft, Command, Plot, RecordedCommand, SimEvent, Snapshot } from './types';

export interface SimConfig {
  seed: number;
  radar?: Partial<SearchRadarConfig>;
  /** Aircraft farther than this from the battery, and flying away, leave the simulation. */
  areaRadiusM?: number;
  /** Scenario traffic that arrives on its own; `false` for an empty sky (tests, sandbox). */
  autoTraffic?: Partial<AutoTrafficConfig> | false;
}

/** Radar plots kept for the fading phosphor trail, in antenna turns. */
const PLOT_HISTORY_TURNS = 3;
/** A contact is reported lost after this many antenna turns without a paint. */
const LOSE_AFTER_TURNS = 2;
/** Spread of a drone swarm around its leader, metres. */
const SWARM_SPREAD_M = 700;
/** Trail history: one position every 0.5 s, the last 30 s. */
const TRAIL_EVERY_TICKS = 25;
const TRAIL_LENGTH = 60;

/**
 * The simulation engine. Pure and deterministic: the same seed and the same commands at the
 * same ticks always produce exactly the same run. It never reads a clock; the app decides how
 * often to call `step()`.
 */
export class Simulation {
  readonly seed: number;
  private readonly rng: Rng;
  private readonly radar: SearchRadarConfig;
  private readonly areaRadiusM: number;
  private readonly traffic: AutoTrafficConfig | null;
  private tickCount = 0;
  private nextId = 1;
  private nextArrival: number | null = null;
  private aircraft: Aircraft[] = [];
  private plots: Plot[] = [];
  private queued: Command[] = [];
  private readonly log: RecordedCommand[] = [];
  private startupEvents: SimEvent[] = [];

  constructor(config: SimConfig) {
    this.seed = config.seed >>> 0;
    this.rng = new Rng(this.seed);
    this.radar = { ...DEFAULT_SEARCH_RADAR, ...config.radar };
    this.areaRadiusM = config.areaRadiusM ?? this.radar.rangeM + 2_000;
    this.traffic =
      config.autoTraffic === false ? null : { ...DEFAULT_AUTO_TRAFFIC, ...config.autoTraffic };

    if (this.traffic) {
      for (let i = 0; i < this.traffic.initialCount; i++) {
        const flight = planFlight(this.rng, this.traffic, true);
        this.addAircraft(flight.type, flight.position, flight.velocity, this.startupEvents);
      }
      this.nextArrival = nextArrivalTick(this.rng, this.traffic, 0);
    }
  }

  /** Rebuilds a run from its seed and command log, up to `untilTick`. */
  static replay(config: SimConfig, log: readonly RecordedCommand[], untilTick: number): Simulation {
    const sim = new Simulation(config);
    let next = 0;
    while (sim.tick < untilTick) {
      const upcoming = sim.tick + 1;
      for (let entry = log[next]; entry && entry.tick === upcoming; entry = log[++next]) {
        sim.dispatch(entry.command);
      }
      sim.step();
    }
    return sim;
  }

  get tick(): number {
    return this.tickCount;
  }

  get timeS(): number {
    return this.tickCount * TICK_S;
  }

  /** Queues a command; it takes effect at the start of the next tick and is logged for replay. */
  dispatch(command: Command): void {
    this.queued.push(command);
  }

  /** Advances the simulation by one fixed 20 ms tick and returns what happened. */
  step(): SimEvent[] {
    const events = this.startupEvents;
    this.startupEvents = [];
    this.tickCount += 1;
    const tick = this.tickCount;

    for (const command of this.queued) {
      this.log.push({ tick, command });
      this.apply(command, events);
    }
    this.queued = [];

    this.scenarioArrivals(tick, events);

    // Constant velocity, so one Euler step per tick is exact: p(t + Δt) = p(t) + v·Δt.
    const sampleTrail = tick % TRAIL_EVERY_TICKS === 0;
    this.aircraft = this.aircraft.map((a) => {
      const position = add(a.position, scale(a.velocity, TICK_S));
      return {
        ...a,
        position,
        trail: sampleTrail ? [...a.trail.slice(1 - TRAIL_LENGTH), position] : a.trail,
      };
    });

    this.sweep(tick, events);
    this.dropStaleContacts(tick, events);
    this.removeDeparted(tick, events);

    const keepAfter = tick - Math.round((PLOT_HISTORY_TURNS * this.radar.periodS) / TICK_S);
    this.plots = this.plots.filter((plot) => plot.tick > keepAfter);
    return events;
  }

  /** Runs `ticks` ticks and returns all their events in order. */
  run(ticks: number): SimEvent[] {
    const events: SimEvent[] = [];
    for (let i = 0; i < ticks; i++) events.push(...this.step());
    return events;
  }

  snapshot(): Snapshot {
    const timeS = this.timeS;
    return {
      tick: this.tickCount,
      timeS,
      seed: this.seed,
      radar: {
        azimuthRad: antennaAzimuth(timeS, this.radar.periodS),
        periodS: this.radar.periodS,
        rangeM: this.radar.rangeM,
      },
      aircraft: [...this.aircraft],
      plots: [...this.plots],
      contactsHeld: this.aircraft.filter((a) => a.contactHeld).length,
    };
  }

  /** Fingerprint of the complete state: equal hashes mean identical runs. */
  stateHash(): string {
    return fnv1a(
      JSON.stringify({
        tick: this.tickCount,
        rng: this.rng.state(),
        nextId: this.nextId,
        nextArrival: this.nextArrival,
        aircraft: this.aircraft,
        plots: this.plots,
      }),
    );
  }

  commandLog(): readonly RecordedCommand[] {
    return [...this.log];
  }

  private apply(command: Command, events: SimEvent[]): void {
    switch (command.kind) {
      case 'spawnTraffic': {
        const performance = TRAFFIC[command.type];
        const type: AircraftType = command.type === 'swarm' ? 'drone' : command.type;
        const centre = vec3(
          command.eastM,
          command.northM,
          command.altitudeM ?? performance.altitudeM,
        );
        const velocity = scale(headingVector(command.headingRad), performance.speedMps);
        for (let i = 0; i < performance.count; i++) {
          const offset =
            i === 0
              ? vec3(0, 0, 0)
              : vec3(
                  this.rng.range(-SWARM_SPREAD_M, SWARM_SPREAD_M),
                  this.rng.range(-SWARM_SPREAD_M, SWARM_SPREAD_M),
                  this.rng.range(-50, 50),
                );
          this.addAircraft(type, add(centre, offset), velocity, events);
        }
        break;
      }
      case 'removeAircraft':
        this.aircraft = this.aircraft.filter((a) => a.id !== command.id);
        break;
    }
  }

  private scenarioArrivals(tick: number, events: SimEvent[]): void {
    if (!this.traffic || this.nextArrival === null || tick < this.nextArrival) return;
    if (this.aircraft.length < this.traffic.maxAircraft) {
      const flight = planFlight(this.rng, this.traffic, false);
      this.addAircraft(flight.type, flight.position, flight.velocity, events);
    }
    this.nextArrival = nextArrivalTick(this.rng, this.traffic, tick);
  }

  /** Paints every aircraft in range that the beam swept past during this tick. */
  private sweep(tick: number, events: SimEvent[]): void {
    const from = antennaAzimuth((tick - 1) * TICK_S, this.radar.periodS);
    const to = antennaAzimuth(tick * TICK_S, this.radar.periodS);
    const timeS = tick * TICK_S;
    this.aircraft = this.aircraft.map((a) => {
      const rangeM = groundRange(a.position);
      if (rangeM < 1 || rangeM > this.radar.rangeM) return a;
      const bearingRad = bearing(a.position);
      if (!sweptOver(from, to, bearingRad)) return a;

      this.plots.push({
        tick,
        timeS,
        position: a.position,
        bearingRad,
        rangeM,
        radarSize: a.radarSize,
        truthId: a.id,
      });
      if (!a.contactHeld) {
        events.push({ kind: 'contactNew', tick, timeS, id: a.id, bearingRad, rangeM });
      }
      return { ...a, contactHeld: true, lastPaint: { tick, bearingRad, rangeM } };
    });
  }

  private dropStaleContacts(tick: number, events: SimEvent[]): void {
    const loseAfterTicks = Math.round((LOSE_AFTER_TURNS * this.radar.periodS) / TICK_S);
    this.aircraft = this.aircraft.map((a) => {
      if (!a.contactHeld || !a.lastPaint || tick - a.lastPaint.tick <= loseAfterTicks) return a;
      events.push(this.lostEvent(a, tick));
      return { ...a, contactHeld: false };
    });
  }

  private removeDeparted(tick: number, events: SimEvent[]): void {
    const staying: Aircraft[] = [];
    for (const a of this.aircraft) {
      const flyingAway = a.position.x * a.velocity.x + a.position.y * a.velocity.y > 0;
      if (flyingAway && groundRange(a.position) > this.areaRadiusM) {
        if (a.contactHeld) events.push(this.lostEvent(a, tick));
        events.push({ kind: 'trafficLeft', tick, timeS: tick * TICK_S, id: a.id, type: a.type });
      } else {
        staying.push(a);
      }
    }
    this.aircraft = staying;
  }

  private lostEvent(a: Aircraft, tick: number): SimEvent {
    return {
      kind: 'contactLost',
      tick,
      timeS: tick * TICK_S,
      id: a.id,
      bearingRad: a.lastPaint?.bearingRad ?? bearing(a.position),
      rangeM: a.lastPaint?.rangeM ?? groundRange(a.position),
    };
  }

  private addAircraft(
    type: AircraftType,
    position: Vec3,
    velocity: Vec3,
    events: SimEvent[],
  ): void {
    const performance = TRAFFIC[type];
    const aircraft: Aircraft = {
      id: this.nextId++,
      type,
      affiliation: performance.affiliation,
      radarSize: performance.radarSize,
      position,
      velocity,
      spawnTick: this.tickCount,
      contactHeld: false,
      lastPaint: null,
      trail: [position],
    };
    this.aircraft.push(aircraft);
    events.push({
      kind: 'trafficEntered',
      tick: this.tickCount,
      timeS: this.tickCount * TICK_S,
      id: aircraft.id,
      type,
      bearingRad: bearing(position),
      rangeM: groundRange(position),
    });
  }
}
