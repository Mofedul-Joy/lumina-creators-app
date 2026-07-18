// Themed 404 — a mistyped URL stays inside the Lumina dark theme.
export default function NotFound() {
  return (
    <div
      className="grid min-h-screen place-items-center p-6"
      style={{ background: "var(--color-bg)", color: "var(--color-text)" }}
    >
      <div className="w-full max-w-md text-center">
        <p className="text-sm font-semibold tracking-wide" style={{ color: "var(--color-brand)" }}>
          404
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Page not found.</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6" style={{ color: "var(--color-text-secondary)" }}>
          That link doesn&apos;t exist or may have moved.
        </p>
        <div className="mt-6 flex items-center justify-center">
          <a
            href="/"
            className="rounded-full px-5 py-2.5 text-sm font-semibold transition"
            style={{ background: "var(--color-brand)", color: "var(--color-on-brand)" }}
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
