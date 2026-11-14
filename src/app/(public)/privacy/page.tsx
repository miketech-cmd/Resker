import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-ink">
      <Link href="/" className="text-sm font-medium text-accent hover:underline">
        ← Back
      </Link>
      <h1 className="mt-4 font-serif text-3xl font-medium tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted">Last updated: November 12, 2026</p>

      <div className="mt-6 space-y-4 text-sm leading-relaxed text-ink/90">
        <p>
          We collect only the name, username, and password hash needed to authenticate your account,
          along with the restaurants, ratings, visits, and lists you explicitly save.
        </p>
        <p>
          Your saved restaurant records, visits, and tasting notes are private to your account
          unless you explicitly share a list (P1).
        </p>
        <p>
          Map rendering and place lookup use Google Maps Platform and are subject to the{" "}
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
      </div>
    </main>
  );
}
