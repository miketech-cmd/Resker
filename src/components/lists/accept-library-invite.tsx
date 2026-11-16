"use client";

import { ArrowLeft, Check, Lock, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { useAcceptLibraryInviteMutation } from "@/lib/queries/shared-guides";
import type { LibraryInvitePreviewData } from "@/server/library-shares";

export function AcceptLibraryInvite({ preview }: { preview: LibraryInvitePreviewData }) {
  const router = useRouter();
  const acceptMutation = useAcceptLibraryInviteMutation();
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setError(null);
    try {
      const res = await acceptMutation.mutateAsync(preview.token);
      toast(`Added ${res.ownerName}'s Saved Places to Shared Guides.`);
      router.push(`/lists/shared/${encodeURIComponent(res.ownerId)}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept invite.");
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 py-8 sm:px-6">
      <Link
        href="/lists?tab=shared"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Shared Guides
      </Link>

      <Card className="space-y-5 p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <Users className="size-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-medium tracking-wide text-muted uppercase">
              Private Live Library Invite
            </p>
            <h1 className="mt-0.5 font-serif text-2xl font-medium text-ink">
              {preview.ownerName}&apos;s Saved Places
            </h1>
            <p className="mt-0.5 text-xs text-muted">
              {preview.ownerUsername ? `@${preview.ownerUsername} · ` : ""}
              {preview.itemCount} {preview.itemCount === 1 ? "spot" : "spots"} saved
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-elevated/60 p-3 text-xs text-muted">
          <Lock className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
          <p>
            Read-only live mirror: new restaurants {preview.ownerName} saves will appear
            automatically in your Shared Guides tab, without exposing their ratings, status, or
            personal notes.
          </p>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
          >
            {error}
          </p>
        ) : null}

        {preview.isOwnLink ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              This is your own invite link. Send it to your partner so they can sign in and connect.
            </p>
            <Link href="/lists?tab=shared" className={buttonVariants({ className: "w-full" })}>
              Back to Shared Guides
            </Link>
          </div>
        ) : preview.alreadyConnected ? (
          <Link
            href={`/lists/shared/${encodeURIComponent(preview.ownerId)}`}
            className={buttonVariants({ className: "w-full gap-1.5" })}
          >
            <Check className="size-4" aria-hidden="true" />
            Already connected · Open guide
          </Link>
        ) : (
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={acceptMutation.isPending}
            onClick={() => void handleAccept()}
          >
            {acceptMutation.isPending ? "Connecting..." : "Accept & Open Shared Guide"}
          </Button>
        )}
      </Card>
    </div>
  );
}
