import { describe, expect, it } from 'vitest';
import { ROADMAP, CURRENT_STEP, LAST_STEP, roadmapStep } from './roadmap';
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

describe('roadmap', () => {
  it('numbers steps 0 to 8 without gaps', () => {
    expect(ROADMAP.map((s) => s.step)).toEqual(Array.from({ length: 9 }, (_, i) => i));
    expect(LAST_STEP).toBe(8);
  });

  it('points the current step at a real roadmap entry', () => {
    expect(roadmapStep(CURRENT_STEP)).toBeDefined();
    expect(roadmapStep(99)).toBeUndefined();
  });
});
