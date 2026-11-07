import { EXPONENTIAL_ATMOSPHERE } from './atmosphere';
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
import { lineOfSight } from './propagation';
import {
  antennaAzimuth,
  DEFAULT_SEARCH_RADAR,
  falseAlarmsPerTurn,
  lookProbability,
  sweptOver,
  type SearchRadarConfig,
} from './radar';
import {
  DEFAULT_AUTO_TRAFFIC,
  nextArrivalTick,
  planFlight,
  type AutoTrafficConfig,
} from './scenario';
import { createTerrain, flatTerrain, type Terrain, type TerrainConfig } from './terrain';
import {
  associate,
  DEFAULT_TRACKER,
  plotCovariance,
  positionOf,
  startEstimate,
  trackPositionAt,
  updateEstimate,
  velocityOf,
  type TrackerConfig,
} from './tracker';
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
  /**
   * Procedural terrain around the battery (its settings, or a ready-made height map), or
   * `false` for flat ground (tests, comparisons).
   */
  terrain?: Partial<TerrainConfig> | Terrain | false;
  /** Aircraft farther than this from the battery, and flying away, leave the simulation. */
  areaRadiusM?: number;
  /** Scenario traffic that arrives on its own; `false` for an empty sky (tests, sandbox). */
  autoTraffic?: Partial<AutoTrafficConfig> | false;
  defense?: Partial<DefenseConfig>;
  interceptor?: Partial<InterceptorConfig>;
  tracker?: Partial<TrackerConfig>;
}

/** Radar plots kept for the fading phosphor trail, in antenna turns. */
const PLOT_HISTORY_TURNS = 3;
/** A confirmed track is dropped after this many antenna turns without an echo. */
const LOSE_AFTER_TURNS = 3;
/**
 * Plots are associated in batches covering this many ticks of sweep (0.2 s, 18°), and committed
 * when they are that old: close neighbours (a swarm) then compete for tracks together, instead
 * of the first echo swept taking a track that belongs to the next one.
 */
const ASSOCIATION_LAG_TICKS = 10;
/** A tentative track is dropped if the next look brings no echo (a little over one turn). */
const DROP_TENTATIVE_AFTER_TURNS = 1.25;
/** The command node only engages tracks that had an echo within this many antenna turns. */
const ENGAGE_FRESH_TURNS = 1.25;
/** Terrain-following traffic looks this far ahead (s) and keeps at least this clearance (m). */
const TERRAIN_LOOKAHEAD_S = [0, 1.5, 3] as const;
const MIN_CLEARANCE_M = 10;
/** Aircraft flying at a set altitude still climb to stay this far above the hills, m. */
const MSL_CLEARANCE_M = 150;
/** False alarms appear between this range and the instrumented range, m. */
const FALSE_ALARM_MIN_RANGE_M = 1_000;
/** ...and at elevations up to this angle, rad. */
const FALSE_ALARM_MAX_ELEVATION_RAD = (15 * Math.PI) / 180;
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
  /** The landscape: generated once from its own seed, never changed by the run. */
  readonly terrain: Terrain;
  /** Where the search radar's antenna is. */
  private readonly antenna: Vec3;
  private readonly defense: DefenseConfig;
  private readonly interceptorConfig: InterceptorConfig;
  private readonly tracker: TrackerConfig;
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
  /** Plots waiting to be associated (the last `ASSOCIATION_LAG_TICKS` of sweep). */
  private pendingPlots: Plot[] = [];
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
    this.terrain =
      config.terrain === false
        ? flatTerrain()
        : config.terrain && 'heightAt' in config.terrain
          ? config.terrain
          : createTerrain(config.terrain);
    this.antenna = vec3(0, 0, this.terrain.heightAt(0, 0) + this.radar.antennaHeightM);
    this.defense = { ...DEFAULT_DEFENSE, ...config.defense };
    this.interceptorConfig = { ...DEFAULT_INTERCEPTOR, ...config.interceptor };
    this.tracker = { ...DEFAULT_TRACKER, ...config.tracker };
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
        this.addAircraft(
          flight.type,
          flight.position,
          flight.velocity,
          this.startupEvents,
          flight.position.z,
        );
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
        antennaHeightM: this.radar.antennaHeightM,
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
        pendingPlots: this.pendingPlots,
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
        const altitudeM = command.altitudeM ?? performance.altitudeM;
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
          this.addAircraft(
            type,
            vec3(command.eastM + offset.x, command.northM + offset.y, 0),
            velocity,
            events,
            altitudeM + offset.z,
          );
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
      this.addAircraft(flight.type, flight.position, flight.velocity, events, flight.position.z);
    }
    this.nextArrival = nextArrivalTick(this.rng, this.traffic, tick);
  }

  /**
   * Straight, level courses at constant ground speed. Height follows the terrain: AGL traffic
   * holds its height above the highest ground just ahead, MSL traffic keeps its altitude but
   * climbs over hills, both within the type's climb rate.
   */
  private moveAircraft(tick: number): void {
    const sampleTrail = tick % TRAIL_EVERY_TICKS === 0;
    this.aircraft = this.aircraft.map((a) => {
      const x = a.position.x + a.velocity.x * TICK_S;
      const y = a.position.y + a.velocity.y * TICK_S;
      const wanted = this.cruiseHeight(a.altitudeRef, a.cruiseAltitudeM, x, y, a.velocity);
      const climb = TRAFFIC[a.type].climbMps * TICK_S;
      const floor = this.terrain.heightAt(x, y) + MIN_CLEARANCE_M;
      const z = Math.max(
        floor,
        Math.min(a.position.z + climb, Math.max(a.position.z - climb, wanted)),
      );
      const position = vec3(x, y, z);
      return {
        ...a,
        position,
        velocity: vec3(a.velocity.x, a.velocity.y, (z - a.position.z) / TICK_S),
        trail: sampleTrail ? [...a.trail.slice(1 - TRAIL_LENGTH), position] : a.trail,
      };
    });
  }

  /** The height an aircraft wants to be at over (x, y), looking a few seconds ahead. */
  private cruiseHeight(
    ref: Aircraft['altitudeRef'],
    altitudeM: number,
    x: number,
    y: number,
    velocity: Vec3,
  ): number {
    let ground = 0;
    for (const aheadS of TERRAIN_LOOKAHEAD_S) {
      ground = Math.max(
        ground,
        this.terrain.heightAt(x + velocity.x * aheadS, y + velocity.y * aheadS),
      );
    }
    return ref === 'AGL' ? ground + altitudeM : Math.max(altitudeM, ground + MSL_CLEARANCE_M);
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

  /** Adds an aircraft at ground point (position.x, position.y), flying at `altitudeM`. */
  private addAircraft(
    type: AircraftType,
    ground: Vec3,
    velocity: Vec3,
    events: SimEvent[],
    altitudeM: number,
  ): void {
    const performance = TRAFFIC[type];
    const z = this.cruiseHeight(performance.altitudeRef, altitudeM, ground.x, ground.y, velocity);
    const position = vec3(ground.x, ground.y, z);
    const aircraft: Aircraft = {
      id: this.nextId++,
      type,
      affiliation: performance.affiliation,
      radarSize: performance.radarSize,
      position,
      velocity: vec3(velocity.x, velocity.y, 0),
      altitudeRef: performance.altitudeRef,
      cruiseAltitudeM: altitudeM,
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
   * Paints the aircraft the beam swept past during this tick. Each needs a clear line of sight
   * (not below the radar horizon, not behind a hill), and then is detected with the probability
   * its signal-to-noise ratio gives. Every echo is measured with noise. Now and then noise alone
   * crosses the threshold somewhere in the swept arc: a false alarm.
   */
  private sweep(tick: number): Plot[] {
    const from = antennaAzimuth((tick - 1) * TICK_S, this.radar.periodS);
    const to = antennaAzimuth(tick * TICK_S, this.radar.periodS);
    const timeS = tick * TICK_S;
    const painted: Plot[] = [];
    this.aircraft = this.aircraft.map((a) => {
      const rangeM = groundRange(a.position);
      if (rangeM < 1 || rangeM > this.radar.rangeM) return a;
      if (!sweptOver(from, to, bearing(a.position))) return a;
      if (lineOfSight(this.terrain, this.antenna, a.position) !== 'visible') return a;
      const pd = lookProbability(
        RADAR_CROSS_SECTION_M2[a.radarSize],
        distance(this.antenna, a.position),
        this.radar,
      );
      if (pd <= 0 || (pd < 1 && this.rng.next() >= pd)) return a;
      const plot = this.makePlot(tick, timeS, this.measure(a.position), a.radarSize, a.id);
      painted.push(plot);
      return { ...a, lastPaint: { tick, bearingRad: plot.bearingRad, rangeM: plot.rangeM } };
    });

    const falseAlarmChance = (falseAlarmsPerTurn(this.radar) * TICK_S) / this.radar.periodS;
    if (falseAlarmChance > 0 && this.rng.next() < falseAlarmChance) {
      const span = (((to - from) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const b = from + this.rng.next() * span;
      // Uniform over the area of the annulus, not bunched near the radar.
      const r = Math.sqrt(this.rng.range(FALSE_ALARM_MIN_RANGE_M ** 2, this.radar.rangeM ** 2));
      const elevation = this.rng.range(0, FALSE_ALARM_MAX_ELEVATION_RAD);
      const position = vec3(
        r * Math.sin(b),
        r * Math.cos(b),
        this.antenna.z + r * Math.tan(elevation),
      );
      painted.push(this.makePlot(tick, timeS, position, 'tiny', null));
    }
    this.plots.push(...painted);
    return painted;
  }

  private makePlot(
    tick: number,
    timeS: number,
    position: Vec3,
    radarSize: Plot['radarSize'],
    truthId: Plot['truthId'],
  ): Plot {
    return {
      tick,
      timeS,
      position,
      bearingRad: bearing(position),
      rangeM: groundRange(position),
      radarSize,
      truthId,
    };
  }

  /**
   * What the radar measures: slant range, bearing and elevation from the antenna, each with
   * Gaussian noise, turned back into a position. Bearing noise grows into a large sideways error
   * far out (0.15° is 80 m at 30 km), while range stays precise.
   */
  private measure(p: Vec3): Vec3 {
    const { rangeSigmaM, azimuthSigmaRad, elevationSigmaRad } = this.radar;
    if (rangeSigmaM === 0 && azimuthSigmaRad === 0 && elevationSigmaRad === 0) return p;
    const rel = sub(p, this.antenna);
    const slant = length(rel);
    const range = slant + this.rng.normal(0, rangeSigmaM);
    const az = Math.atan2(rel.x, rel.y) + this.rng.normal(0, azimuthSigmaRad);
    const el = Math.asin(rel.z / slant) + this.rng.normal(0, elevationSigmaRad);
    const ground = range * Math.cos(el);
    return add(
      this.antenna,
      vec3(ground * Math.sin(az), ground * Math.cos(az), range * Math.sin(el)),
    );
  }

  // ── Track ───────────────────────────────────────────────────────────────────────────────

  private updateTracks(tick: number, plots: readonly Plot[], events: SimEvent[]): void {
    const timeS = tick * TICK_S;
    const painted = new Set<number>();
    // The batch: plots from the last 0.2 s of sweep. Only the oldest are committed this tick,
    // but the newer ones take part, so they can claim the tracks that fit them best.
    this.pendingPlots.push(...plots);
    const commitTick = tick - ASSOCIATION_LAG_TICKS;
    const batch = this.pendingPlots;
    const batchCovariances = batch.map((plot) => plotCovariance(plot, this.antenna, this.radar));
    // Gating and nearest-neighbour association: the tracker sees only the measurements.
    const batchOwners = associate(
      batch,
      batchCovariances,
      this.tracks,
      ticks(this.radar.periodS / 2),
      this.tracker,
    );
    const committed = batch.filter((plot) => plot.tick <= commitTick);
    const covariances = batchCovariances.filter((_, i) => (batch[i]?.tick ?? 0) <= commitTick);
    const owners = batchOwners.filter((_, i) => (batch[i]?.tick ?? 0) <= commitTick);
    this.pendingPlots = batch.filter((plot) => plot.tick > commitTick);

    committed.forEach((plot, p) => {
      const R = covariances[p] ?? [];
      const index = owners[p] ?? -1;
      const track = this.tracks[index];
      if (!track) {
        const estimate = startEstimate(plot, R, this.tracker);
        const created: Track = {
          id: this.nextTrackId++,
          truthId: plot.truthId,
          createdTick: plot.tick,
          detectedRangeM: plot.rangeM,
          paints: 1,
          lastPaintTick: plot.tick,
          position: positionOf(estimate),
          velocity: null,
          estimate,
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
        return;
      }

      // The Kalman filter blends the new echo into the track's estimate.
      const estimate = updateEstimate(track, plot, R, this.tracker);
      const updated: Track = {
        ...track,
        truthId: plot.truthId,
        paints: track.paints + 1,
        lastPaintTick: plot.tick,
        position: positionOf(estimate),
        velocity: velocityOf(estimate),
        estimate,
        confirmedTick: track.confirmedTick ?? tick,
      };
      if (track.confirmedTick === null && updated.velocity) {
        events.push({
          kind: 'trackConfirmed',
          tick,
          timeS,
          id: plot.truthId,
          trackId: track.id,
          speedMps: length(updated.velocity),
          altitudeM: updated.position.z,
        });
      }
      // Assess: the radar sees the target again, so the last shot missed.
      const engagement = this.findEngagement(track.engagementId);
      if (engagement?.state === 'missed') {
        this.engagements = this.engagements.filter((e) => e.id !== engagement.id);
        updated.engagementId = null;
        events.push({ kind: 'targetSurvived', tick, timeS, id: plot.truthId, trackId: track.id });
      }
      this.tracks[index] = updated;
      painted.add(track.id);
    });

    // Tracks the beam swept over (at the committed tick) without an echo: confirm kills, drop
    // stale tracks.
    const from = antennaAzimuth((commitTick - 1) * TICK_S, this.radar.periodS);
    const to = antennaAzimuth(commitTick * TICK_S, this.radar.periodS);
    const loseAfter = ticks(LOSE_AFTER_TURNS * this.radar.periodS);
    const dropAfter = ticks(DROP_TENTATIVE_AFTER_TURNS * this.radar.periodS);
    const kept: Track[] = [];
    for (const track of this.tracks) {
      if (painted.has(track.id)) {
        kept.push(track);
        continue;
      }
      const engagement = this.findEngagement(track.engagementId);
      const swept = sweptOver(from, to, bearing(trackPositionAt(track, commitTick)));
      if (swept && engagement?.state === 'hit') {
        this.assessKill(track, engagement, tick, events);
        continue;
      }
      // The engagement radar keeps a target it is guiding an interceptor to, and a target it has
      // just hit until the search beam comes round to assess it.
      const guiding = engagement?.state === 'flying' || engagement?.state === 'hit';
      const tentative = track.confirmedTick === null;
      if (!guiding && commitTick - track.lastPaintTick > (tentative ? dropAfter : loseAfter)) {
        if (engagement) this.engagements = this.engagements.filter((e) => e !== engagement);
        const at = trackPositionAt(track, tick);
        events.push({
          kind: tentative ? 'contactDropped' : 'contactLost',
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
      // The identification check gets an answer from the real aircraft, if there is one.
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
    const fresh = ticks(ENGAGE_FRESH_TURNS * this.radar.periodS);
    const candidates = this.tracks
      .filter((t) => t.threat && t.engagementId === null && tick - t.lastPaintTick <= fresh)
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
      targetInView: true,
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
   *
   * The radar guides the interceptor to the target while it can see it. If terrain or the
   * horizon hides the target, the interceptor steers toward where the track says it should be.
   */
  private flyInterceptors(tick: number, events: SimEvent[]): void {
    const config = this.interceptorConfig;
    const dt = TICK_S / SUBSTEPS;
    const flying: Interceptor[] = [];

    for (const missile of this.interceptors) {
      const target = this.aircraft.find((a) => a.id === missile.targetId);
      const track = this.tracks.find((t) => t.id === missile.trackId);
      const inView = target
        ? lineOfSight(this.terrain, this.antenna, target.position) === 'visible'
        : false;
      const guideFrom = inView || !track ? target?.position : trackPositionAt(track, tick - 1);
      const guideVel = inView || !track?.velocity ? target?.velocity : track.velocity;
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
        const aimVel = guideVel ?? target.velocity;
        const aim = add(guideFrom ?? target.position, scale(aimVel, k * dt));
        const next = stepMissile(state, flightS, aim, aimVel, dt, config, EXPONENTIAL_ATMOSPHERE);
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
        if (
          !outcome &&
          state.position.z < this.terrain.heightAt(state.position.x, state.position.y)
        ) {
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
          targetInView: inView,
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
