import { ShieldCheck } from 'lucide-react';
import { AUTHOR, DESIGN_URL, REPO_URL, SAFETY_URL } from '../data/links';

export function Footer() {
  return (
    <footer className="shrink-0 border-t border-ink-800 px-3 py-1.5 text-[11px] text-ink-300">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="flex items-center gap-1.5">
          <ShieldCheck aria-hidden="true" className="size-3.5 shrink-0 text-ok" />
          Educational simulation with generic, fictional equipment and terrain. It does not model
          any real system.
        </p>
        <nav aria-label="Project links" className="flex gap-3 sm:ml-auto">
          <a className="hover:text-accent" href={DESIGN_URL} target="_blank" rel="noreferrer">
            Design
          </a>
          <a className="hover:text-accent" href={SAFETY_URL} target="_blank" rel="noreferrer">
            Safety &amp; scope
          </a>
          <a className="hover:text-accent" href={REPO_URL} target="_blank" rel="noreferrer">
            Source code
          </a>
        </nav>
        <p>
          © {AUTHOR.copyrightYear}{' '}
          <a
            className="text-ink-200 hover:text-accent"
            href={AUTHOR.url}
            target="_blank"
            rel="noreferrer author"
          >
            {AUTHOR.name}
          </a>{' '}
          · MIT License
        </p>
      </div>
    </footer>
  );
}
