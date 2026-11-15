import { notFound, redirect } from "next/navigation";

import { ListDetail } from "@/components/lists/list-detail";
import { uuidParamSchema } from "@/lib/validation/places";
import { getOptionalUser } from "@/server/auth-guard";
import { getListDetail } from "@/server/lists";

export default async function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getOptionalUser();
  if (!user) {
    redirect("/signin");
  }

  const { id } = await params;
  const parsedId = uuidParamSchema.safeParse(id);
  if (!parsedId.success) {
    notFound();
  }

  const detail = await getListDetail(user.id, parsedId.data);
  if (!detail) {
    notFound();
  }

  return <ListDetail initialDetail={detail} currentUserId={user.id} />;
}
