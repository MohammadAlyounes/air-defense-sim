import { describe, expect, it } from 'vitest';
import pkg from '../../../package.json';
import { BUILD_STEPS, VERSION } from './buildHistory';
import { STAGES } from './stages';

describe('defense loop stages', () => {
  it('runs in the seven-stage order', () => {
    expect(STAGES.map((s) => s.id)).toEqual([
      'detect',
      'track',
      'identify',
      'evaluate',
      'assign',
      'engage',
      'assess',
    ]);
  });

  it('explains every stage in a short, plain sentence or two', () => {
    for (const stage of STAGES) {
      expect(stage.description.length).toBeGreaterThan(40);
      expect(stage.description.length).toBeLessThan(160);
    }
  });
});

describe('build history', () => {
  it('numbers the six build steps 0 to 5 without gaps', () => {
    expect(BUILD_STEPS.map((s) => s.step)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('carries the version in package.json', () => {
    expect(VERSION).toBe(pkg.version);
  });
});
