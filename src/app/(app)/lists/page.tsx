import { EmptyState } from "@/components/ui/empty-state";

export default function ListsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <header className="mb-5">
        <h1 className="font-serif text-3xl font-medium tracking-tight text-ink">Lists</h1>
        <p className="mt-1 text-sm text-muted">
          Group spots into collections like &ldquo;NY 2026 Travel&rdquo; or &ldquo;Date
          Night&rdquo;.
        </p>
      </header>

      <EmptyState
        title="No lists yet"
        description="Custom lists, food icons, and drag-to-reorder arrive in Phase 5."
      />
    </div>
  );
}
