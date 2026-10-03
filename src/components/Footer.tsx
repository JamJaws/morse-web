import { FaGithub, FaHeart } from 'react-icons/fa';

const linkClassName =
  'inline-flex min-h-11 items-center gap-1.5 rounded-sm underline decoration-transparent underline-offset-4 transition-colors hover:text-accent hover:decoration-current motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent';

export function Footer() {
  return (
    <footer className="shrink-0 px-4 pt-2 pb-6 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 text-xs text-muted">
        <p className="inline-flex items-center gap-1.5">
          Made with
          <FaHeart aria-hidden="true" className="text-danger" />
          <span className="sr-only">love</span>
          by
          <a
            href="https://jamjaws.com/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="JamJaws (opens in a new tab)"
            className={linkClassName}
          >
            JamJaws
          </a>
        </p>
        <span aria-hidden="true">·</span>
        <a
          href="https://github.com/JamJaws/morse-web"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Morse on GitHub (opens in a new tab)"
          className={linkClassName}
        >
          <FaGithub aria-hidden="true" />
          GitHub
        </a>
      </div>
    </footer>
  );
}
