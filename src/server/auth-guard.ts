import "server-only";

import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

export interface AuthenticatedUser {
  id: string;
  name: string;
  username: string;
  displayUsername: string | null;
}

export class UnauthorizedError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export function apiError(status: number, code: string, message: string) {
  return NextResponse.json(
    { error: { code, message } },
    {
      status,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

export function privateJson<T>(data: T, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

/**
 * Resolves the current session user from the incoming request headers.
 * Throws UnauthorizedError when no valid session exists.
 */
export async function requireUser(): Promise<AuthenticatedUser> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new UnauthorizedError();
  }

  return {
    id: session.user.id,
    name: session.user.name,
    username: session.user.username ?? "",
    displayUsername: session.user.displayUsername ?? null,
  };
}

/**
 * Non-throwing session helper for Server Components.
 */
export async function getOptionalUser(): Promise<AuthenticatedUser | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return null;
  }

  return {
    id: session.user.id,
    name: session.user.name,
    username: session.user.username ?? "",
    displayUsername: session.user.displayUsername ?? null,
  };
}
