import { validateGoogleMapsUrl } from "@/lib/places/url-parser";
import { resolveUrlSchema } from "@/lib/validation/places";
import { handlePlaceApiError } from "@/server/api-errors";
import { consumeApiQuota } from "@/server/api-usage";
import { apiError, privateJson, requireUser } from "@/server/auth-guard";
import { resolveGoogleMapsLinkToPlaceId } from "@/server/google";
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

    const parsed = resolveUrlSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid URL.");
    }

    // Validate host/path strictly before touching quota or calling external Google APIs.
    const urlCheck = validateGoogleMapsUrl(parsed.data.url);
    if (!urlCheck.ok) {
      return apiError(400, "INVALID_MAPS_URL", urlCheck.message);
    }

    await consumeApiQuota(user.id, "resolve");
    const googlePlaceId = await resolveGoogleMapsLinkToPlaceId(urlCheck.url.toString());
    const result = await resolvePlacePrefillForUser(user.id, googlePlaceId);

    return privateJson(result);
  } catch (error) {
    return handlePlaceApiError(error, "Could not resolve that Google Maps link.");
  }
}
