import { listItemActionSchema } from "@/lib/validation/lists";
import { uuidParamSchema } from "@/lib/validation/places";
import { handlePlaceApiError } from "@/server/api-errors";
import { apiError, privateJson, requireUser } from "@/server/auth-guard";
import { addRestaurantToList, removeRestaurantFromList } from "@/server/lists";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function parseListId(context: RouteContext): Promise<string | null> {
  const { id } = await context.params;
  const parsed = uuidParamSchema.safeParse(id);
  return parsed.success ? parsed.data : null;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const listId = await parseListId(context);
    if (!listId) {
      return apiError(400, "INVALID_ID", "Invalid list identifier.");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Invalid request body.");
    }

    const parsed = listItemActionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        400,
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid restaurant identifier.",
      );
    }

    const result = await addRestaurantToList(user.id, listId, parsed.data.userRestaurantId);
    if (!result) {
      return apiError(404, "NOT_FOUND", "List or restaurant not found.");
    }

    return privateJson(result, result.added ? 201 : 200);
  } catch (error) {
    return handlePlaceApiError(error, "Could not add spot to list.");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const listId = await parseListId(context);
    if (!listId) {
      return apiError(400, "INVALID_ID", "Invalid list identifier.");
    }

    const url = new URL(request.url);
    const queryRestaurantId = url.searchParams.get("userRestaurantId");
    let rawInput: unknown = queryRestaurantId ? { userRestaurantId: queryRestaurantId } : null;

    if (!rawInput) {
      try {
        rawInput = await request.json();
      } catch {
        return apiError(400, "INVALID_JSON", "Provide userRestaurantId to remove.");
      }
    }

    const parsed = listItemActionSchema.safeParse(rawInput);
    if (!parsed.success) {
      return apiError(
        400,
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid restaurant identifier.",
      );
    }

    const result = await removeRestaurantFromList(user.id, listId, parsed.data.userRestaurantId);
    if (!result) {
      return apiError(404, "LIST_NOT_FOUND", "List not found.");
    }

    return privateJson(result);
  } catch (error) {
    return handlePlaceApiError(error, "Could not remove spot from list.");
  }
}
