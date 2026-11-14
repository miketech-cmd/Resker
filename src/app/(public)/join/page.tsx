import { JoinForm } from "@/components/auth/join-form";

export const dynamic = "force-dynamic";

export default function JoinPage() {
  const requiresInviteCode = Boolean(process.env.SIGNUP_INVITE_CODE?.trim());
  return <JoinForm requiresInviteCode={requiresInviteCode} />;
}
