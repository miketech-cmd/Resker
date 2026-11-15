import { notFound, redirect } from "next/navigation";

import { RestaurantDetail } from "@/components/places/restaurant-detail";
import { uuidParamSchema } from "@/lib/validation/places";
import { getOptionalUser } from "@/server/auth-guard";
import { getUserRestaurantById } from "@/server/places";
import { getRestaurantVisits } from "@/server/visits";

export default async function PlaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getOptionalUser();
  if (!user) {
    redirect("/signin");
  }

  const { id } = await params;
  const parsedId = uuidParamSchema.safeParse(id);
  if (!parsedId.success) {
    notFound();
  }

  const [restaurant, visits] = await Promise.all([
    getUserRestaurantById(user.id, parsedId.data),
    getRestaurantVisits(user.id, parsedId.data),
  ]);
  if (!restaurant) {
    notFound();
  }

  return <RestaurantDetail initialRestaurant={restaurant} initialVisits={visits ?? []} />;
}
