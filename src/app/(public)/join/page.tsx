import { redirect } from "next/navigation";

import { JoinForm } from "@/components/auth/join-form";
import { getOptionalUser } from "@/server/auth-guard";

export const dynamic = "force-dynamic";

export default async function JoinPage() {
  if (await getOptionalUser()) {
    redirect("/places");
  }

  const requiresInviteCode = Boolean(process.env.SIGNUP_INVITE_CODE?.trim());
  return <JoinForm requiresInviteCode={requiresInviteCode} />;
}
