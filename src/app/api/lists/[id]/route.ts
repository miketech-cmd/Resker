import { updateListSchema } from "@/lib/validation/lists";
import { uuidParamSchema } from "@/lib/validation/places";
import { handlePlaceApiError } from "@/server/api-errors";
import { apiError, privateJson, requireUser } from "@/server/auth-guard";
import { canReadList, deleteUserList, getListDetail, updateUserList } from "@/server/lists";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function parseListId(context: RouteContext): Promise<string | null> {
  const { id } = await context.params;
  const parsed = uuidParamSchema.safeParse(id);
  return parsed.success ? parsed.data : null;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const listId = await parseListId(context);
    if (!listId) {
      return apiError(400, "INVALID_ID", "Invalid list identifier.");
    }

    const detail = await getListDetail(user.id, listId);
    if (!detail) {
      return apiError(404, "LIST_NOT_FOUND", "List not found.");
    }

    return privateJson(detail);
  } catch (error) {
    return handlePlaceApiError(error, "Could not load list.");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
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

    const parsed = updateListSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        400,
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Please check the list details.",
      );
    }

    const list = await updateUserList(user.id, listId, parsed.data);
    if (!list) {
      if (await canReadList(user.id, listId)) {
        return apiError(403, "FORBIDDEN", "Only the list owner can update list settings.");
      }
      return apiError(404, "LIST_NOT_FOUND", "List not found.");
    }

    return privateJson({ list });
  } catch (error) {
    return handlePlaceApiError(error, "Could not update list.");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const listId = await parseListId(context);
    if (!listId) {
      return apiError(400, "INVALID_ID", "Invalid list identifier.");
    }

    const deleted = await deleteUserList(user.id, listId);
    if (!deleted) {
      if (await canReadList(user.id, listId)) {
        return apiError(403, "FORBIDDEN", "Only the list owner can delete this list.");
      }
      return apiError(404, "LIST_NOT_FOUND", "List not found.");
    }

    return privateJson(deleted);
  } catch (error) {
    return handlePlaceApiError(error, "Could not delete list.");
  }
}
