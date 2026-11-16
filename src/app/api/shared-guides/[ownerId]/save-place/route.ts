import { savePublicSpotSchema } from "@/lib/validation/lists";
import { handlePlaceApiError } from "@/server/api-errors";
import { apiError, privateJson, requireUser } from "@/server/auth-guard";
import { saveSpotFromSharedLibrary } from "@/server/library-shares";

type RouteContext = {
  params: Promise<{ ownerId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { ownerId } = await context.params;
    const cleanOwnerId = ownerId.trim();
    if (!cleanOwnerId) {
      return apiError(400, "INVALID_ID", "Invalid owner identifier.");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Invalid request body.");
    }

    const parsed = savePublicSpotSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        400,
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid spot identifier.",
      );
    }

    const saved = await saveSpotFromSharedLibrary(
      user.id,
      cleanOwnerId,
      parsed.data.sourceRestaurantId,
    );
    if (!saved) {
      return apiError(404, "SPOT_NOT_FOUND", "Spot not found in this shared guide.");
    }

    return privateJson(saved, saved.created ? 201 : 200);
  } catch (error) {
    return handlePlaceApiError(error, "Could not save restaurant to your library.");
  }
}
