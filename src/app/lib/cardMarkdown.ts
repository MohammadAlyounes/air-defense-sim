/**
 * Parses the small Markdown subset used by concept cards (docs/concepts/*.md) so the app can
 * show the exact same text as the README, rendered as React elements (never raw HTML).
 */

export interface ConceptCardData {
  title: string;
  hook: string;
  paragraphs: string[];
  facts: { label: string; text: string }[];
}

/** Inline pieces: plain text, **bold** or `code`. */
export type InlinePart = { kind: 'text' | 'bold' | 'code'; text: string };

/** Only the part above `<!-- more -->` is the card; the rest is for the docs. */
export function parseConceptCard(markdown: string): ConceptCardData {
  const card = markdown.split('<!-- more -->')[0] ?? '';
  const lines = card.split('\n').map((line) => line.trim());

  const heading = lines.find((line) => line.startsWith('### ')) ?? '### Untitled';
  const [title = '', hook = ''] = heading.slice(4).split(' — ');

  const paragraphs: string[] = [];
  const facts: ConceptCardData['facts'] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) paragraphs.push(paragraph.join(' '));
    paragraph = [];
  };

  for (const line of lines) {
    if (line.startsWith('### ') || line === '') {
      flush();
    } else if (line.startsWith('- ')) {
      flush();
      const match = /^- \*\*(.+?):\*\*\s*(.*)$/.exec(line);
      if (match) facts.push({ label: match[1] ?? '', text: match[2] ?? '' });
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return { title: title.trim(), hook: hook.trim(), paragraphs, facts };
}

/** Splits a line into text, **bold** and `code` parts. */
export function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const pattern = /\*\*(.+?)\*\*|`([^`]+)`|_(.+?)_/g;
  let last = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > last) parts.push({ kind: 'text', text: text.slice(last, match.index) });
    if (match[1] !== undefined) parts.push({ kind: 'bold', text: match[1] });
    else if (match[2] !== undefined) parts.push({ kind: 'code', text: match[2] });
    else parts.push({ kind: 'text', text: match[3] ?? '' });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) });
  return parts;
}
