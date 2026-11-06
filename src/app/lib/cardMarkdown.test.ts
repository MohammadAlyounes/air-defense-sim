import { describe, expect, it } from 'vitest';
import antennaRotation from '../../../docs/concepts/01-2-antenna-rotation.md?raw';
import fixedTimeStep from '../../../docs/concepts/01-1-fixed-time-step.md?raw';
import { parseConceptCard, parseInline } from './cardMarkdown';

describe('parseConceptCard', () => {
  it('reads title, hook, paragraph and facts, and stops at the "more" marker', () => {
    const card = parseConceptCard(
      [
        '### Radar horizon — why low flyers hide',
        '',
        'The Earth curves away.',
        'Radio waves bend a little.',
        '',
        '- **Formula:** `d ≈ 4.12 (√h1 + √h2)`',
        '- **Example:** 43 km',
        '',
        '<!-- more -->',
        '## Going deeper',
        'Not part of the card.',
      ].join('\n'),
    );
    expect(card).toEqual({
      title: 'Radar horizon',
      hook: 'why low flyers hide',
      paragraphs: ['The Earth curves away. Radio waves bend a little.'],
      facts: [
        { label: 'Formula', text: '`d ≈ 4.12 (√h1 + √h2)`' },
        { label: 'Example', text: '43 km' },
      ],
    });
  });

  it('parses every concept card in docs/concepts', () => {
    for (const markdown of [fixedTimeStep, antennaRotation]) {
      const card = parseConceptCard(markdown);
      expect(card.title.length).toBeGreaterThan(3);
      expect(card.hook.length).toBeGreaterThan(3);
      expect(card.paragraphs).toHaveLength(1);
      expect(card.facts.map((fact) => fact.label)).toEqual(['Formula', 'Example', 'See it']);
    }
  });
});

describe('parseInline', () => {
  it('splits text into plain, bold and code parts', () => {
    expect(parseInline('a **b** `c` _d_ e')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'bold', text: 'b' },
      { kind: 'text', text: ' ' },
      { kind: 'code', text: 'c' },
      { kind: 'text', text: ' ' },
      { kind: 'text', text: 'd' },
      { kind: 'text', text: ' e' },
    ]);
  });
});
