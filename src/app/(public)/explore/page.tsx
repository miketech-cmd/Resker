import Link from "next/link";

import { FoodIcon } from "@/components/icons/food-icons";
import { PublicListBrowse } from "@/components/lists/public-list-browse";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getOptionalUser } from "@/server/auth-guard";
import { getPublicLists } from "@/server/lists";

export const dynamic = "force-dynamic";

export default async function ExplorePublicListsPage() {
  const user = await getOptionalUser();
  const initialLists = await getPublicLists(user?.id ?? null);

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
          {user ? (
            <Link
              href="/lists?tab=browse"
              className={cn(buttonVariants({ variant: "primary", size: "sm" }))}
            >
              My Lists
            </Link>
          ) : (
            <>
              <Link href="/signin" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                Sign in
              </Link>
              <Link href="/join" className={cn(buttonVariants({ variant: "primary", size: "sm" }))}>
                Join
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-4 pb-12 sm:px-6">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-ink">
            Explore Public Lists
          </h1>
          <p className="mt-1 text-sm text-muted">
            Curated vegetarian-friendly city guides and community favorites. Save individual spots
            or clone an entire list into your Places.
          </p>
        </div>

        <PublicListBrowse
          initialLists={initialLists}
          detailBasePath="/s"
          viewerSignedIn={Boolean(user)}
        />
      </main>
    </div>
  );
}
