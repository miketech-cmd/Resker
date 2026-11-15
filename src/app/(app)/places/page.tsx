import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PlacesLibrary } from "@/components/places/places-library";
import { getOptionalUser } from "@/server/auth-guard";
import { getUserRestaurants } from "@/server/places";

export default async function PlacesPage() {
  const user = await getOptionalUser();
  if (!user) {
    redirect("/signin");
  }

  const initialRestaurants = await getUserRestaurants(user.id);

  return (
    <Suspense fallback={null}>
      <PlacesLibrary initialRestaurants={initialRestaurants} />
    </Suspense>
  );
}
