import { uuidParamSchema } from "@/lib/validation/places";
import { completePlanSchema } from "@/lib/validation/plans";
import { handlePlaceApiError } from "@/server/api-errors";
import { apiError, privateJson, requireUser } from "@/server/auth-guard";
import { completePlannedVisit } from "@/server/plans";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const parsedId = uuidParamSchema.safeParse(id);
    if (!parsedId.success) {
      return apiError(400, "INVALID_ID", "Invalid plan identifier.");
    }

    let body: unknown = {};
    const rawText = await request.text();
    if (rawText.trim()) {
      try {
        body = JSON.parse(rawText);
      } catch {
        return apiError(400, "INVALID_JSON", "Invalid request body.");
      }
    }

    const parsed = completePlanSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        400,
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Please check the visit completion details.",
      );
    }

    const result = await completePlannedVisit(user.id, parsedId.data, parsed.data);
    if (!result) {
      return apiError(404, "PLAN_NOT_FOUND", "Planned visit not found.");
    }

    return privateJson(result, result.alreadyCompleted ? 200 : 201);
  } catch (error) {
    return handlePlaceApiError(error, "Could not log planned visit.");
  }
}
