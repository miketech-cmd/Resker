import { createRestaurantSchema } from "@/lib/validation/places";
import { handlePlaceApiError } from "@/server/api-errors";
import { apiError, privateJson, requireUser } from "@/server/auth-guard";
import { createUserRestaurant, getUserRestaurants } from "@/server/places";

export async function GET() {
  try {
    const user = await requireUser();
    const restaurants = await getUserRestaurants(user.id);
    return privateJson({ restaurants });
  } catch (error) {
    return handlePlaceApiError(error, "Could not load saved places.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Invalid request body.");
    }

    const parsed = createRestaurantSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        400,
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Please check the restaurant details.",
      );
    }

    const result = await createUserRestaurant(user.id, parsed.data);
    return privateJson(result, result.created ? 201 : 200);
  } catch (error) {
    return handlePlaceApiError(error, "Could not save restaurant.");
  }
}
