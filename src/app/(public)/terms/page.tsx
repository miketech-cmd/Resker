import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-ink">
      <Link href="/" className="text-sm font-medium text-accent hover:underline">
        ← Back
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-medium tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted">Last updated: November 15, 2026</p>

      <div className="mt-6 space-y-4 text-sm leading-relaxed text-ink/90">
        <p>
          Restaurant Tracker is a personal, non-commercial web app for saving restaurants and
          tracking personal dining notes.
        </p>
        <p>
          Maps and place lookup features use Google Maps Platform. By using this app, you agree to
          be bound by the{" "}
          <a
            href="https://maps.google.com/help/terms_maps/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent underline"
          >
            Google Maps/Google Earth Additional Terms of Service
          </a>{" "}
          and{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent underline"
          >
            Google Privacy Policy
          </a>
          .
        </p>
        <p>
          You are responsible for the content and notes you save in your account. Access may be
          rate-limited to protect shared Google Maps Platform free-tier quotas.
        </p>
      </div>
    </main>
  );
}
