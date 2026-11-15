import { uuidParamSchema } from "@/lib/validation/places";
import { updateVisitSchema } from "@/lib/validation/visits";
import { handlePlaceApiError } from "@/server/api-errors";
import { apiError, privateJson, requireUser } from "@/server/auth-guard";
import { deleteVisit, updateVisit } from "@/server/visits";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function parseVisitId(context: RouteContext): Promise<string | null> {
  const { id } = await context.params;
  const parsed = uuidParamSchema.safeParse(id);
  return parsed.success ? parsed.data : null;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const visitId = await parseVisitId(context);
    if (!visitId) {
      return apiError(400, "INVALID_ID", "Invalid visit identifier.");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Invalid request body.");
    }

    const parsed = updateVisitSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        400,
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Please check the visit details.",
      );
    }

    const result = await updateVisit(user.id, visitId, parsed.data);
    if (!result) {
      return apiError(404, "VISIT_NOT_FOUND", "Visit not found.");
    }

    return privateJson(result);
  } catch (error) {
    return handlePlaceApiError(error, "Could not update visit.");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const visitId = await parseVisitId(context);
    if (!visitId) {
      return apiError(400, "INVALID_ID", "Invalid visit identifier.");
    }

    const result = await deleteVisit(user.id, visitId);
    if (!result) {
      return apiError(404, "VISIT_NOT_FOUND", "Visit not found.");
    }

    return privateJson(result);
  } catch (error) {
    return handlePlaceApiError(error, "Could not delete visit.");
  }
}
