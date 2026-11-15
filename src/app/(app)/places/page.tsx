import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PlacesLibraryPreview } from "@/components/places/places-library-preview";
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
      <PlacesLibraryPreview initialRestaurants={initialRestaurants} />
    </Suspense>
  );
}
