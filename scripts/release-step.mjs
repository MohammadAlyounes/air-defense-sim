// Creates the git tags and GitHub Releases that commits ask for with a trailer such as:
//
//   Step-Tag: step-03-first-intercept
//   Step-Tag: v1.0.0
//
// Runs in CI (.github/workflows/ci.yml) after a push to main whose head commit carries a
// trailer. Every commit in the push is read from the push event, so a pull request merged
// with "Rebase and merge" releases each tagged commit in it, at that commit, oldest first.
// One commit may carry several trailers (a step and a version released together), and when
// several commits of the push name the same tag, the newest of them gets it.
//
// Release notes come from the matching entry in docs/DEVLOG.md ("## Step 3 · ..." for a step,
// "## v1.0.0 · ..." for a version), with a screenshot on top: docs/media/<tag>.png, or for a
// version without one, the screenshot of a step released by the same commit.
//
// An existing release is left alone, unless its commit also carries `Step-Retag: true`: then
// the old release and tag are removed and recreated at that commit (used for a late fix to a
// release that has already shipped).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const repo = process.env.GITHUB_REPOSITORY;
const TAG_TRAILER = /^Step-Tag:\s*(step-\d{2}-[a-z0-9-]+|v\d+\.\d+\.\d+)\s*$/gm;

const gh = (...args) =>
  execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

// When several commits of one push name the same tag, the newest one wins.
const requests = new Map();
for (const { sha, message } of pushedCommits()) {
  const tags = [...message.matchAll(TAG_TRAILER)].map((match) => match[1]);
  const retag = /^Step-Retag:\s*(true|yes)\s*$/im.test(message);
  for (const tag of tags) {
    requests.delete(tag);
    requests.set(tag, { sha, tag, retag, siblings: tags });
  }
}
if (requests.size === 0) {
  console.log('No valid Step-Tag trailer in this push; nothing to release.');
  process.exit(0);
}
for (const request of requests.values()) release(request);

/** The commits of this push, oldest first: from the push event, or the head commit alone. */
function pushedCommits() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath && existsSync(eventPath)) {
    const event = JSON.parse(readFileSync(eventPath, 'utf8'));
    const commits = (event.commits ?? []).map((commit) => ({
      sha: commit.id,
      message: commit.message ?? '',
    }));
    if (commits.length > 0) return commits;
  }
  return [{ sha: process.env.GITHUB_SHA, message: process.env.COMMIT_MESSAGE ?? '' }];
}

function release({ sha, tag, retag, siblings }) {
  let exists = true;
  try {
    gh('release', 'view', tag);
  } catch {
    exists = false;
  }
  if (exists && !retag) {
    console.log(`Release ${tag} already exists; nothing to do.`);
    return;
  }
  if (exists) {
    gh('release', 'delete', tag, '--cleanup-tag', '--yes');
    console.log(`Removed the previous ${tag} release and tag; recreating them at ${sha}.`);
  }

  const entry = devlogEntry(tag) ?? { title: tag, body: '' };
  const screenshot = screenshotFor(tag, siblings);
  const notes = [
    screenshot
      ? `![${entry.title}](https://raw.githubusercontent.com/${repo}/${tag}/${screenshot})\n`
      : '',
    entry.body.trim() || 'See docs/DEVLOG.md for details.',
    '',
    `Full devlog: [docs/DEVLOG.md](https://github.com/${repo}/blob/${tag}/docs/DEVLOG.md)`,
  ].join('\n');

  const notesFile = join(tmpdir(), `${tag}-notes.md`);
  writeFileSync(notesFile, notes);
  // A just-deleted tag can take a moment to disappear, so retry creation a few times.
  for (let attempt = 1; ; attempt++) {
    try {
      gh(
        'release',
        'create',
        tag,
        '--target',
        sha,
        '--title',
        entry.title,
        '--notes-file',
        notesFile,
      );
      break;
    } catch (error) {
      if (attempt >= 3) throw error;
      console.log(`Creating the release failed (attempt ${attempt}); retrying in 5 s.`);
      execFileSync('sleep', ['5']);
    }
  }
  console.log(`Released ${tag} at ${sha}: ${entry.title}`);
}

/** The tag's own screenshot, or for a version, that of a step released by the same commit. */
function screenshotFor(tag, siblings) {
  const own = `docs/media/${tag}.png`;
  if (existsSync(own)) return own;
  if (!tag.startsWith('v')) return null;
  const step = siblings.find((other) => other !== tag && existsSync(`docs/media/${other}.png`));
  return step ? `docs/media/${step}.png` : null;
}

/** Returns the devlog section for a tag ("## Step N · Title (date)" or "## vX.Y.Z · Title"). */
function devlogEntry(tag) {
  if (!existsSync('docs/DEVLOG.md')) return null;
  const step = tag.match(/^step-(\d{2})-/);
  const heading = step ? `## Step ${Number(step[1])} ·` : `## ${tag} ·`;
  const lines = readFileSync('docs/DEVLOG.md', 'utf8').split('\n');
  const start = lines.findIndex((line) => line.startsWith(heading));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('## '));
  const body = (end === -1 ? rest : rest.slice(0, end)).join('\n');
  const title = lines[start].replace(/^## /, '').replace(/\s*\(\d{4}-\d{2}-\d{2}\)\s*$/, '');
  return { title, body };
}
