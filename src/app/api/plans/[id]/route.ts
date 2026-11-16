import { uuidParamSchema } from "@/lib/validation/places";
import { updatePlanSchema } from "@/lib/validation/plans";
import { handlePlaceApiError } from "@/server/api-errors";
import { apiError, privateJson, requireUser } from "@/server/auth-guard";
import { deletePlannedVisit, updatePlannedVisit } from "@/server/plans";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function parsePlanId(context: RouteContext): Promise<string | null> {
  const { id } = await context.params;
  const parsed = uuidParamSchema.safeParse(id);
  return parsed.success ? parsed.data : null;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const planId = await parsePlanId(context);
    if (!planId) {
      return apiError(400, "INVALID_ID", "Invalid plan identifier.");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Invalid request body.");
    }

    const parsed = updatePlanSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        400,
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Please check the reservation updates.",
      );
    }

    const plan = await updatePlannedVisit(user.id, planId, parsed.data);
    if (!plan) {
      return apiError(404, "PLAN_NOT_FOUND", "Planned visit not found.");
    }

    return privateJson({ plan });
  } catch (error) {
    return handlePlaceApiError(error, "Could not update planned visit.");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const planId = await parsePlanId(context);
    if (!planId) {
      return apiError(400, "INVALID_ID", "Invalid plan identifier.");
    }

    const deleted = await deletePlannedVisit(user.id, planId);
    if (!deleted) {
      return apiError(404, "PLAN_NOT_FOUND", "Planned visit not found.");
    }

    return privateJson(deleted);
  } catch (error) {
    return handlePlaceApiError(error, "Could not delete planned visit.");
  }
}
