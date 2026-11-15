export function buildMapsPlaceUrl(place: {
  name: string;
  googlePlaceId: string;
  googleMapsUri?: string | null;
}): string {
  if (place.googleMapsUri) return place.googleMapsUri;
  const params = new URLSearchParams({
    api: "1",
    query: place.name,
    query_place_id: place.googlePlaceId,
  });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

export function buildMapsDirectionsUrl(place: {
  name: string;
  address?: string | null;
  googlePlaceId: string;
}): string {
  const params = new URLSearchParams({
    api: "1",
    destination: place.address?.trim() || place.name,
    destination_place_id: place.googlePlaceId,
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
