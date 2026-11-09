import { Hand, Keyboard, MousePointerClick, Rotate3d, X } from 'lucide-react';
import { useId, useState } from 'react';
import { GithubMark } from '../components/marks';
import { VERSION } from '../data/buildHistory';
import { REPO_URL } from '../data/links';
import { parseViewOptions } from '../view/viewParams';

const STORAGE_KEY = 'ads.welcomeDismissed';

function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false; // storage blocked (private mode, sandboxed embeds): show the card
  }
}

function rememberDismissed(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Nothing to do: the card will simply show again next time.
  }
}

const TIPS = [
  { icon: Hand, text: 'Drag a threat from the palette onto the 3D view or the radar scope' },
  { icon: MousePointerClick, text: 'Click an aircraft, a radar echo or a log line to inspect it' },
  { icon: Rotate3d, text: 'Drag to orbit, scroll or pinch to zoom, right-drag to pan' },
  { icon: Keyboard, text: 'Space plays and pauses · 1–4 switch cameras · Esc clears' },
] as const;

/** First-visit introduction over the 3D view. Dismissed once, it stays dismissed. */
export function WelcomeCard() {
  const titleId = useId();
  const [open, setOpen] = useState(
    () => parseViewOptions(window.location.search).welcome && !wasDismissed(),
  );
  if (!open) return null;

  const dismiss = () => {
    setOpen(false);
    rememberDismissed();
  };

  return (
    <aside
      aria-labelledby={titleId}
      data-testid="welcome-card"
      className="pointer-events-auto absolute bottom-2 left-2 z-20 w-[min(25rem,calc(100%-1rem))] rounded-xl border border-accent/30 bg-ink-900/90 p-4 shadow-2xl shadow-black/50 backdrop-blur"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Close the welcome card"
        className="absolute top-2 right-2 grid size-7 place-items-center rounded-md text-ink-300 transition-colors hover:text-ink-100"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
        Open source · Version {VERSION}
      </p>
      <h2 id={titleId} className="mt-1 pr-6 text-[17px] font-semibold leading-snug text-ink-100">
        See how an <span className="whitespace-nowrap">air-defense</span> system thinks.
      </h2>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-200">
        A generic defense battery sits at the centre. Drop a drone, a missile or a jet anywhere and
        watch it detect, track, identify and engage, while the radar scope shows only what the radar
        has seen.
      </p>
      <ul className="mt-2.5 space-y-1.5 text-[12px] text-ink-200">
        {TIPS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-2">
            <Icon aria-hidden="true" className="mt-px size-3.5 shrink-0 text-accent" />
            {text}
          </li>
        ))}
      </ul>
      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-ink-950 shadow-lg shadow-accent/20 transition hover:brightness-110"
        >
          Start exploring
        </button>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-ink-600 px-3 py-1.5 text-[12.5px] font-semibold text-ink-100 transition hover:border-accent/50"
        >
          <GithubMark className="size-3.5" />
          Follow the build
        </a>
      </div>
    </aside>
  );
}
