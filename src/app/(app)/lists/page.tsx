import { redirect } from "next/navigation";

import { ListsOverview } from "@/components/lists/lists-overview";
import { getOptionalUser } from "@/server/auth-guard";
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

  const [{ tab }, initialLists, initialPublicLists] = await Promise.all([
    searchParams,
    getUserLists(user.id),
    getPublicLists(user.id),
  ]);

  return (
    <ListsOverview
      initialLists={initialLists}
      initialPublicLists={initialPublicLists}
      initialTab={tab === "browse" ? "browse" : "mine"}
    />
  );
}
