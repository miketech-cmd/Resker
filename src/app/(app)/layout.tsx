import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { getOptionalUser } from "@/server/auth-guard";

export const dynamic = "force-dynamic";

export default async function AuthenticatedAppLayout({ children }: { children: ReactNode }) {
  const user = await getOptionalUser();
  if (!user) {
    redirect("/signin");
  }

  return <AppShell user={user}>{children}</AppShell>;
}
