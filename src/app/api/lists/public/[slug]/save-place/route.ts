import { savePublicSpotSchema } from "@/lib/validation/lists";
import { handlePlaceApiError } from "@/server/api-errors";
import { apiError, privateJson, requireUser } from "@/server/auth-guard";
import { saveSpotFromPublicList } from "@/server/lists";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { slug } = await context.params;

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

    const result = await saveSpotFromPublicList(
      user.id,
      slug.trim(),
      parsed.data.sourceRestaurantId,
    );
    if (!result) {
      return apiError(404, "SPOT_NOT_FOUND", "Spot not found in this public list.");
    }

    return privateJson(result, result.created ? 201 : 200);
  } catch (error) {
    return handlePlaceApiError(error, "Could not save restaurant from public list.");
  }
}
