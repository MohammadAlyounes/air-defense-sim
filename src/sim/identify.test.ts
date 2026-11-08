import { describe, expect, it } from 'vitest';
import { corridorPoint, DEFAULT_CORRIDORS, fliesCorridor, type AirCorridor } from './airspace';
import { IDEAL_SEARCH_RADAR } from './radar';
import { Simulation, type SimConfig } from './simulation';
import type { Command, SimEvent } from './types';

/** Flat ground, an ideal radar and certain kills, so identities follow the rules exactly. */
const sky = (extra: Partial<SimConfig> = {}) =>
  new Simulation({
    seed: 1,
    autoTraffic: false,
    terrain: false,
    radar: IDEAL_SEARCH_RADAR,
    wind: false,
    evasiveTurns: false,
    ...extra,
    interceptor: { certainKill: true, ...extra.interceptor },
  });

const ofKind = <K extends SimEvent['kind']>(events: readonly SimEvent[], kind: K) =>
  events.filter((e): e is Extract<SimEvent, { kind: K }> => e.kind === kind);

const DEG = Math.PI / 180;
const north = DEFAULT_CORRIDORS[0] as AirCorridor;

const spawn = (
  type: Extract<Command, { kind: 'spawnTraffic' }>['type'],
  eastM: number,
  northM: number,
  headingRad?: number,
): Command => ({ kind: 'spawnTraffic', type, eastM, northM, headingRad });

describe('Step 5: the kinematic classifier in the loop', () => {
  it("tells each track's flight profile from its filtered speed and height", () => {
    const sim = sky();
    const onLane = corridorPoint(north, -20_000);
    sim.dispatch(spawn('jet', 0, 30_000, Math.PI));
    sim.dispatch(spawn('drone', 6_000, -3_000, 270 * DEG)); // a tiny echo: seen from 9 km
    sim.dispatch(spawn('cruise', -15_000, -10_000, 60 * DEG));
    sim.dispatch(spawn('friendly', 20_000, 10_000, 250 * DEG));
    sim.dispatch(spawn('airliner', onLane.x, onLane.y)); // no heading: it flies the lane
    sim.run(50 * 20);
    const snapshot = sim.snapshot();
    const typeOf = (truthId: number | null) =>
      snapshot.aircraft.find((a) => a.id === truthId)?.type;
    const profiles = Object.fromEntries(
      snapshot.tracks.map((t) => [typeOf(t.truthId), [t.profile, t.corridorId]]),
    );
    expect(profiles).toEqual({
      jet: ['fast', null],
      drone: ['slow', null],
      cruise: ['lowFast', null],
      friendly: ['aircraft', null],
      airliner: ['airliner', north.id],
    });
  });
});

describe('Step 5: identity rules', () => {
  it('calls a silent jet suspect at the first check: it flies like a threat', () => {
    const sim = sky();
    sim.dispatch(spawn('jet', 0, 30_000, Math.PI));
    const [first, second] = ofKind(sim.run(50 * 30), 'identified');
    expect(first).toMatchObject({ identity: 'suspect', profile: 'fast', checks: 1 });
    expect(second).toMatchObject({ identity: 'hostile', checks: 2 });
  });

  it('calls a silent friendly unknown, then hostile: an aircraft like any other', () => {
    const sim = sky({ defense: { friendReplyProbability: 0 } });
    sim.dispatch(spawn('friendly', 0, 25_000, Math.PI));
    const ids = ofKind(sim.run(50 * 30), 'identified').map((e) => [e.identity, e.profile]);
    expect(ids).toEqual([
      ['unknown', 'aircraft'],
      ['hostile', 'aircraft'],
    ]);
  });

  it('never calls a silent airliner hostile while it flies a civil corridor', () => {
    const sim = sky({
      defense: { civilSquawkProbability: 0 },
      rules: { weaponsControl: 'FREE' },
    });
    const start = corridorPoint(north, -25_000);
    sim.dispatch(spawn('airliner', start.x, start.y));
    const events = sim.run(50 * 180);
    const checks = ofKind(events, 'identified');
    // Checked every 4 s while it stays silent: about 40 checks in three minutes.
    expect(checks.length).toBeGreaterThan(30);
    for (const check of checks) {
      expect(check).toMatchObject({
        identity: 'unknown',
        evidence: 'noReply',
        profile: 'airliner',
        corridorId: north.id,
      });
    }
    // Its course along the lane never comes near an asset: even weapons FREE leave it alone.
    expect(ofKind(events, 'threatEvaluated')).toHaveLength(0);
    expect(ofKind(events, 'engagementAssigned')).toHaveLength(0);
  });

  it('calls a silent airliner hostile once it leaves the corridor', () => {
    // A lane 20 km north running east; the airliner flies 20° off it and leaves its side.
    const lane: AirCorridor = { ...north, centre: { x: 0, y: 20_000, z: 0 }, axisRad: 90 * DEG };
    const sim = sky({ corridors: [lane], defense: { civilSquawkProbability: 0 } });
    sim.dispatch(spawn('airliner', -20_000, 20_000, 70 * DEG));
    const checks = ofKind(sim.run(50 * 120), 'identified');
    const hostileAt = checks.findIndex((e) => e.identity === 'hostile');
    expect(hostileAt).toBeGreaterThan(1);
    // Unknown while inside the lane (after however many checks), hostile at the first check
    // outside it: by then it has failed far more than two.
    for (const check of checks.slice(0, hostileAt)) {
      expect(check).toMatchObject({ identity: 'unknown', corridorId: lane.id });
    }
    expect(checks[hostileAt]).toMatchObject({ corridorId: null, profile: 'airliner' });
    expect(checks[hostileAt]?.checks).toBeGreaterThan(2);
    expect(checks).toHaveLength(hostileAt + 1); // hostile is final
  });

  it('shoots down a silent airliner off the corridors flying at the battery: an ID error', () => {
    const sim = sky({ defense: { civilSquawkProbability: 0 } });
    sim.dispatch(spawn('airliner', 30_000, 0, 270 * DEG));
    const events = sim.run(50 * 120);
    expect(ofKind(events, 'identified').map((e) => e.identity)).toEqual(['unknown', 'hostile']);
    const [result] = ofKind(events, 'interceptResult');
    expect(result).toMatchObject({ hit: true, targetAffiliation: 'neutral' });
    expect(sim.snapshot().stats).toMatchObject({ idErrors: 1, threatsDown: 0 });
  });

  it('engages a suspect under weapons FREE, and counts the kill by what the target really was', () => {
    // No second check before the kill: the jet is still only 'suspect' when it is destroyed.
    const sim = sky({ rules: { weaponsControl: 'FREE' }, defense: { iffRecheckS: 600 } });
    sim.dispatch(spawn('jet', 0, 30_000, Math.PI));
    const events = sim.run(50 * 60);
    expect(ofKind(events, 'identified').map((e) => e.identity)).toEqual(['suspect']);
    expect(ofKind(events, 'killAssessed')).toHaveLength(1);
    expect(sim.snapshot().stats).toMatchObject({ threatsDown: 1, idErrors: 0 });
  });
});

describe('Step 5: civil traffic flies the corridors', () => {
  it('sends a dropped airliner to join the nearest lane and fly along it', () => {
    const sim = sky();
    const start = corridorPoint(north, -15_000, 4_000); // 4 km south of the north lane
    sim.dispatch(spawn('airliner', start.x, start.y));
    sim.run(50 * 90);
    const [airliner] = sim.snapshot().aircraft;
    expect(airliner && fliesCorridor(north, airliner.position, airliner.trackRad)).toBe(true);
  });

  it('flies every scenario airliner along a corridor', () => {
    for (const seed of [3, 11, 2026]) {
      const sim = new Simulation({ seed });
      for (let i = 0; i < 20; i++) {
        for (const a of sim.snapshot().aircraft.filter((a) => a.type === 'airliner')) {
          expect(DEFAULT_CORRIDORS.some((l) => fliesCorridor(l, a.position, a.trackRad))).toBe(
            true,
          );
        }
        sim.run(50 * 30);
      }
    }
  });
});
