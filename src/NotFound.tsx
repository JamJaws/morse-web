import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-canvas p-6 text-center text-ink">
      <p aria-hidden="true" className="font-mono text-accent">
        ....- ----- ....-
      </p>
      <h1 className="text-3xl font-semibold">Signal not found</h1>
      <p className="text-muted">This page does not exist.</p>
      <Link
        to="/"
        className="rounded-xl bg-accent px-5 py-3 font-semibold text-accent-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        Back to Morse
      </Link>
    </main>
  );
}
