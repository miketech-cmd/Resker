import Link from "next/link";
import { notFound } from "next/navigation";

import { FoodIcon } from "@/components/icons/food-icons";
import { PublicListDetail } from "@/components/lists/public-list-detail";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getOptionalUser } from "@/server/auth-guard";
import { getPublicListBySlug } from "@/server/lists";

export const dynamic = "force-dynamic";

export default async function PublicShareListPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getOptionalUser();
  const detail = await getPublicListBySlug(slug, user?.id ?? null);
  if (!detail) {
    notFound();
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-ink">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-ink">
            <FoodIcon name="bowl" className="size-5" />
          </span>
          <span className="font-serif text-lg font-medium tracking-tight">Restaurant Tracker</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link href="/explore" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            Explore
          </Link>
          {user ? (
            <Link href="/lists" className={cn(buttonVariants({ variant: "primary", size: "sm" }))}>
              My Lists
            </Link>
          ) : (
            <Link
              href={`/signin?next=${encodeURIComponent(`/s/${slug}`)}`}
              className={cn(buttonVariants({ variant: "primary", size: "sm" }))}
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 pb-12">
        <PublicListDetail
          initialDetail={detail}
          viewerSignedIn={Boolean(user)}
          backHref={user ? "/lists?tab=browse" : "/explore"}
          backLabel={user ? "Browse guides" : "All public lists"}
        />
      </main>
    </div>
  );
}
