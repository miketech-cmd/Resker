import Link from "next/link";

import { FoodIcon } from "@/components/icons/food-icons";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-ink">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-ink">
            <FoodIcon name="bowl" className="size-5" />
          </span>
          <span className="font-serif text-lg font-medium tracking-tight">Restaurant Tracker</span>
        </div>
        <Link href="/signin" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          Sign in
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 py-12">
        <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
          <FoodIcon name="noodles" className="size-3.5 text-accent" />
          <span>Your private tasting notebook</span>
        </div>

        <h1 className="font-serif text-4xl leading-[1.12] font-medium tracking-tight text-ink sm:text-5xl">
          Save spots from Google Maps. Remember what you ordered.
        </h1>

        <p className="mt-4 text-base leading-relaxed text-muted">
          Keep every restaurant you want to try, log visits and favourite dishes, organise lists,
          and see your places on a map — built for your phone.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/join" className={cn(buttonVariants({ variant: "primary", size: "lg" }))}>
            Join
          </Link>
          <Link href="/signin" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            Sign in
          </Link>
        </div>
      </main>

      <footer className="mx-auto flex w-full max-w-3xl items-center justify-between border-t border-border px-5 py-5 text-xs text-muted">
        <span>Restaurant Tracker</span>
        <div className="flex items-center gap-4">
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
        </div>
      </footer>
    </div>
  );
}
