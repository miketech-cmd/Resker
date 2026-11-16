import { redirect } from "next/navigation";

import { PlansView } from "@/components/plans/plans-view";
import { getOptionalUser } from "@/server/auth-guard";
import { getUserRestaurants } from "@/server/places";
import { getUserPlans } from "@/server/plans";

export default async function PlansPage() {
  const user = await getOptionalUser();
  if (!user) {
    redirect("/signin");
  }

  const [initialPlans, initialRestaurants] = await Promise.all([
    getUserPlans(user.id),
    getUserRestaurants(user.id),
  ]);

  return <PlansView initialPlans={initialPlans} initialRestaurants={initialRestaurants} />;
}
