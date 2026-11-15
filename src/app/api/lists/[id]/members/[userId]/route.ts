import { z } from "zod";

import { updateListMemberRoleSchema } from "@/lib/validation/lists";
import { uuidParamSchema } from "@/lib/validation/places";
import { handlePlaceApiError } from "@/server/api-errors";
import { apiError, privateJson, requireUser } from "@/server/auth-guard";
import { removeListMember, updateListMemberRole } from "@/server/lists";

type RouteContext = {
  params: Promise<{ id: string; userId: string }>;
};

const memberUserIdSchema = z.string().trim().min(1).max(128);

async function parseParams(
  context: RouteContext,
): Promise<{ listId: string; userId: string } | null> {
  const { id, userId } = await context.params;
  const parsedListId = uuidParamSchema.safeParse(id);
  const parsedUserId = memberUserIdSchema.safeParse(userId);
  if (!parsedListId.success || !parsedUserId.success) {
    return null;
  }
  return { listId: parsedListId.data, userId: parsedUserId.data };
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const params = await parseParams(context);
    if (!params) {
      return apiError(400, "INVALID_ID", "Invalid list or member identifier.");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Invalid request body.");
    }

    const parsed = updateListMemberRoleSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        400,
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Choose editor or viewer.",
      );
    }

    const result = await updateListMemberRole(
      user.id,
      params.listId,
      params.userId,
      parsed.data.role,
    );
    switch (result.status) {
      case "not_found":
        return apiError(404, "MEMBER_NOT_FOUND", "Member or list not found.");
      case "forbidden":
        return apiError(403, "FORBIDDEN", "Only the list owner can change member roles.");
      case "ok":
        return privateJson({ role: result.role });
    }
  } catch (error) {
    return handlePlaceApiError(error, "Could not update collaborator role.");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const params = await parseParams(context);
    if (!params) {
      return apiError(400, "INVALID_ID", "Invalid list or member identifier.");
    }

    const result = await removeListMember(user.id, params.listId, params.userId);
    switch (result.status) {
      case "not_found":
        return apiError(404, "MEMBER_NOT_FOUND", "Member or list not found.");
      case "forbidden":
        return apiError(403, "FORBIDDEN", "You do not have permission to remove this member.");
      case "ok":
        return privateJson({ removed: true, userId: params.userId });
    }
  } catch (error) {
    return handlePlaceApiError(error, "Could not remove collaborator.");
  }
}
