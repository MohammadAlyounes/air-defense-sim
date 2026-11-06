// Copies the short concept cards from docs/concepts/NN-*.md into README.md, between the
// `concepts:start` and `concepts:end` markers. The part of each file above `<!-- more -->`
// is the card; the rest stays in the docs ("Going deeper").
//
//   npm run docs:sync     update README.md
//   npm run docs:check    fail if README.md is out of date (run in CI)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const START = '<!-- concepts:start -->';
const END = '<!-- concepts:end -->';
const check = process.argv.includes('--check');

const files = readdirSync('docs/concepts')
  .filter((file) => /^\d{2}-.+\.md$/.test(file))
  .sort();

const cards = files.map((file) => {
  const card = readFileSync(`docs/concepts/${file}`, 'utf8').split('<!-- more -->')[0].trim();
  return `${card}\n\n[Going deeper →](docs/concepts/${file})`;
});

const block = [
  START,
  '<!-- Generated from docs/concepts by `npm run docs:sync`. Edit the cards there. -->',
  '',
  ...cards.flatMap((card) => [card, '']),
  END,
].join('\n');

const readme = readFileSync('README.md', 'utf8');
const start = readme.indexOf(START);
const end = readme.indexOf(END);
if (start === -1 || end === -1 || end < start) {
  console.error(`README.md needs the markers ${START} and ${END}.`);
  process.exit(1);
}

const updated = readme.slice(0, start) + block + readme.slice(end + END.length);
if (check) {
  if (updated !== readme) {
    console.error('README concept cards are out of date. Run `npm run docs:sync`.');
    process.exit(1);
  }
  console.log(`README concept cards are up to date (${cards.length} cards).`);
} else {
  writeFileSync('README.md', updated);
  console.log(`Synced ${cards.length} concept cards into README.md.`);
}
