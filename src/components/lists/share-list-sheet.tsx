"use client";

import { Check, Copy, Globe, RefreshCw, ShieldOff, Trash2, UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import {
  useInviteListMemberMutation,
  useRemoveListMemberMutation,
  useUpdateListMemberRoleMutation,
  useUpdateListMutation,
  type ListMemberItem,
  type ListSummaryItem,
} from "@/lib/queries/lists";
import { cn } from "@/lib/utils";
import { inviteListMemberSchema, type ListMemberRole } from "@/lib/validation/lists";

export function ShareListSheet({
  list,
  members,
  currentUserId,
  open,
  onOpenChange,
}: {
  list: ListSummaryItem;
  members: ListMemberItem[];
  currentUserId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const isOwner = !list.viewerRole || list.viewerRole === "owner";

  const updateListMutation = useUpdateListMutation();
  const inviteMutation = useInviteListMemberMutation(list.id);
  const updateRoleMutation = useUpdateListMemberRoleMutation(list.id);
  const removeMemberMutation = useRemoveListMemberMutation(list.id);

  const [username, setUsername] = useState("");
  const [role, setRole] = useState<ListMemberRole>("editor");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sharePath = list.publicSlug ? `/s/${list.publicSlug}` : null;

  async function handleCopyLink() {
    if (!sharePath) return;
    const url = typeof window !== "undefined" ? `${window.location.origin}${sharePath}` : sharePath;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast("Share link copied.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast(`Share URL: ${sharePath}`);
    }
  }

  async function handleTogglePublic() {
    setError(null);
    try {
      const updated = await updateListMutation.mutateAsync({
        id: list.id,
        data: { isPublic: !list.isPublic },
      });
      toast(updated.isPublic ? "Public share link created." : "List made private.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update sharing setting.");
    }
  }

  async function handleRegenerateSlug() {
    setError(null);
    try {
      await updateListMutation.mutateAsync({
        id: list.id,
        data: { regenerateSlug: true },
      });
      toast("Generated a fresh 12-character share link. Previous links no longer work.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not regenerate share link.");
    }
  }

  async function handleRevokeSlug() {
    setError(null);
    try {
      await updateListMutation.mutateAsync({
        id: list.id,
        data: { revokeSlug: true },
      });
      toast("Share link revoked and list set to private.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke share link.");
    }
  }

  async function handleInvite(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = inviteListMemberSchema.safeParse({ username, role });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid @username.");
      return;
    }

    try {
      const member = await inviteMutation.mutateAsync(parsed.data);
      setUsername("");
      toast(`Added @${member.username} as ${member.role}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not invite collaborator.");
    }
  }

  async function handleRoleChange(member: ListMemberItem, nextRole: ListMemberRole) {
    if (member.role === nextRole) return;
    setError(null);
    try {
      await updateRoleMutation.mutateAsync({ userId: member.userId, role: nextRole });
      toast(`Updated @${member.username} to ${nextRole}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update member role.");
    }
  }

  async function handleRemoveMember(member: ListMemberItem) {
    setError(null);
    try {
      await removeMemberMutation.mutateAsync(member.userId);
      toast(`Removed @${member.username} from "${list.name}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove member.");
    }
  }

  async function handleLeaveList() {
    if (!currentUserId) return;
    setError(null);
    try {
      await removeMemberMutation.mutateAsync(currentUserId);
      onOpenChange(false);
      toast(`Left "${list.name}".`);
      router.push("/lists");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not leave list.");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <div className="mb-4">
          <SheetTitle>Share &amp; collaborate</SheetTitle>
          <SheetDescription>
            Manage the public link and collaborators for{" "}
            <span className="font-medium text-ink">{list.name}</span>.
          </SheetDescription>
        </div>

        <div className="space-y-5 pb-3">
          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          ) : null}

          <section className="space-y-3 rounded-2xl border border-border bg-surface-elevated/45 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Globe className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-ink">Public link</p>
                  <p className="text-xs text-muted">
                    {list.isPublic
                      ? "Anyone with the link can view and save spots."
                      : "Private to you and invited collaborators."}
                  </p>
                </div>
              </div>

              {isOwner ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(list.isPublic)}
                  aria-label="Toggle public share link"
                  disabled={updateListMutation.isPending}
                  onClick={() => void handleTogglePublic()}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                    list.isPublic ? "border-accent bg-accent" : "border-border bg-surface-elevated",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block size-4 rounded-full bg-white shadow-xs transition-transform",
                      list.isPublic ? "translate-x-5.5" : "translate-x-1",
                    )}
                  />
                </button>
              ) : null}
            </div>

            {list.isPublic && sharePath ? (
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    aria-label="Public share URL path"
                    value={sharePath}
                    className="h-9 font-mono text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleCopyLink()}
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

                {isOwner ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={updateListMutation.isPending}
                      onClick={() => void handleRegenerateSlug()}
                      className="gap-1.5"
                    >
                      <RefreshCw className="size-3.5" aria-hidden="true" />
                      Regenerate link
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={updateListMutation.isPending}
                      onClick={() => void handleRevokeSlug()}
                      className="gap-1.5 text-danger hover:bg-danger/10"
                    >
                      <ShieldOff className="size-3.5" aria-hidden="true" />
                      Revoke link
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : !isOwner ? (
              <p className="text-xs text-muted">This list does not currently have a public link.</p>
            ) : null}
          </section>

          <section className="space-y-3 rounded-2xl border border-border bg-surface-elevated/35 p-3.5">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-accent" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-ink">Collaborators</p>
                <p className="text-xs text-muted">
                  Editors can add, remove, and reorder spots. Private ratings stay private.
                </p>
              </div>
            </div>

            {isOwner ? (
              <form onSubmit={(e) => void handleInvite(e)} className="space-y-2.5 pt-1">
                <div>
                  <Label htmlFor="invite-username">Invite by username</Label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      id="invite-username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="@friend"
                      autoCapitalize="none"
                      autoCorrect="off"
                      className="h-9"
                    />
                    <select
                      aria-label="Collaborator role"
                      value={role}
                      onChange={(e) => setRole(e.target.value as ListMemberRole)}
                      className="h-9 rounded-xl border border-border bg-surface px-2.5 text-xs font-medium text-ink focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={inviteMutation.isPending || !username.trim()}
                      className="shrink-0 gap-1"
                    >
                      <UserPlus className="size-3.5" aria-hidden="true" />
                      {inviteMutation.isPending ? "Adding..." : "Invite"}
                    </Button>
                  </div>
                </div>
              </form>
            ) : null}

            <ul className="space-y-2" aria-label="List members">
              {list.ownerName || list.ownerUsername ? (
                <li className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {list.ownerName ?? `@${list.ownerUsername}`}
                    </p>
                    {list.ownerUsername ? (
                      <p className="truncate text-xs text-muted">@{list.ownerUsername}</p>
                    ) : null}
                  </div>
                  <span className="rounded-full border border-border bg-surface-elevated px-2.5 py-0.5 text-[11px] font-medium text-muted">
                    Owner
                  </span>
                </li>
              ) : null}

              {members.length === 0 ? (
                <li className="rounded-xl border border-dashed border-border px-3 py-3 text-xs text-muted">
                  No collaborators invited yet.
                </li>
              ) : (
                members.map((member) => (
                  <li
                    key={member.userId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {member.name}
                        {currentUserId && member.userId === currentUserId ? " (you)" : ""}
                      </p>
                      {member.username ? (
                        <p className="truncate text-xs text-muted">@{member.username}</p>
                      ) : null}
                    </div>

                    {isOwner ? (
                      <div className="flex items-center gap-1.5">
                        <div
                          className="inline-flex rounded-full border border-border bg-surface-elevated p-0.5 text-[11px]"
                          role="group"
                          aria-label={`Role for @${member.username}`}
                        >
                          <button
                            type="button"
                            disabled={updateRoleMutation.isPending}
                            onClick={() => void handleRoleChange(member, "editor")}
                            className={cn(
                              "cursor-pointer rounded-full px-2 py-0.5 font-medium transition-colors",
                              member.role === "editor"
                                ? "bg-accent text-accent-ink"
                                : "text-muted hover:text-ink",
                            )}
                          >
                            Editor
                          </button>
                          <button
                            type="button"
                            disabled={updateRoleMutation.isPending}
                            onClick={() => void handleRoleChange(member, "viewer")}
                            className={cn(
                              "cursor-pointer rounded-full px-2 py-0.5 font-medium transition-colors",
                              member.role === "viewer"
                                ? "bg-accent text-accent-ink"
                                : "text-muted hover:text-ink",
                            )}
                          >
                            Viewer
                          </button>
                        </div>

                        <button
                          type="button"
                          aria-label={`Remove @${member.username}`}
                          disabled={removeMemberMutation.isPending}
                          onClick={() => void handleRemoveMember(member)}
                          className="inline-flex size-7 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <span className="rounded-full border border-border bg-surface-elevated px-2.5 py-0.5 text-[11px] font-medium capitalize text-muted">
                        {member.role}
                      </span>
                    )}
                  </li>
                ))
              )}
            </ul>

            {!isOwner && currentUserId ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={removeMemberMutation.isPending}
                onClick={() => void handleLeaveList()}
                className="w-full text-danger hover:bg-danger/10"
              >
                {removeMemberMutation.isPending ? "Leaving..." : "Leave shared list"}
              </Button>
            ) : null}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
