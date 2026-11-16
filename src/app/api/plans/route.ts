import { createPlanSchema } from "@/lib/validation/plans";
import { handlePlaceApiError } from "@/server/api-errors";
import { apiError, privateJson, requireUser } from "@/server/auth-guard";
import { createPlannedVisit, getUserPlans } from "@/server/plans";

export async function GET() {
  try {
    const user = await requireUser();
    const plans = await getUserPlans(user.id);
    return privateJson({ plans });
  } catch (error) {
    return handlePlaceApiError(error, "Could not load your planned visits.");
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

    const parsed = createPlanSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        400,
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Please check the reservation details.",
      );
    }

    const plan = await createPlannedVisit(user.id, parsed.data);
    if (!plan) {
      return apiError(404, "RESTAURANT_NOT_FOUND", "Restaurant not found in your library.");
    }

    return privateJson({ plan }, 201);
  } catch (error) {
    return handlePlaceApiError(error, "Could not save planned visit.");
  }
}
