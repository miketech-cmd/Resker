import { redirect } from "next/navigation";

import { ListsOverview } from "@/components/lists/lists-overview";
import { getOptionalUser } from "@/server/auth-guard";
import { getSharedGuidesOverviewData } from "@/server/library-shares";
import { getPublicLists, getUserLists } from "@/server/lists";

export default async function ListsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getOptionalUser();
  if (!user) {
    redirect("/signin");
  }

  const [{ tab }, initialLists, initialPublicLists, initialSharedOverview] = await Promise.all([
    searchParams,
    getUserLists(user.id),
    getPublicLists(user.id),
    getSharedGuidesOverviewData(user.id),
  ]);

  const initialTab = tab === "browse" ? "browse" : tab === "shared" ? "shared" : "mine";

  return (
    <ListsOverview
      initialLists={initialLists}
      initialPublicLists={initialPublicLists}
      initialSharedOverview={initialSharedOverview}
      initialTab={initialTab}
    />
  );
}
