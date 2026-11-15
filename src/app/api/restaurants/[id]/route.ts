import { updateRestaurantSchema, uuidParamSchema } from "@/lib/validation/places";
import { handlePlaceApiError } from "@/server/api-errors";
import { apiError, privateJson, requireUser } from "@/server/auth-guard";
import { deleteUserRestaurant, getUserRestaurantById, updateUserRestaurant } from "@/server/places";

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
    const id = await parseRestaurantId(context);
    if (!id) {
      return apiError(400, "INVALID_ID", "Invalid restaurant identifier.");
    }

    const restaurant = await getUserRestaurantById(user.id, id);
    if (!restaurant) {
      return apiError(404, "RESTAURANT_NOT_FOUND", "Restaurant not found.");
    }

    return privateJson({ restaurant });
  } catch (error) {
    return handlePlaceApiError(error, "Could not load restaurant details.");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const id = await parseRestaurantId(context);
    if (!id) {
      return apiError(400, "INVALID_ID", "Invalid restaurant identifier.");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Invalid request body.");
    }

    const parsed = updateRestaurantSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        400,
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Please check the restaurant details.",
      );
    }

    const restaurant = await updateUserRestaurant(user.id, id, parsed.data);
    if (!restaurant) {
      return apiError(404, "RESTAURANT_NOT_FOUND", "Restaurant not found.");
    }

    return privateJson({ restaurant });
  } catch (error) {
    return handlePlaceApiError(error, "Could not update restaurant.");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const id = await parseRestaurantId(context);
    if (!id) {
      return apiError(400, "INVALID_ID", "Invalid restaurant identifier.");
    }

    const deleted = await deleteUserRestaurant(user.id, id);
    if (!deleted) {
      return apiError(404, "RESTAURANT_NOT_FOUND", "Restaurant not found.");
    }

    return privateJson(deleted);
  } catch (error) {
    return handlePlaceApiError(error, "Could not remove restaurant.");
  }
}
