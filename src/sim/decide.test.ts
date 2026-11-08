import { describe, expect, it } from 'vitest';
import { DEFAULT_ASSETS } from './assets';
import { IDEAL_SEARCH_RADAR } from './radar';
import { Simulation, type SimConfig } from './simulation';
import type { SimEvent } from './types';

const ofKind = <K extends SimEvent['kind']>(events: readonly SimEvent[], kind: K) =>
  events.filter((e): e is Extract<SimEvent, { kind: K }> => e.kind === kind);

/** Flat ground and an ideal radar, so the timing of decisions is exact. */
const sky = (extra: Partial<SimConfig> = {}) =>
  new Simulation({
    seed: 1,
    autoTraffic: false,
    terrain: false,
    radar: IDEAL_SEARCH_RADAR,
    ...extra,
  });

const jetInbound = (sim: Simulation) =>
  sim.dispatch({
    kind: 'spawnTraffic',
    type: 'jet',
    eastM: 0,
    northM: 30_000,
    headingRad: Math.PI,
  });

describe('Step 6: operator approval (SEMI mode)', () => {
  it('proposes the shot and waits; launches only once the operator approves', () => {
    const sim = sky({ rules: { operatorMode: 'SEMI' } });
    jetInbound(sim);
    const before = sim.run(50 * 20);
    const [proposal] = ofKind(before, 'engagementProposed');
    expect(proposal).toBeDefined();
    expect(proposal?.pk).toBeGreaterThan(0.3);
    expect(ofKind(before, 'interceptorLaunched')).toHaveLength(0);
    expect(sim.snapshot().engagements[0]?.state).toBe('proposed');

    sim.dispatch({ kind: 'approveEngagement', engagementId: proposal?.engagementId ?? 0 });
    const after = sim.run(50 * 3);
    expect(ofKind(after, 'engagementApproved')).toHaveLength(1);
    expect(ofKind(after, 'interceptorLaunched')).toHaveLength(1);
  });

  it('holds fire when told to, and does not ask again for 20 s', () => {
    const sim = sky({ rules: { operatorMode: 'SEMI' } });
    jetInbound(sim);
    const [proposal] = ofKind(sim.run(50 * 20), 'engagementProposed');
    sim.dispatch({ kind: 'holdFire', engagementId: proposal?.engagementId ?? 0 });
    const next = sim.run(50 * 15);
    expect(ofKind(next, 'holdFire')).toHaveLength(1);
    expect(ofKind(next, 'engagementProposed')).toHaveLength(0);
    expect(ofKind(sim.run(50 * 10), 'engagementProposed')).toHaveLength(1);
  });

  it('approves waiting proposals when switched back to AUTO', () => {
    const sim = sky({ rules: { operatorMode: 'SEMI' } });
    jetInbound(sim);
    sim.run(50 * 20);
    sim.dispatch({ kind: 'setRules', rules: { operatorMode: 'AUTO' } });
    const events = sim.run(50 * 3);
    expect(ofKind(events, 'rulesChanged')[0]?.rules.operatorMode).toBe('AUTO');
    expect(ofKind(events, 'interceptorLaunched')).toHaveLength(1);
  });
});

describe('Step 6: weapons control', () => {
  it('never fires on HOLD', () => {
    const sim = sky({ rules: { weaponsControl: 'HOLD' } });
    jetInbound(sim);
    expect(ofKind(sim.run(50 * 60), 'interceptorLaunched')).toHaveLength(0);
  });

  it('fires one identification check sooner when weapons are FREE', () => {
    const assignedAt = (weaponsControl: 'TIGHT' | 'FREE') => {
      const sim = sky({ rules: { weaponsControl } });
      jetInbound(sim);
      return ofKind(sim.run(50 * 30), 'engagementAssigned')[0]?.timeS ?? Infinity;
    };
    // FREE engages an 'unknown' (one silent check); TIGHT waits for 'hostile' (two).
    expect(assignedAt('TIGHT') - assignedAt('FREE')).toBeCloseTo(4, 6);
  });
});

describe('Step 6: identification errors', () => {
  it('shoots down a friendly aircraft whose transponder stays silent, and counts it as a failure', () => {
    const sim = sky({
      defense: { friendReplyProbability: 0 },
      interceptor: { certainKill: true },
    });
    sim.dispatch({
      kind: 'spawnTraffic',
      type: 'friendly',
      eastM: 0,
      northM: 25_000,
      headingRad: Math.PI,
    });
    const events = sim.run(50 * 90);
    const [result] = ofKind(events, 'interceptResult');
    expect(result).toMatchObject({ hit: true, targetAffiliation: 'friend' });
    expect(sim.snapshot().stats.idErrors).toBe(1);
  });

  it('leaves a friendly aircraft alone when its transponder answers', () => {
    const sim = sky();
    sim.dispatch({
      kind: 'spawnTraffic',
      type: 'friendly',
      eastM: 0,
      northM: 25_000,
      headingRad: Math.PI,
    });
    const events = sim.run(50 * 90);
    // With a 90% reply rate per check, seed 1 answers at once.
    expect(ofKind(events, 'identified')[0]).toMatchObject({
      identity: 'friend',
      evidence: 'friendReply',
    });
    expect(ofKind(events, 'interceptorLaunched')).toHaveLength(0);
  });
});

describe('Step 6: fire channels and saturation', () => {
  it('never guides more engagements than it has fire channels', () => {
    const sim = sky({ defense: { fireChannels: 2 } });
    sim.dispatch({
      kind: 'spawnTraffic',
      type: 'swarm',
      eastM: 0,
      northM: 7_000,
      headingRad: Math.PI,
    });
    let peak = 0;
    for (let s = 0; s < 120; s++) {
      sim.run(25);
      const { used, total } = sim.snapshot().channels;
      expect(total).toBe(2);
      peak = Math.max(peak, used);
    }
    expect(peak).toBe(2);
  });
});

describe('Step 6: defended assets', () => {
  it('counts a leak at the asset a hostile reaches', () => {
    const plant = DEFAULT_ASSETS[2]?.position;
    const sim = sky({ defense: { launcherCapacity: 0 } });
    // A drone 6 km east of the power plant, flying west at it.
    sim.dispatch({
      kind: 'spawnTraffic',
      type: 'drone',
      eastM: (plant?.x ?? 0) + 6_000,
      northM: plant?.y ?? 0,
      headingRad: -Math.PI / 2,
    });
    const events = sim.run(50 * 200);
    const [threat] = ofKind(events, 'threatEvaluated');
    expect(threat?.assetId).toBe(2);
    const [leak] = ofKind(events, 'threatLeaked');
    expect(leak?.assetId).toBe(2);
  });
});

describe('Step 6: kill probability', () => {
  it('sometimes lets a target survive a burst within the lethal radius', () => {
    let survived = 0;
    let hits = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const sim = new Simulation({
        seed,
        autoTraffic: false,
        terrain: false,
        radar: IDEAL_SEARCH_RADAR,
      });
      jetInbound(sim);
      for (const e of ofKind(sim.run(50 * 50), 'interceptResult')) {
        if (e.reason === 'survived') survived++;
        if (e.hit) hits++;
        if (e.pk !== null) expect(e.pk).toBeGreaterThan(0.3);
      }
    }
    // A jet is agile and the interceptor is tired after a long flight: Pk is about 0.5 to 0.7.
    expect(survived).toBeGreaterThan(0);
    expect(hits).toBeGreaterThan(0);
    expect(hits / (hits + survived)).toBeGreaterThan(0.2);
    expect(hits / (hits + survived)).toBeLessThan(0.9);
  });

  it('replays rule changes and approvals exactly', () => {
    const sim = new Simulation({ seed: 21 });
    sim.dispatch({ kind: 'setRules', rules: { operatorMode: 'SEMI', weaponsControl: 'FREE' } });
    sim.run(50 * 40);
    const proposal = sim.snapshot().engagements.find((e) => e.state === 'proposed');
    if (proposal) sim.dispatch({ kind: 'approveEngagement', engagementId: proposal.id });
    sim.run(50 * 40);
    const replayed = Simulation.replay({ seed: 21 }, sim.commandLog(), sim.tick);
    expect(replayed.stateHash()).toBe(sim.stateHash());
  });
});
