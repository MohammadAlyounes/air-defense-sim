// Creates the git tag and GitHub Release for a completed roadmap step. Runs in CI
// (.github/workflows/ci.yml) when the pushed commit message carries a trailer such as:
//
//   Step-Tag: step-03-first-intercept
//
// Release notes come from that step's entry in docs/DEVLOG.md ("## Step 3 · ..."),
// with the step screenshot (docs/media/<tag>.png) on top when it exists.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const message = process.env.COMMIT_MESSAGE ?? '';
const sha = process.env.GITHUB_SHA;
const repo = process.env.GITHUB_REPOSITORY;

const match = message.match(/^Step-Tag:\s*(step-(\d{2})-[a-z0-9-]+|v\d+\.\d+\.\d+)\s*$/m);
if (!match) {
  console.log('No valid Step-Tag trailer; nothing to release.');
  process.exit(0);
}
const tag = match[1];
const stepNumber = match[2] === undefined ? null : Number(match[2]);

const gh = (...args) =>
  execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

try {
  gh('release', 'view', tag);
  console.log(`Release ${tag} already exists; nothing to do.`);
  process.exit(0);
} catch {
  // Not released yet: carry on.
}

const entry = devlogEntry(stepNumber) ?? { title: tag, body: '' };
const screenshot = `docs/media/${tag}.png`;
const notes = [
  existsSync(screenshot)
    ? `![${entry.title}](https://raw.githubusercontent.com/${repo}/${tag}/${screenshot})\n`
    : '',
  entry.body.trim() || 'See docs/DEVLOG.md for details.',
  '',
  `Full devlog: [docs/DEVLOG.md](https://github.com/${repo}/blob/${tag}/docs/DEVLOG.md)`,
].join('\n');

const notesFile = join(tmpdir(), `${tag}-notes.md`);
writeFileSync(notesFile, notes);
gh('release', 'create', tag, '--target', sha, '--title', entry.title, '--notes-file', notesFile);
console.log(`Released ${tag}: ${entry.title}`);

/** Returns the "## Step N · Title (date)" section of the devlog as { title, body }. */
function devlogEntry(step) {
  if (step === null || !existsSync('docs/DEVLOG.md')) return null;
  const lines = readFileSync('docs/DEVLOG.md', 'utf8').split('\n');
  const start = lines.findIndex((line) => line.startsWith(`## Step ${step} ·`));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('## '));
  const body = (end === -1 ? rest : rest.slice(0, end)).join('\n');
  const title = lines[start].replace(/^## /, '').replace(/\s*\(\d{4}-\d{2}-\d{2}\)\s*$/, '');
  return { title, body };
}
