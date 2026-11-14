import { z } from "zod";

export const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function buildPlaceholderEmail(username: string): string {
  return `${normalizeUsername(username)}@users.invalid`;
}

export function suggestUsernameFromName(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
  if (cleaned.length >= 3) return cleaned;
  return cleaned ? `${cleaned}_foodie`.slice(0, 20) : "";
}

export const joinSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter your name.")
    .max(60, "Name must be 60 characters or fewer."),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters.")
    .max(20, "Username must be 20 characters or fewer.")
    .regex(USERNAME_REGEX, "Use only letters, numbers, and underscores."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password is too long."),
  inviteCode: z.string().trim().optional(),
});

export const signInSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Enter your username.")
    .max(20, "Username must be 20 characters or fewer.")
    .regex(USERNAME_REGEX, "Invalid username format."),
  password: z.string().min(1, "Enter your password."),
});

export type JoinInput = z.infer<typeof joinSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
