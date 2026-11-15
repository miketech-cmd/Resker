import { notFound, redirect } from "next/navigation";

import { RestaurantDetail } from "@/components/places/restaurant-detail";
import { uuidParamSchema } from "@/lib/validation/places";
import { getOptionalUser } from "@/server/auth-guard";
import { getUserRestaurantById } from "@/server/places";

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

  const restaurant = await getUserRestaurantById(user.id, parsedId.data);
  if (!restaurant) {
    notFound();
  }

  return <RestaurantDetail initialRestaurant={restaurant} />;
}
