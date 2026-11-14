"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { FoodIcon } from "@/components/icons/food-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { normalizeUsername, signInSchema } from "@/lib/validation/auth";

function getSafeNextPath(raw: string | null): string {
  if (!raw) return "/places";
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/places";
}

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = signInSchema.safeParse({ username, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your username and password.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await authClient.signIn.username({
        username: normalizeUsername(parsed.data.username),
        password: parsed.data.password,
        rememberMe: true,
      });

      if (response.error) {
        setError(response.error.message ?? "Invalid username or password.");
        setSubmitting(false);
        return;
      }

      const nextPath = getSafeNextPath(searchParams.get("next"));
      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("Network error while signing in. Please try again.");
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
          <h1 className="font-serif text-2xl font-medium tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted">Welcome back to your tasting notebook.</p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
            <div>
              <Label htmlFor="signin-username">Username</Label>
              <Input
                id="signin-username"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="maya_lin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="signin-password">Password</Label>
              <Input
                id="signin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1.5"
              />
            </div>

            {error ? (
              <p
                role="alert"
                className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger"
              >
                {error}
              </p>
            ) : null}

            <Button type="submit" disabled={submitting} className="w-full" size="lg">
              {submitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted">
            New here?{" "}
            <Link href="/join" className="font-medium text-accent hover:underline">
              Create an account
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
