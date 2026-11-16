import { notFound, redirect } from "next/navigation";

import { AcceptLibraryInvite } from "@/components/lists/accept-library-invite";
import { libraryShareTokenParamSchema } from "@/lib/validation/lists";
import { getOptionalUser } from "@/server/auth-guard";
import { getLibraryInvitePreview } from "@/server/library-shares";

export default async function AcceptLibraryInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await getOptionalUser();
  if (!user) {
    redirect(`/signin?next=${encodeURIComponent(`/lists/shared/invite/${token}`)}`);
  }

  const parsed = libraryShareTokenParamSchema.safeParse(token);
  if (!parsed.success) {
    notFound();
  }

  const preview = await getLibraryInvitePreview(user.id, parsed.data);
  if (!preview) {
    notFound();
  }

  return <AcceptLibraryInvite preview={preview} />;
}
