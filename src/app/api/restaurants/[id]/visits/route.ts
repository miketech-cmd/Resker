import { uuidParamSchema } from "@/lib/validation/places";
import { createVisitSchema } from "@/lib/validation/visits";
import { handlePlaceApiError } from "@/server/api-errors";
import { apiError, privateJson, requireUser } from "@/server/auth-guard";
import { createVisit, getRestaurantVisits } from "@/server/visits";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function parseRestaurantId(context: RouteContext): Promise<string | null> {
  const { id } = await context.params;
  const parsed = uuidParamSchema.safeParse(id);
  return parsed.success ? parsed.data : null;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const restaurantId = await parseRestaurantId(context);
    if (!restaurantId) {
      return apiError(400, "INVALID_ID", "Invalid restaurant identifier.");
    }

    const visits = await getRestaurantVisits(user.id, restaurantId);
    if (visits === null) {
      return apiError(404, "RESTAURANT_NOT_FOUND", "Restaurant not found.");
    }

    return privateJson({ visits });
  } catch (error) {
    return handlePlaceApiError(error, "Could not load visits.");
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const restaurantId = await parseRestaurantId(context);
    if (!restaurantId) {
      return apiError(400, "INVALID_ID", "Invalid restaurant identifier.");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Invalid request body.");
    }

    const parsed = createVisitSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        400,
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Please check the visit details.",
      );
    }

    const result = await createVisit(user.id, restaurantId, parsed.data);
    if (!result) {
      return apiError(404, "RESTAURANT_NOT_FOUND", "Restaurant not found.");
    }

    return privateJson(result, 201);
  } catch (error) {
    return handlePlaceApiError(error, "Could not log visit.");
  }
}
