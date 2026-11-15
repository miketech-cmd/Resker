import { placeDetailsRequestSchema } from "@/lib/validation/places";
import { handlePlaceApiError } from "@/server/api-errors";
import { apiError, privateJson, requireUser } from "@/server/auth-guard";
import { resolvePlacePrefillForUser } from "@/server/places";

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Invalid request body.");
    }

    const parsed = placeDetailsRequestSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        400,
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid place request.",
      );
    }

    const result = await resolvePlacePrefillForUser(
      user.id,
      parsed.data.googlePlaceId,
      parsed.data.sessionToken,
    );
    return privateJson(result);
  } catch (error) {
    return handlePlaceApiError(error, "Could not load details for that restaurant.");
  }
}
