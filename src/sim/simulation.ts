import { STANDARD_ATMOSPHERE } from './atmosphere';
import { DEFAULT_ASSETS, type DefendedAsset } from './assets';
import {
  DEFAULT_DEFENSE,
  DEFAULT_RULES,
  engageable,
  evaluateThreat,
  iffAnswer,
  killProbability,
  LAUNCHER_POSITION,
  planIntercept,
  type DefenseConfig,
  type Identity,
  type Rules,
} from './c2';
import { TICK_S } from './core/clock';
import { fnv1a } from './core/hash';
import { Rng } from './core/rng';
import {
  add,
  bearing,
  distance,
  groundRange,
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
  angleDiff,
  BREAK_HOLD_S,
  BREAK_RANGE_M,
  bearingTo,
  breakTrack,
  CALM,
  dropRoute,
  insideTurnCircle,
  routineLoadFactor,
  turnRadiusM,
  turnRateRadS,
  turnToward,
  windFromSeed,
  windTriangle,
  windVelocityAt,
  type WindConfig,
} from './flight';
import { inClutter, lineOfSight } from './propagation';
import {
  antennaAzimuth,
  DEFAULT_SEARCH_RADAR,
  closingSpeedMps,
  falseAlarmsPerTurn,
  inDopplerNotch,
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
  associateWithManeuvers,
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
  /** What the battery defends; the battery itself should be one of them. */
  assets?: readonly DefendedAsset[];
  /** Rules of engagement at the start (they can change with `setRules` commands). */
  rules?: Partial<Rules>;
  /**
   * The wind 10 m above the ground, or `false` for calm air. By default each run draws its own
   * from the seed (`windFromSeed`).
   */
  wind?: WindConfig | false;
  /** Fast jets break away from interceptors closing on them (default true). */
  evasiveTurns?: boolean;
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
/** A waypoint counts as reached within this distance, m. */
const WAYPOINT_REACHED_M = 300;
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
  private readonly assets: readonly DefendedAsset[];
  private rules: Rules;
  private readonly areaRadiusM: number;
  private readonly traffic: AutoTrafficConfig | null;
  private readonly wind: WindConfig;
  private readonly evasiveTurns: boolean;
  /** Random numbers for routes, kept apart so they never shift the run's other draws. */
  private readonly routeRng: Rng;
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
    idErrors: 0,
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
    this.assets = config.assets ?? DEFAULT_ASSETS;
    this.rules = { ...DEFAULT_RULES, ...config.rules };
    this.areaRadiusM = config.areaRadiusM ?? this.radar.rangeM + 2_000;
    this.traffic =
      config.autoTraffic === false ? null : { ...DEFAULT_AUTO_TRAFFIC, ...config.autoTraffic };
    this.wind = config.wind === false ? CALM : (config.wind ?? windFromSeed(this.seed));
    this.evasiveTurns = config.evasiveTurns ?? true;
    this.routeRng = new Rng((this.seed ^ 0x2545f491) >>> 0);
    this.launcher = {
      ready: this.defense.launcherCapacity,
      capacity: this.defense.launcherCapacity,
      nextLaunchTick: 0,
      nextReloadTick: null,
    };

    if (this.traffic) {
      for (let i = 0; i < this.traffic.initialCount; i++) {
        const flight = planFlight(this.rng, this.traffic, true, this.assets, this.routeRng);
        this.addAircraft(
          flight.type,
          flight.position,
          flight.trackRad,
          flight.route,
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
    this.moveAircraft(tick, events);
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
      channels: { used: this.channelsInUse(), total: this.defense.fireChannels },
      rules: { ...this.rules },
      assets: this.assets,
      wind: { ...this.wind },
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
        routeRng: this.routeRng.state(),
        wind: this.wind,
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
        rules: this.rules,
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
        for (let i = 0; i < performance.count; i++) {
          const offset =
            i === 0
              ? vec3(0, 0, 0)
              : vec3(
                  this.rng.range(-SWARM_SPREAD_M, SWARM_SPREAD_M),
                  this.rng.range(-SWARM_SPREAD_M, SWARM_SPREAD_M),
                  this.rng.range(-50, 50),
                );
          const start = vec3(command.eastM + offset.x, command.northM + offset.y, 0);
          const route = dropRoute(type, start, command.headingRad);
          const first = route[0];
          this.addAircraft(
            type,
            start,
            first ? bearingTo(start, first) : command.headingRad,
            route,
            events,
            altitudeM + offset.z,
          );
        }
        break;
      }
      case 'removeAircraft':
        this.aircraft = this.aircraft.filter((a) => a.id !== command.id);
        break;
      case 'setRules':
        this.setRules(command.rules, events);
        break;
      case 'approveEngagement':
        this.approve(command.engagementId, events);
        break;
      case 'holdFire':
        this.holdFire(command.engagementId, events);
        break;
    }
  }

  private scenarioArrivals(tick: number, events: SimEvent[]): void {
    if (!this.traffic || this.nextArrival === null || tick < this.nextArrival) return;
    if (this.aircraft.length < this.traffic.maxAircraft) {
      const flight = planFlight(this.rng, this.traffic, false, this.assets, this.routeRng);
      this.addAircraft(
        flight.type,
        flight.position,
        flight.trackRad,
        flight.route,
        events,
        flight.position.z,
      );
    }
    this.nextArrival = nextArrivalTick(this.rng, this.traffic, tick);
  }

  /**
   * Flies every aircraft for one tick. It turns toward its next waypoint (or holds an evasive
   * break) no faster than its bank angle allows, keeps its airspeed, and steers into the wind
   * to hold its track over the ground. Height follows the terrain: AGL traffic holds its height
   * above the highest ground just ahead, MSL traffic keeps its altitude but climbs over hills,
   * both within the type's climb rate.
   */
  private moveAircraft(tick: number, events: SimEvent[]): void {
    const sampleTrail = tick % TRAIL_EVERY_TICKS === 0;
    this.aircraft = this.aircraft.map((before) => {
      const a = this.steer(before, tick, events);
      const agl = a.position.z - this.terrain.heightAt(a.position.x, a.position.y);
      const flight = windTriangle(a.trackRad, a.airspeedMps, windVelocityAt(this.wind, agl));
      const ground = flight.groundVelocity;
      const x = a.position.x + ground.x * TICK_S;
      const y = a.position.y + ground.y * TICK_S;
      const wanted = this.cruiseHeight(a.altitudeRef, a.cruiseAltitudeM, x, y, ground);
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
        velocity: vec3(ground.x, ground.y, (z - a.position.z) / TICK_S),
        headingRad: flight.headingRad,
        trail: sampleTrail ? [...a.trail.slice(1 - TRAIL_LENGTH), position] : a.trail,
      };
    });
  }

  /**
   * Picks the aircraft's ground track for this tick: an evasive break if an interceptor is
   * closing on a fast jet, otherwise toward its next waypoint, turning at its routine bank.
   * Waypoints are passed when reached (or turned toward early, so the turn ends on the next
   * leg); after the last one it flies straight on.
   */
  private steer(a: Aircraft, tick: number, events: SimEvent[]): Aircraft {
    const performance = TRAFFIC[a.type];
    let { maneuver, evaded, route } = a;

    if (maneuver) {
      const still = this.interceptors.some((i) => i.id === maneuver?.interceptorId);
      if (tick >= maneuver.untilTick || !still) maneuver = null;
    }
    if (!maneuver && this.evasiveTurns && performance.breakLoadFactor > 0) {
      const threat = this.interceptors.find(
        (i) =>
          i.targetId === a.id &&
          !evaded.includes(i.id) &&
          distance(i.position, a.position) < BREAK_RANGE_M,
      );
      if (threat) {
        maneuver = {
          kind: 'break',
          trackRad: breakTrack(a.trackRad, a.position, threat.position),
          untilTick: tick + ticks(BREAK_HOLD_S),
          interceptorId: threat.id,
        };
        evaded = [...evaded, threat.id];
        events.push({
          kind: 'evasiveTurn',
          tick,
          timeS: tick * TICK_S,
          id: a.id,
          type: a.type,
          interceptorId: threat.id,
          loadFactor: performance.breakLoadFactor,
        });
      }
    }

    let desired = a.trackRad;
    let loadFactor = routineLoadFactor(performance);
    if (maneuver) {
      desired = maneuver.trackRad;
      loadFactor = performance.breakLoadFactor;
    } else {
      const radius = turnRadiusM(a.airspeedMps, loadFactor);
      while (route.length > 0) {
        const waypoint = route[0] as Vec3;
        const toWaypoint = bearingTo(a.position, waypoint);
        const distanceM = Math.hypot(waypoint.x - a.position.x, waypoint.y - a.position.y);
        const next = route[1];
        // Start the turn onto the next leg early, so it ends on the leg rather than past it.
        const turnAhead = next ? Math.abs(angleDiff(bearingTo(waypoint, next), toWaypoint)) : 0;
        const lead = Number.isFinite(radius) ? radius * Math.tan(Math.min(turnAhead, 2) / 2) : 0;
        // A waypoint inside the turn circle cannot be reached by turning (after an evasive break,
        // say). A turn point is then given up; the last waypoint, its aim, is flown on from
        // until it can turn back in.
        const unreachable = insideTurnCircle(a.position, a.trackRad, waypoint, radius);
        if (distanceM <= Math.max(lead, WAYPOINT_REACHED_M) || (unreachable && next)) {
          route = route.slice(1);
          continue;
        }
        if (!unreachable) desired = toWaypoint;
        break;
      }
    }
    const maxTurn = turnRateRadS(a.airspeedMps, loadFactor) * TICK_S;
    const trackRad = turnToward(a.trackRad, desired, maxTurn);
    return { ...a, trackRad, route, maneuver, evaded };
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

  /** A hostile that gets inside any defended asset's leak radius has got through. */
  private checkLeaks(tick: number, events: SimEvent[]): void {
    this.aircraft = this.aircraft.map((a) => {
      if (a.leaked || a.affiliation !== 'hostile') return a;
      const reached = this.assets.find(
        (asset) =>
          Math.hypot(a.position.x - asset.position.x, a.position.y - asset.position.y) <
          asset.leakRadiusM,
      );
      if (!reached) return a;
      this.stats.threatsLeaked += 1;
      this.effects.push({ kind: 'leak', tick, position: a.position });
      events.push({
        kind: 'threatLeaked',
        tick,
        timeS: tick * TICK_S,
        id: a.id,
        type: a.type,
        assetId: reached.id,
      });
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

  /**
   * Adds an aircraft at ground point (position.x, position.y), flying at `altitudeM` along
   * `trackRad`, with the waypoints of `route` ahead of it.
   */
  private addAircraft(
    type: AircraftType,
    ground: Vec3,
    trackRad: number,
    route: readonly Vec3[],
    events: SimEvent[],
    altitudeM: number,
  ): void {
    const performance = TRAFFIC[type];
    const still = windTriangle(trackRad, performance.speedMps, vec3(0, 0, 0)).groundVelocity;
    const z = this.cruiseHeight(performance.altitudeRef, altitudeM, ground.x, ground.y, still);
    const flight = windTriangle(
      trackRad,
      performance.speedMps,
      windVelocityAt(this.wind, z - this.terrain.heightAt(ground.x, ground.y)),
    );
    const position = vec3(ground.x, ground.y, z);
    const aircraft: Aircraft = {
      id: this.nextId++,
      type,
      affiliation: performance.affiliation,
      radarSize: performance.radarSize,
      position,
      velocity: flight.groundVelocity,
      airspeedMps: performance.speedMps,
      trackRad,
      headingRad: flight.headingRad,
      route,
      maneuver: null,
      evaded: [],
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
   * its signal-to-noise ratio gives, unless its echo arrives with the echo of lit ground while it
   * closes or opens too slowly to stand out from it by its Doppler shift. Every echo is
   * measured with noise. Now and then noise alone crosses the threshold somewhere in the swept
   * arc: a false alarm.
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
      // Where the ground echo arrives with it, the Doppler filter that removes the clutter also
      // removes an echo as slow as the ground's.
      if (
        inDopplerNotch(closingSpeedMps(this.antenna, a.position, a.velocity), this.radar) &&
        inClutter(this.terrain, this.antenna, a.position)
      ) {
        return a;
      }
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
    const { owners: batchOwners, maneuvers: batchManeuvers } = associateWithManeuvers(
      batch,
      batchCovariances,
      this.tracks,
      ticks(this.radar.periodS / 2),
      this.tracker,
    );
    const isCommitted = (_: unknown, i: number) => (batch[i]?.tick ?? 0) <= commitTick;
    const committed = batch.filter(isCommitted);
    const covariances = batchCovariances.filter(isCommitted);
    const owners = batchOwners.filter(isCommitted);
    const maneuvers = batchManeuvers.filter(isCommitted);
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
          maneuvering: false,
          estimate,
          confirmedTick: null,
          identity: 'pending',
          iffChecks: 0,
          nextIffTick: null,
          threat: null,
          holdFireUntilTick: null,
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
      const maneuvering = maneuvers[p] ?? false;
      const estimate = updateEstimate(track, plot, R, this.tracker, maneuvering);
      const updated: Track = {
        ...track,
        maneuvering,
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

  /**
   * Identification checks: the first 2 s after a track is confirmed, then every 4 s while it
   * stays silent. An answer settles it (friend or civil); silence makes it 'unknown', and
   * silence on every check makes it 'hostile'. A friendly aircraft whose transponder fails
   * every time is declared hostile: an identification mistake waiting to happen.
   */
  private identify(tick: number, events: SimEvent[]): void {
    const firstDelay = ticks(this.defense.iffDelayS);
    this.tracks = this.tracks.map((track) => {
      if (track.confirmedTick === null) return track;
      if (track.identity !== 'pending' && track.identity !== 'unknown') return track;
      if (tick < (track.nextIffTick ?? track.confirmedTick + firstDelay)) return track;
      // The check is answered by the real aircraft behind the track, if there is one: a false
      // track has nothing to answer.
      const aircraft = this.aircraft.find((a) => a.id === track.truthId);
      const answer = aircraft
        ? iffAnswer(aircraft.affiliation, this.rng.next(), this.defense)
        : null;
      const checks = track.iffChecks + 1;
      const identity: Exclude<Identity, 'pending'> =
        answer ?? (checks >= this.defense.iffChecks ? 'hostile' : 'unknown');
      events.push({
        kind: 'identified',
        tick,
        timeS: tick * TICK_S,
        id: track.truthId,
        trackId: track.id,
        identity,
        evidence:
          answer === 'friend' ? 'friendReply' : answer === 'neutral' ? 'civilCode' : 'noReply',
        checks,
      });
      return {
        ...track,
        identity,
        iffChecks: checks,
        nextIffTick: identity === 'unknown' ? tick + ticks(this.defense.iffRecheckS) : null,
      };
    });
  }

  /**
   * Threat evaluation: a hostile or unknown track whose course passes inside a defended asset's
   * threat radius, still approaching, is a threat to the asset it reaches soonest.
   */
  private evaluateThreats(tick: number, events: SimEvent[]): void {
    this.tracks = this.tracks.map((track) => {
      const suspect = track.identity === 'hostile' || track.identity === 'unknown';
      const threat =
        suspect && track.velocity
          ? evaluateThreat(trackPositionAt(track, tick), track.velocity, this.assets)
          : null;
      if (!threat) return track.threat ? { ...track, threat: null } : track;
      if (!track.threat || track.threat.assetId !== threat.assetId) {
        events.push({
          kind: 'threatEvaluated',
          tick,
          timeS: tick * TICK_S,
          id: track.truthId,
          trackId: track.id,
          assetId: threat.assetId,
          closestApproachM: threat.closestApproachM,
          timeToClosestS: threat.timeToClosestS,
        });
      }
      return { ...track, threat };
    });
  }

  // ── Assign and engage ───────────────────────────────────────────────────────────────────

  /** Engagements holding a fire channel: proposed, waiting to launch, or guiding an interceptor. */
  private channelsInUse(): number {
    return this.engagements.filter(
      (e) => e.state === 'proposed' || e.state === 'assigned' || e.state === 'flying',
    ).length;
  }

  /** The next free launch slot, if a shot were assigned at `tick`. */
  private nextSlot(tick: number): number {
    const queued = this.engagements.filter((e) => e.state === 'assigned');
    return Math.max(
      tick + ticks(this.defense.launchPrepS),
      this.launcher.nextLaunchTick,
      ...queued.map((e) => e.launchTick + ticks(this.defense.launchIntervalS)),
    );
  }

  /**
   * Assign: the most urgent unengaged threat that the rules allow and an interceptor could
   * reach gets a fire channel and the next launch slot (at most one per tick). In SEMI mode it
   * is proposed to the operator instead, and waits for approval. Engage: each assigned shot
   * launches when its slot comes.
   */
  private assignAndLaunch(tick: number, events: SimEvent[]): void {
    for (const engagement of this.engagements) {
      if (engagement.state === 'assigned' && tick >= engagement.launchTick) {
        this.launch(engagement, tick, events);
      }
    }
    // A proposal lapses if the shot is no longer possible or no longer allowed.
    for (const engagement of this.engagements) {
      if (engagement.state !== 'proposed') continue;
      const track = this.tracks.find((t) => t.id === engagement.trackId);
      const stillValid =
        track &&
        engageable(track.identity, this.rules.weaponsControl) &&
        planIntercept(track, this.nextSlot(tick), this.defense, this.interceptorConfig);
      if (!stillValid) this.cancel(engagement, tick, events);
    }

    if (this.channelsInUse() >= this.defense.fireChannels) return;
    const committed = this.engagements.filter(
      (e) => e.state === 'assigned' || e.state === 'proposed',
    );
    if (this.launcher.ready - committed.length <= 0) return;
    const slot = this.nextSlot(tick);
    const fresh = ticks(ENGAGE_FRESH_TURNS * this.radar.periodS);
    const candidates = this.tracks
      .filter(
        (t) =>
          t.threat &&
          t.engagementId === null &&
          engageable(t.identity, this.rules.weaponsControl) &&
          tick - t.lastPaintTick <= fresh &&
          (t.holdFireUntilTick === null || tick >= t.holdFireUntilTick),
      )
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
      const proposed = this.rules.operatorMode === 'SEMI';
      const pk = plan.pk ?? 0;
      this.engagements.push({
        id,
        trackId: track.id,
        targetId: target.id,
        targetType: target.type,
        assignedTick: tick,
        launchTick: proposed ? 0 : slot,
        interceptorId: null,
        state: proposed ? 'proposed' : 'assigned',
        pk,
        predictedPoint: plan.point,
        predictedTimeS: plan.timeS,
        endTick: null,
        missDistanceM: null,
        missReason: null,
      });
      this.tracks = this.tracks.map((t) => (t.id === track.id ? { ...t, engagementId: id } : t));
      const base = { tick, timeS: tick * TICK_S, id: target.id, trackId: track.id };
      events.push(
        proposed
          ? {
              ...base,
              kind: 'engagementProposed',
              engagementId: id,
              predictedTimeS: plan.timeS,
              predictedRangeM: groundRange(plan.point),
              pk,
            }
          : {
              ...base,
              kind: 'engagementAssigned',
              launchInS: (slot - tick) * TICK_S,
              predictedTimeS: plan.timeS,
              predictedRangeM: groundRange(plan.point),
              pk,
            },
      );
      return;
    }
  }

  /** SEMI mode: the operator approves a proposal; it gets the next launch slot. */
  private approve(engagementId: number, events: SimEvent[]): void {
    const engagement = this.findEngagement(engagementId);
    if (engagement?.state !== 'proposed') return;
    const tick = this.tickCount;
    const slot = this.nextSlot(tick);
    this.engagements = this.engagements.map((e) =>
      e.id === engagementId ? { ...e, state: 'assigned', launchTick: slot } : e,
    );
    events.push({
      kind: 'engagementApproved',
      tick,
      timeS: tick * TICK_S,
      id: engagement.targetId,
      trackId: engagement.trackId,
      engagementId,
    });
  }

  /** SEMI mode: the operator holds fire; the track is not proposed again for a while. */
  private holdFire(engagementId: number, events: SimEvent[]): void {
    const engagement = this.findEngagement(engagementId);
    if (engagement?.state !== 'proposed') return;
    const tick = this.tickCount;
    this.engagements = this.engagements.filter((e) => e.id !== engagementId);
    this.tracks = this.tracks.map((t) =>
      t.id === engagement.trackId
        ? { ...t, engagementId: null, holdFireUntilTick: tick + ticks(this.defense.holdFireS) }
        : t,
    );
    events.push({
      kind: 'holdFire',
      tick,
      timeS: tick * TICK_S,
      id: engagement.targetId,
      trackId: engagement.trackId,
      engagementId,
    });
  }

  /** New rules of engagement. Switching to AUTO approves every waiting proposal. */
  private setRules(rules: Partial<Rules>, events: SimEvent[]): void {
    this.rules = { ...this.rules, ...rules };
    events.push({
      kind: 'rulesChanged',
      tick: this.tickCount,
      timeS: this.tickCount * TICK_S,
      id: null,
      rules: { ...this.rules },
    });
    if (this.rules.operatorMode === 'AUTO') {
      for (const e of this.engagements) if (e.state === 'proposed') this.approve(e.id, events);
    }
  }

  /** Drops a shot that can no longer be fired, so the track can be assigned again. */
  private cancel(engagement: Engagement, tick: number, events: SimEvent[]): void {
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
  }

  private launch(engagement: Engagement, tick: number, events: SimEvent[]): void {
    const track = this.tracks.find((t) => t.id === engagement.trackId);
    const target = this.aircraft.find((a) => a.id === engagement.targetId);
    const plan = track && planIntercept(track, tick, this.defense, this.interceptorConfig);
    if (!track || !target || !plan || !engageable(track.identity, this.rules.weaponsControl)) {
      // The shot is no longer possible, or no longer allowed.
      this.cancel(engagement, tick, events);
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
            pk: plan.pk ?? e.pk,
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
      // The air it flies through moves with the wind; drag depends on its speed through the air.
      const windHere = windVelocityAt(
        this.wind,
        missile.position.z - this.terrain.heightAt(missile.position.x, missile.position.y),
      );
      let outcome: {
        hit: boolean;
        missM: number | null;
        reason: MissReason | null;
        at: Vec3;
        pk: number | null;
      } | null = target
        ? null
        : { hit: false, missM: null, reason: 'targetGone', at: state.position, pk: null };

      for (let k = 0; target && !outcome && k < SUBSTEPS; k++) {
        const flightS = (tick - 1 - missile.launchTick) * TICK_S + k * dt;
        const targetStart = add(target.position, scale(target.velocity, k * dt));
        const targetEnd = add(targetStart, scale(target.velocity, dt));
        const aimVel = guideVel ?? target.velocity;
        const aim = add(guideFrom ?? target.position, scale(aimVel, k * dt));
        const next = stepMissile(
          state,
          flightS,
          aim,
          aimVel,
          dt,
          config,
          STANDARD_ATMOSPHERE,
          windHere,
        );
        if (flightS + dt >= config.armAfterS) {
          const pass = closestApproach(
            sub(targetStart, state.position),
            sub(targetEnd, next.position),
          );
          if (pass.fraction < 1) {
            const at = add(
              state.position,
              scale(sub(next.position, state.position), pass.fraction),
            );
            if (pass.distanceM > config.lethalRadiusM) {
              outcome = { hit: false, missM: pass.distanceM, reason: 'passed', at, pk: null };
            } else {
              // Close enough: the kill probability decides (one random draw).
              const pk = config.certainKill
                ? 1
                : killProbability(length(target.velocity), length(next.velocity));
              const hit = this.rng.next() < pk;
              outcome = { hit, missM: pass.distanceM, reason: hit ? null : 'survived', at, pk };
            }
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
            pk: null,
          };
        } else if (!outcome && flightS + dt >= config.maxFlightS) {
          outcome = {
            hit: false,
            missM: distance(state.position, targetEnd),
            reason: 'outOfTime',
            at: state.position,
            pk: null,
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
      const affiliation = target?.affiliation ?? 'hostile';
      if (outcome.hit) {
        this.stats.hits += 1;
        // Shooting down a friendly or civil aircraft is a failure of identification.
        if (affiliation !== 'hostile') this.stats.idErrors += 1;
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
        pk: outcome.pk,
        targetAffiliation: affiliation,
      });
    }
    this.interceptors = flying;
  }

  private findEngagement(id: number | null): Engagement | undefined {
    return id === null ? undefined : this.engagements.find((e) => e.id === id);
  }
}
