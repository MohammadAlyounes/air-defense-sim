import {
  closestApproachToOrigin,
  DEFAULT_DEFENSE,
  iffAnswer,
  LAUNCHER_POSITION,
  planIntercept,
  type DefenseConfig,
} from './c2';
import { TICK_S } from './core/clock';
import { fnv1a } from './core/hash';
import { Rng } from './core/rng';
import {
  add,
  bearing,
  distance,
  groundRange,
  headingVector,
  length,
  scale,
  sub,
  vec3,
  type Vec3,
} from './core/vec';
import {
  closestApproach,
  DEFAULT_INTERCEPTOR,
  launchVelocity,
  stepMissile,
  type InterceptorConfig,
  type MissileState,
} from './interceptor';
import {
  antennaAzimuth,
  DEFAULT_SEARCH_RADAR,
  detectionRangeM,
  sweptOver,
  type SearchRadarConfig,
} from './radar';
import {
  DEFAULT_AUTO_TRAFFIC,
  nextArrivalTick,
  planFlight,
  type AutoTrafficConfig,
} from './scenario';
import { trackPositionAt } from './tracker';
import { RADAR_CROSS_SECTION_M2, TRAFFIC, type AircraftType } from './traffic';
import type {
  Aircraft,
  Command,
  DefenseStats,
  Effect,
  Engagement,
  Interceptor,
  LauncherState,
  MissReason,
  Plot,
  RecordedCommand,
  SimEvent,
  Snapshot,
  Track,
} from './types';

export interface SimConfig {
  seed: number;
  radar?: Partial<SearchRadarConfig>;
  /** Aircraft farther than this from the battery, and flying away, leave the simulation. */
  areaRadiusM?: number;
  /** Scenario traffic that arrives on its own; `false` for an empty sky (tests, sandbox). */
  autoTraffic?: Partial<AutoTrafficConfig> | false;
  defense?: Partial<DefenseConfig>;
  interceptor?: Partial<InterceptorConfig>;
}

/** Radar plots kept for the fading phosphor trail, in antenna turns. */
const PLOT_HISTORY_TURNS = 3;
/** A track is dropped after this many antenna turns without an echo. */
const LOSE_AFTER_TURNS = 2;
/** Spread of a drone swarm around its leader, metres. */
const SWARM_SPREAD_M = 700;
/** Aircraft trails: one position every 0.5 s, the last 30 s. */
const TRAIL_EVERY_TICKS = 25;
const TRAIL_LENGTH = 60;
/** Interceptors move in 2 ms sub-steps, so a fast closing pair cannot skip past each other. */
const SUBSTEPS = 10;
/** Interceptor trails: one position every 0.1 s, the last 6 s. */
const MISSILE_TRAIL_EVERY_TICKS = 5;
const MISSILE_TRAIL_LENGTH = 60;
/** Launch, intercept, miss and leak markers stay in snapshots for 4 s. */
const EFFECT_TICKS = 200;

const ticks = (seconds: number) => Math.round(seconds / TICK_S);

/**
 * The simulation engine. Pure and deterministic: the same seed and the same commands at the
 * same ticks always produce exactly the same run. It never reads a clock; the app decides how
 * often to call `step()`.
 *
 * Each tick runs the defense loop in order: interceptors fly, aircraft move, the radar sweeps,
 * tracks update, then the command node identifies, evaluates, assigns and launches.
 */
export class Simulation {
  readonly seed: number;
  private readonly rng: Rng;
  private readonly radar: SearchRadarConfig;
  private readonly defense: DefenseConfig;
  private readonly interceptorConfig: InterceptorConfig;
  private readonly areaRadiusM: number;
  private readonly traffic: AutoTrafficConfig | null;
  private tickCount = 0;
  private nextId = 1;
  private nextTrackId = 1;
  private nextInterceptorId = 1;
  private nextEngagementId = 1;
  private nextArrival: number | null = null;
  private aircraft: Aircraft[] = [];
  private plots: Plot[] = [];
  private tracks: Track[] = [];
  private interceptors: Interceptor[] = [];
  private engagements: Engagement[] = [];
  private launcher: LauncherState;
  private effects: Effect[] = [];
  private stats: DefenseStats = {
    threatsDown: 0,
    threatsLeaked: 0,
    interceptorsFired: 0,
    hits: 0,
    misses: 0,
  };
  private queued: Command[] = [];
  private readonly log: RecordedCommand[] = [];
  private startupEvents: SimEvent[] = [];

  constructor(config: SimConfig) {
    this.seed = config.seed >>> 0;
    this.rng = new Rng(this.seed);
    this.radar = { ...DEFAULT_SEARCH_RADAR, ...config.radar };
    this.defense = { ...DEFAULT_DEFENSE, ...config.defense };
    this.interceptorConfig = { ...DEFAULT_INTERCEPTOR, ...config.interceptor };
    this.areaRadiusM = config.areaRadiusM ?? this.radar.rangeM + 2_000;
    this.traffic =
      config.autoTraffic === false ? null : { ...DEFAULT_AUTO_TRAFFIC, ...config.autoTraffic };
    this.launcher = {
      ready: this.defense.launcherCapacity,
      capacity: this.defense.launcherCapacity,
      nextLaunchTick: 0,
      nextReloadTick: null,
    };

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
    // Interceptors fly first, against the targets' positions at the start of the tick.
    this.flyInterceptors(tick, events);
    this.moveAircraft(tick);
    const plots = this.sweep(tick);
    this.updateTracks(tick, plots, events);
    this.identify(tick, events);
    this.evaluateThreats(tick, events);
    this.assignAndLaunch(tick, events);
    this.reload(tick);
    this.checkLeaks(tick, events);
    this.removeDeparted(tick, events);

    const keepAfter = tick - ticks(PLOT_HISTORY_TURNS * this.radar.periodS);
    this.plots = this.plots.filter((plot) => plot.tick > keepAfter);
    this.effects = this.effects.filter((effect) => effect.tick > tick - EFFECT_TICKS);
    return events;
  }

  /** Runs `ticks` ticks and returns all their events in order. */
  run(count: number): SimEvent[] {
    const events: SimEvent[] = [];
    for (let i = 0; i < count; i++) events.push(...this.step());
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
        referenceRangeM: this.radar.referenceRangeM,
      },
      aircraft: [...this.aircraft],
      plots: [...this.plots],
      contactsHeld: this.tracks.length,
      tracks: [...this.tracks],
      interceptors: [...this.interceptors],
      engagements: [...this.engagements],
      launcher: { ...this.launcher },
      effects: [...this.effects],
      stats: { ...this.stats },
    };
  }

  /** Fingerprint of the complete state: equal hashes mean identical runs. */
  stateHash(): string {
    return fnv1a(
      JSON.stringify({
        tick: this.tickCount,
        rng: this.rng.state(),
        nextId: this.nextId,
        nextTrackId: this.nextTrackId,
        nextInterceptorId: this.nextInterceptorId,
        nextEngagementId: this.nextEngagementId,
        nextArrival: this.nextArrival,
        aircraft: this.aircraft,
        plots: this.plots,
        tracks: this.tracks,
        interceptors: this.interceptors,
        engagements: this.engagements,
        launcher: this.launcher,
        effects: this.effects,
        stats: this.stats,
      }),
    );
  }

  commandLog(): readonly RecordedCommand[] {
    return [...this.log];
  }

  // ── Commands and traffic ────────────────────────────────────────────────────────────────

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

  /** Constant velocity, so one Euler step per tick is exact: p(t + Δt) = p(t) + v·Δt. */
  private moveAircraft(tick: number): void {
    const sampleTrail = tick % TRAIL_EVERY_TICKS === 0;
    this.aircraft = this.aircraft.map((a) => {
      const position = add(a.position, scale(a.velocity, TICK_S));
      return {
        ...a,
        position,
        trail: sampleTrail ? [...a.trail.slice(1 - TRAIL_LENGTH), position] : a.trail,
      };
    });
  }

  private checkLeaks(tick: number, events: SimEvent[]): void {
    this.aircraft = this.aircraft.map((a) => {
      if (a.leaked || a.affiliation !== 'hostile') return a;
      if (groundRange(a.position) >= this.defense.leakRadiusM) return a;
      this.stats.threatsLeaked += 1;
      this.effects.push({ kind: 'leak', tick, position: a.position });
      events.push({ kind: 'threatLeaked', tick, timeS: tick * TICK_S, id: a.id, type: a.type });
      return { ...a, leaked: true };
    });
  }

  private removeDeparted(tick: number, events: SimEvent[]): void {
    const staying: Aircraft[] = [];
    for (const a of this.aircraft) {
      const flyingAway = a.position.x * a.velocity.x + a.position.y * a.velocity.y > 0;
      if (flyingAway && groundRange(a.position) > this.areaRadiusM) {
        events.push({ kind: 'trafficLeft', tick, timeS: tick * TICK_S, id: a.id, type: a.type });
      } else {
        staying.push(a);
      }
    }
    this.aircraft = staying;
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
      lastPaint: null,
      trail: [position],
      leaked: false,
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

  // ── Detect: the search radar ────────────────────────────────────────────────────────────

  /**
   * Paints every aircraft the beam swept past during this tick, if its echo is strong enough:
   * a target is detected out to `detectionRangeM` of its radar cross section.
   */
  private sweep(tick: number): Plot[] {
    const from = antennaAzimuth((tick - 1) * TICK_S, this.radar.periodS);
    const to = antennaAzimuth(tick * TICK_S, this.radar.periodS);
    const timeS = tick * TICK_S;
    const painted: Plot[] = [];
    this.aircraft = this.aircraft.map((a) => {
      const rangeM = groundRange(a.position);
      const maxRangeM = detectionRangeM(RADAR_CROSS_SECTION_M2[a.radarSize], this.radar);
      if (rangeM < 1 || rangeM > maxRangeM) return a;
      const bearingRad = bearing(a.position);
      if (!sweptOver(from, to, bearingRad)) return a;
      const plot: Plot = {
        tick,
        timeS,
        position: a.position,
        bearingRad,
        rangeM,
        radarSize: a.radarSize,
        truthId: a.id,
      };
      painted.push(plot);
      return { ...a, lastPaint: { tick, bearingRad, rangeM } };
    });
    this.plots.push(...painted);
    return painted;
  }

  // ── Track ───────────────────────────────────────────────────────────────────────────────

  private updateTracks(tick: number, plots: readonly Plot[], events: SimEvent[]): void {
    const timeS = tick * TICK_S;
    const painted = new Set<number>();

    for (const plot of plots) {
      const index = this.tracks.findIndex((t) => t.truthId === plot.truthId);
      const track = this.tracks[index];
      if (!track) {
        const created: Track = {
          id: this.nextTrackId++,
          truthId: plot.truthId,
          createdTick: tick,
          detectedRangeM: plot.rangeM,
          paints: 1,
          lastPaintTick: tick,
          position: plot.position,
          velocity: null,
          confirmedTick: null,
          identity: 'pending',
          threat: null,
          engagementId: null,
          interceptorsFired: 0,
        };
        this.tracks.push(created);
        painted.add(created.id);
        events.push({
          kind: 'contactNew',
          tick,
          timeS,
          id: plot.truthId,
          trackId: created.id,
          bearingRad: plot.bearingRad,
          rangeM: plot.rangeM,
        });
        continue;
      }

      // Velocity from the last two echoes (exact while measurements are perfect; Step 6 adds
      // noise and a Kalman filter).
      const gapS = (tick - track.lastPaintTick) * TICK_S;
      const updated: Track = {
        ...track,
        paints: track.paints + 1,
        lastPaintTick: tick,
        position: plot.position,
        velocity: gapS > 0 ? scale(sub(plot.position, track.position), 1 / gapS) : track.velocity,
        confirmedTick: track.confirmedTick ?? tick,
      };
      if (track.confirmedTick === null && updated.velocity) {
        events.push({
          kind: 'trackConfirmed',
          tick,
          timeS,
          id: track.truthId,
          trackId: track.id,
          speedMps: length(updated.velocity),
          altitudeM: plot.position.z,
        });
      }
      // Assess: the radar sees the target again, so the last shot missed.
      const engagement = this.findEngagement(track.engagementId);
      if (engagement?.state === 'missed') {
        this.engagements = this.engagements.filter((e) => e.id !== engagement.id);
        updated.engagementId = null;
        events.push({ kind: 'targetSurvived', tick, timeS, id: track.truthId, trackId: track.id });
      }
      this.tracks[index] = updated;
      painted.add(track.id);
    }

    // Tracks the beam swept over without an echo: confirm kills, drop stale tracks.
    const from = antennaAzimuth((tick - 1) * TICK_S, this.radar.periodS);
    const to = antennaAzimuth(tick * TICK_S, this.radar.periodS);
    const loseAfter = ticks(LOSE_AFTER_TURNS * this.radar.periodS);
    const kept: Track[] = [];
    for (const track of this.tracks) {
      if (painted.has(track.id)) {
        kept.push(track);
        continue;
      }
      const engagement = this.findEngagement(track.engagementId);
      const swept = sweptOver(from, to, bearing(trackPositionAt(track, tick)));
      if (swept && engagement?.state === 'hit') {
        this.assessKill(track, engagement, tick, events);
        continue;
      }
      // The engagement radar keeps a target it is guiding an interceptor to.
      const guiding = engagement?.state === 'flying';
      if (!guiding && tick - track.lastPaintTick > loseAfter) {
        if (engagement) this.engagements = this.engagements.filter((e) => e !== engagement);
        const at = trackPositionAt(track, tick);
        events.push({
          kind: 'contactLost',
          tick,
          timeS,
          id: track.truthId,
          trackId: track.id,
          bearingRad: bearing(at),
          rangeM: groundRange(at),
        });
        continue;
      }
      kept.push(track);
    }
    this.tracks = kept;
  }

  /** The radar looked where the target should be and found nothing: the kill is confirmed. */
  private assessKill(track: Track, engagement: Engagement, tick: number, events: SimEvent[]) {
    if (track.identity === 'hostile') this.stats.threatsDown += 1;
    this.engagements = this.engagements.filter((e) => e.id !== engagement.id);
    events.push({
      kind: 'killAssessed',
      tick,
      timeS: tick * TICK_S,
      id: track.truthId,
      trackId: track.id,
      type: engagement.targetType,
      detectedRangeM: track.detectedRangeM,
      detectionToKillS: ((engagement.endTick ?? tick) - track.createdTick) * TICK_S,
      interceptorsFired: track.interceptorsFired,
    });
  }

  // ── Identify and evaluate ───────────────────────────────────────────────────────────────

  private identify(tick: number, events: SimEvent[]): void {
    const delay = ticks(this.defense.iffDelayS);
    this.tracks = this.tracks.map((track) => {
      if (track.identity !== 'pending' || track.confirmedTick === null) return track;
      if (tick - track.confirmedTick < delay) return track;
      const aircraft = this.aircraft.find((a) => a.id === track.truthId);
      if (!aircraft) return track;
      const identity = iffAnswer(aircraft.affiliation);
      events.push({
        kind: 'identified',
        tick,
        timeS: tick * TICK_S,
        id: track.truthId,
        trackId: track.id,
        identity,
      });
      return { ...track, identity };
    });
  }

  /** A hostile track whose course passes within the threat radius, still approaching, is a threat. */
  private evaluateThreats(tick: number, events: SimEvent[]): void {
    this.tracks = this.tracks.map((track) => {
      if (track.identity !== 'hostile' || !track.velocity) return track;
      const pass = closestApproachToOrigin(trackPositionAt(track, tick), track.velocity);
      const isThreat = pass.distanceM < this.defense.threatRadiusM && pass.timeS > 0;
      if (!isThreat) return track.threat ? { ...track, threat: null } : track;
      if (!track.threat) {
        events.push({
          kind: 'threatEvaluated',
          tick,
          timeS: tick * TICK_S,
          id: track.truthId,
          trackId: track.id,
          closestApproachM: pass.distanceM,
          timeToClosestS: pass.timeS,
        });
      }
      return {
        ...track,
        threat: { closestApproachM: pass.distanceM, timeToClosestS: pass.timeS },
      };
    });
  }

  // ── Assign and engage ───────────────────────────────────────────────────────────────────

  /**
   * Assign: the most urgent unengaged threat that an interceptor could reach gets the next
   * launch slot (at most one new assignment per tick). Engage: each assigned shot launches
   * when its slot comes, after the launch preparation time and the launch interval.
   */
  private assignAndLaunch(tick: number, events: SimEvent[]): void {
    for (const engagement of this.engagements) {
      if (engagement.state === 'assigned' && tick >= engagement.launchTick) {
        this.launch(engagement, tick, events);
      }
    }

    const queued = this.engagements.filter((e) => e.state === 'assigned');
    if (this.launcher.ready - queued.length <= 0) return;
    const slot = Math.max(
      tick + ticks(this.defense.launchPrepS),
      this.launcher.nextLaunchTick,
      ...queued.map((e) => e.launchTick + ticks(this.defense.launchIntervalS)),
    );
    const candidates = this.tracks
      .filter((t) => t.threat && t.engagementId === null)
      .sort(
        (a, b) =>
          (a.threat?.timeToClosestS ?? Infinity) - (b.threat?.timeToClosestS ?? Infinity) ||
          a.id - b.id,
      );
    for (const track of candidates) {
      const target = this.aircraft.find((a) => a.id === track.truthId);
      const plan = planIntercept(track, slot, this.defense, this.interceptorConfig);
      if (!target || !plan) continue;
      const id = this.nextEngagementId++;
      this.engagements.push({
        id,
        trackId: track.id,
        targetId: target.id,
        targetType: target.type,
        assignedTick: tick,
        launchTick: slot,
        interceptorId: null,
        state: 'assigned',
        predictedPoint: plan.point,
        predictedTimeS: plan.timeS,
        endTick: null,
        missDistanceM: null,
        missReason: null,
      });
      this.tracks = this.tracks.map((t) => (t.id === track.id ? { ...t, engagementId: id } : t));
      events.push({
        kind: 'engagementAssigned',
        tick,
        timeS: tick * TICK_S,
        id: target.id,
        trackId: track.id,
        launchInS: (slot - tick) * TICK_S,
        predictedTimeS: plan.timeS,
        predictedRangeM: groundRange(plan.point),
      });
      return;
    }
  }

  private launch(engagement: Engagement, tick: number, events: SimEvent[]): void {
    const track = this.tracks.find((t) => t.id === engagement.trackId);
    const target = this.aircraft.find((a) => a.id === engagement.targetId);
    const plan = track && planIntercept(track, tick, this.defense, this.interceptorConfig);
    if (!track || !target || !plan) {
      // The shot is no longer possible: cancel it, so the track can be assigned again.
      this.engagements = this.engagements.filter((e) => e.id !== engagement.id);
      this.tracks = this.tracks.map((t) =>
        t.id === engagement.trackId ? { ...t, engagementId: null } : t,
      );
      events.push({
        kind: 'engagementCancelled',
        tick,
        timeS: tick * TICK_S,
        id: engagement.targetId,
        trackId: engagement.trackId,
      });
      return;
    }

    const id = this.nextInterceptorId++;
    this.interceptors.push({
      id,
      engagementId: engagement.id,
      trackId: track.id,
      targetId: target.id,
      launchTick: tick,
      position: LAUNCHER_POSITION,
      velocity: launchVelocity(LAUNCHER_POSITION, plan.point, this.interceptorConfig),
      trail: [LAUNCHER_POSITION],
    });
    this.engagements = this.engagements.map((e) =>
      e.id === engagement.id
        ? {
            ...e,
            state: 'flying',
            launchTick: tick,
            interceptorId: id,
            predictedPoint: plan.point,
            predictedTimeS: plan.timeS,
          }
        : e,
    );
    this.tracks = this.tracks.map((t) =>
      t.id === track.id ? { ...t, interceptorsFired: t.interceptorsFired + 1 } : t,
    );
    this.launcher = {
      ...this.launcher,
      ready: this.launcher.ready - 1,
      nextLaunchTick: tick + ticks(this.defense.launchIntervalS),
      nextReloadTick: this.launcher.nextReloadTick ?? tick + ticks(this.defense.reloadS),
    };
    this.stats.interceptorsFired += 1;
    this.effects.push({ kind: 'launch', tick, position: LAUNCHER_POSITION });
    events.push({
      kind: 'interceptorLaunched',
      tick,
      timeS: tick * TICK_S,
      id: target.id,
      trackId: track.id,
      interceptorId: id,
      predictedTimeS: plan.timeS,
      predictedRangeM: groundRange(plan.point),
    });
  }

  private reload(tick: number): void {
    const { nextReloadTick, ready, capacity } = this.launcher;
    if (nextReloadTick === null || tick < nextReloadTick) return;
    const nowReady = ready + 1;
    this.launcher = {
      ...this.launcher,
      ready: nowReady,
      nextReloadTick: nowReady < capacity ? tick + ticks(this.defense.reloadS) : null,
    };
  }

  /**
   * Moves every interceptor through ten 2 ms sub-steps. In each, the target moves in a
   * straight line, and the closest approach between the two is found analytically: the fuze
   * goes off at the closest point, destroying the target if it is within the lethal radius.
   */
  private flyInterceptors(tick: number, events: SimEvent[]): void {
    const config = this.interceptorConfig;
    const dt = TICK_S / SUBSTEPS;
    const flying: Interceptor[] = [];

    for (const missile of this.interceptors) {
      const target = this.aircraft.find((a) => a.id === missile.targetId);
      let state: MissileState = { position: missile.position, velocity: missile.velocity };
      let outcome: {
        hit: boolean;
        missM: number | null;
        reason: MissReason | null;
        at: Vec3;
      } | null = target
        ? null
        : { hit: false, missM: null, reason: 'targetGone', at: state.position };

      for (let k = 0; target && !outcome && k < SUBSTEPS; k++) {
        const flightS = (tick - 1 - missile.launchTick) * TICK_S + k * dt;
        const targetStart = add(target.position, scale(target.velocity, k * dt));
        const targetEnd = add(targetStart, scale(target.velocity, dt));
        const next = stepMissile(state, flightS, targetStart, target.velocity, dt, config);
        if (flightS + dt >= config.armAfterS) {
          const pass = closestApproach(
            sub(targetStart, state.position),
            sub(targetEnd, next.position),
          );
          if (pass.fraction < 1) {
            const hit = pass.distanceM <= config.lethalRadiusM;
            const at = add(
              state.position,
              scale(sub(next.position, state.position), pass.fraction),
            );
            outcome = { hit, missM: pass.distanceM, reason: hit ? null : 'passed', at };
          }
        }
        state = next;
        if (!outcome && state.position.z < 0) {
          outcome = {
            hit: false,
            missM: distance(state.position, targetEnd),
            reason: 'ground',
            at: state.position,
          };
        } else if (!outcome && flightS + dt >= config.maxFlightS) {
          outcome = {
            hit: false,
            missM: distance(state.position, targetEnd),
            reason: 'outOfTime',
            at: state.position,
          };
        }
      }

      if (!outcome) {
        const sampleTrail = (tick - missile.launchTick) % MISSILE_TRAIL_EVERY_TICKS === 0;
        flying.push({
          ...missile,
          position: state.position,
          velocity: state.velocity,
          trail: sampleTrail
            ? [...missile.trail.slice(1 - MISSILE_TRAIL_LENGTH), state.position]
            : missile.trail,
        });
        continue;
      }

      this.engagements = this.engagements.map((e) =>
        e.id === missile.engagementId
          ? {
              ...e,
              state: outcome.hit ? 'hit' : 'missed',
              endTick: tick,
              missDistanceM: outcome.missM,
              missReason: outcome.reason,
            }
          : e,
      );
      if (outcome.hit) {
        this.stats.hits += 1;
        this.aircraft = this.aircraft.filter((a) => a.id !== missile.targetId);
      } else {
        this.stats.misses += 1;
      }
      this.effects.push({ kind: outcome.hit ? 'intercept' : 'miss', tick, position: outcome.at });
      events.push({
        kind: 'interceptResult',
        tick,
        timeS: tick * TICK_S,
        id: missile.targetId,
        trackId: missile.trackId,
        interceptorId: missile.id,
        hit: outcome.hit,
        missDistanceM: outcome.missM,
        reason: outcome.reason,
      });
    }
    this.interceptors = flying;
  }

  private findEngagement(id: number | null): Engagement | undefined {
    return id === null ? undefined : this.engagements.find((e) => e.id === id);
  }
}
