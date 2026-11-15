import { redirect } from "next/navigation";

import { ListsOverview } from "@/components/lists/lists-overview";
import { getOptionalUser } from "@/server/auth-guard";
import { getUserLists } from "@/server/lists";

export default async function ListsPage() {
  const user = await getOptionalUser();
  if (!user) {
    redirect("/signin");
  }

  const initialLists = await getUserLists(user.id);
  return <ListsOverview initialLists={initialLists} />;
}
