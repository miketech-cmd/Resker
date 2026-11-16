import { notFound, redirect } from "next/navigation";

import { SharedGuideDetail } from "@/components/lists/shared-guide-detail";
import { getOptionalUser } from "@/server/auth-guard";
import { getSharedLibraryGuideDetail } from "@/server/library-shares";

export default async function SharedGuideDetailPage({
  params,
}: {
  params: Promise<{ ownerId: string }>;
}) {
  const { ownerId } = await params;
  const user = await getOptionalUser();
  if (!user) {
    redirect(`/signin?next=${encodeURIComponent(`/lists/shared/${ownerId}`)}`);
  }

  const detail = await getSharedLibraryGuideDetail(user.id, ownerId);
  if (!detail) {
    notFound();
  }

  return <SharedGuideDetail initialDetail={detail} />;
}
