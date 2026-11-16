"use client";

import {
  Check,
  Copy,
  Link2,
  Lock,
  RefreshCw,
  ShieldOff,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import {
  useInviteLibraryViewerMutation,
  useRemoveLibraryViewerMutation,
  useRevokeLibraryInviteTokenMutation,
  useRotateLibraryInviteTokenMutation,
  type LibraryViewerSummaryItem,
} from "@/lib/queries/shared-guides";
import { inviteLibraryViewerSchema } from "@/lib/validation/lists";

export function ShareLibrarySheet({
  viewers,
  inviteToken,
  myLibraryCount,
  open,
  onOpenChange,
}: {
  viewers: LibraryViewerSummaryItem[];
  inviteToken: string | null;
  myLibraryCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const inviteMutation = useInviteLibraryViewerMutation();
  const removeMutation = useRemoveLibraryViewerMutation();
  const rotateLinkMutation = useRotateLibraryInviteTokenMutation();
  const revokeLinkMutation = useRevokeLibraryInviteTokenMutation();

  const [username, setUsername] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invitePath = inviteToken ? `/lists/shared/invite/${inviteToken}` : null;

  async function handleCopyInviteLink() {
    if (!invitePath) return;
    const url =
      typeof window !== "undefined" ? `${window.location.origin}${invitePath}` : invitePath;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast("Private invite link copied.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast(`Invite link: ${invitePath}`);
    }
  }

  async function handleInviteByUsername(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = inviteLibraryViewerSchema.safeParse({ username });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid @username.");
      return;
    }

    try {
      const viewer = await inviteMutation.mutateAsync(parsed.data.username);
      setUsername("");
      toast(`Shared your live places guide with @${viewer.username || viewer.name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not share library.");
    }
  }

  async function handleRemoveViewer(viewer: LibraryViewerSummaryItem) {
    setError(null);
    try {
      await removeMutation.mutateAsync(viewer.userId);
      toast(`Removed @${viewer.username || viewer.name}'s access.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove viewer access.");
    }
  }

  async function handleCreateOrRotateLink() {
    setError(null);
    try {
      await rotateLinkMutation.mutateAsync();
      toast(
        inviteToken ? "Generated a fresh private invite link." : "Private invite link created.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create invite link.");
    }
  }

  async function handleRevokeLink() {
    setError(null);
    try {
      await revokeLinkMutation.mutateAsync();
      toast("Private invite link revoked.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke invite link.");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <div className="mb-4">
          <SheetTitle>Share your saved places</SheetTitle>
          <SheetDescription>
            Always-synced, read-only mirror of your {myLibraryCount}{" "}
            {myLibraryCount === 1 ? "spot" : "spots"}.
          </SheetDescription>
        </div>

        <div className="space-y-5 pb-3">
          <div className="flex items-start gap-2.5 rounded-2xl border border-border bg-surface-elevated/60 p-3 text-xs text-muted">
            <Lock className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
            <p>
              Private to invited users only — never listed publicly on Browse Guides. People you
              share with can browse and save restaurants, while your status, ratings, notes, and
              visits stay hidden.
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

          <section className="space-y-3 rounded-2xl border border-border bg-surface-elevated/35 p-3.5">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-accent" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-ink">Share with a person</p>
                <p className="text-xs text-muted">
                  They see your library live in their Shared Guides tab.
                </p>
              </div>
            </div>

            <form onSubmit={(e) => void handleInviteByUsername(e)} className="space-y-2 pt-1">
              <Label htmlFor="library-invite-username">Username</Label>
              <div className="flex gap-2">
                <Input
                  id="library-invite-username"
                  placeholder="@partner"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={inviteMutation.isPending || !username.trim()}
                  className="shrink-0 gap-1.5"
                >
                  <UserPlus className="size-3.5" aria-hidden="true" />
                  Share
                </Button>
              </div>
            </form>

            {viewers.length > 0 ? (
              <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
                {viewers.map((viewer) => (
                  <li
                    key={viewer.userId}
                    className="flex items-center justify-between gap-2 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{viewer.name}</p>
                      <p className="truncate text-xs text-muted">
                        @{viewer.username ?? viewer.userId.slice(0, 8)} · Read-only
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove ${viewer.username ?? viewer.name}`}
                      disabled={removeMutation.isPending}
                      onClick={() => void handleRemoveViewer(viewer)}
                      className="size-9 text-muted hover:text-danger"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted">Not shared with anyone yet.</p>
            )}
          </section>

          <section className="space-y-3 rounded-2xl border border-border bg-surface-elevated/35 p-3.5">
            <div className="flex items-start gap-2.5">
              <Link2 className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-ink">Private invite link</p>
                <p className="text-xs text-muted">
                  Send to your partner so they can sign in and accept access with one tap.
                </p>
              </div>
            </div>

            {invitePath ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    aria-label="Private invite link path"
                    value={invitePath}
                    className="h-9 font-mono text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleCopyInviteLink()}
                    className="shrink-0 gap-1.5"
                  >
                    {copied ? (
                      <>
                        <Check className="size-3.5 text-emerald-600" aria-hidden="true" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" aria-hidden="true" />
                        Copy link
                      </>
                    )}
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={rotateLinkMutation.isPending}
                    onClick={() => void handleCreateOrRotateLink()}
                    className="gap-1.5"
                  >
                    <RefreshCw className="size-3.5" aria-hidden="true" />
                    Rotate link
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={revokeLinkMutation.isPending}
                    onClick={() => void handleRevokeLink()}
                    className="gap-1.5 text-danger hover:bg-danger/10"
                  >
                    <ShieldOff className="size-3.5" aria-hidden="true" />
                    Revoke link
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={rotateLinkMutation.isPending}
                onClick={() => void handleCreateOrRotateLink()}
                className="gap-1.5"
              >
                <Link2 className="size-3.5" aria-hidden="true" />
                Create private invite link
              </Button>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
