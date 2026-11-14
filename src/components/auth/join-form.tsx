"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { FoodIcon } from "@/components/icons/food-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import {
  buildPlaceholderEmail,
  joinSchema,
  normalizeUsername,
  suggestUsernameFromName,
} from "@/lib/validation/auth";

export function JoinForm({ requiresInviteCode }: { requiresInviteCode: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleNameChange(value: string) {
    setName(value);
    if (!usernameTouched) {
      setUsername(suggestUsernameFromName(value));
    }
  }

  function handleUsernameChange(value: string) {
    setUsernameTouched(true);
    setUsername(value.replace(/[^a-zA-Z0-9_]/g, ""));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = joinSchema.safeParse({
      name,
      username,
      password,
      inviteCode: requiresInviteCode ? inviteCode : undefined,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your details and try again.");
      return;
    }

    if (requiresInviteCode && !parsed.data.inviteCode) {
      setError("An invite code is required to join.");
      return;
    }

    setSubmitting(true);
    try {
      const normalized = normalizeUsername(parsed.data.username);
      const response = await authClient.signUp.email(
        {
          email: buildPlaceholderEmail(normalized),
          name: parsed.data.name,
          username: normalized,
          displayUsername: parsed.data.username,
          password: parsed.data.password,
        },
        requiresInviteCode
          ? {
              headers: {
                "x-invite-code": parsed.data.inviteCode ?? "",
              },
            }
          : undefined,
      );

      if (response.error) {
        setError(response.error.message ?? "Could not create your account.");
        setSubmitting(false);
        return;
      }

      router.replace("/places");
      router.refresh();
    } catch {
      setError("Network error while creating your account. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-bg px-5 py-10 text-ink">
      <div className="mx-auto w-full max-w-sm">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted hover:text-ink"
        >
          <span className="flex size-8 items-center justify-center rounded-xl bg-accent text-accent-ink">
            <FoodIcon name="bowl" className="size-4" />
          </span>
          <span className="font-serif text-base font-medium text-ink">Restaurant Tracker</span>
        </Link>

        <Card className="p-6">
          <h1 className="font-serif text-2xl font-medium tracking-tight">Join</h1>
          <p className="mt-1 text-sm text-muted">Create your account to start saving places.</p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
            <div>
              <Label htmlFor="join-name">Name</Label>
              <Input
                id="join-name"
                name="name"
                autoComplete="name"
                placeholder="Maya Lin"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="join-username">Username</Label>
              <Input
                id="join-username"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="maya_lin"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                required
                className="mt-1.5"
              />
              <p className="mt-1 text-xs text-muted">3–20 letters, numbers, or underscores.</p>
            </div>

            <div>
              <Label htmlFor="join-password">Password</Label>
              <Input
                id="join-password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1.5"
              />
            </div>

            {requiresInviteCode ? (
              <div>
                <Label htmlFor="join-invite">Invite code</Label>
                <Input
                  id="join-invite"
                  name="inviteCode"
                  autoComplete="off"
                  placeholder="Enter invite code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  required
                  className="mt-1.5"
                />
              </div>
            ) : null}

            {error ? (
              <p
                role="alert"
                className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger"
              >
                {error}
              </p>
            ) : null}

            <Button type="submit" disabled={submitting} className="w-full" size="lg">
              {submitting ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted">
            Already have an account?{" "}
            <Link href="/signin" className="font-medium text-accent hover:underline">
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
