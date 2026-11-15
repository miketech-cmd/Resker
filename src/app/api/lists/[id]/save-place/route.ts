import { savePublicSpotSchema } from "@/lib/validation/lists";
import { uuidParamSchema } from "@/lib/validation/places";
import { handlePlaceApiError } from "@/server/api-errors";
import { apiError, privateJson, requireUser } from "@/server/auth-guard";
import { saveSpotFromSharedList } from "@/server/lists";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const parsedId = uuidParamSchema.safeParse(id);
    if (!parsedId.success) {
      return apiError(400, "INVALID_ID", "Invalid list identifier.");
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

    const result = await saveSpotFromSharedList(
      user.id,
      parsedId.data,
      parsed.data.sourceRestaurantId,
    );
    if (!result) {
      return apiError(404, "NOT_FOUND", "Shared list spot not found.");
    }

    return privateJson(result, result.created ? 201 : 200);
  } catch (error) {
    return handlePlaceApiError(error, "Could not save spot to your places.");
  }
}
