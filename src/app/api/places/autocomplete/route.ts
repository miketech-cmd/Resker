import { autocompleteQuerySchema } from "@/lib/validation/places";
import { handlePlaceApiError } from "@/server/api-errors";
import { consumeApiQuota } from "@/server/api-usage";
import { apiError, privateJson, requireUser } from "@/server/auth-guard";
import { autocompletePlaces } from "@/server/google";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);

    const parsed = autocompleteQuerySchema.safeParse({
      q: searchParams.get("q") ?? "",
      session: searchParams.get("session") || undefined,
      lat: searchParams.get("lat") || undefined,
      lng: searchParams.get("lng") || undefined,
    });

    if (!parsed.success) {
      return apiError(
        400,
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid search query.",
      );
    }

    await consumeApiQuota(user.id, "autocomplete");
    const suggestions = await autocompletePlaces({
      query: parsed.data.q,
      sessionToken: parsed.data.session,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
    });

    return privateJson({ suggestions });
  } catch (error) {
    return handlePlaceApiError(error, "Search failed. Please try again.");
  }
}
