import { notFound, redirect } from "next/navigation";

import { PublicListDetail } from "@/components/lists/public-list-detail";
import { getOptionalUser } from "@/server/auth-guard";
import { getPublicListBySlug } from "@/server/lists";

export default async function PublicListAppDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getOptionalUser();
  if (!user) {
    redirect(`/signin?next=${encodeURIComponent(`/lists/public/${slug}`)}`);
  }

  const detail = await getPublicListBySlug(slug, user.id);
  if (!detail) {
    notFound();
  }

  return (
    <PublicListDetail
      initialDetail={detail}
      viewerSignedIn
      backHref="/lists?tab=browse"
      backLabel="Browse guides"
    />
  );
}
