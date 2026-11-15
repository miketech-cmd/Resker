import { inviteListMemberSchema } from "@/lib/validation/lists";
import { uuidParamSchema } from "@/lib/validation/places";
import { handlePlaceApiError } from "@/server/api-errors";
import { apiError, privateJson, requireUser } from "@/server/auth-guard";
import { getListMembers, inviteListMember } from "@/server/lists";

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

    const members = await getListMembers(user.id, listId);
    if (!members) {
      return apiError(404, "LIST_NOT_FOUND", "List not found.");
    }

    return privateJson({ members });
  } catch (error) {
    return handlePlaceApiError(error, "Could not load list members.");
  }
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

    const parsed = inviteListMemberSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        400,
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Enter a valid @username.",
      );
    }

    const result = await inviteListMember(user.id, listId, parsed.data);
    switch (result.status) {
      case "not_found":
        return apiError(404, "LIST_NOT_FOUND", "List not found.");
      case "forbidden":
        return apiError(403, "FORBIDDEN", "Only the list owner can invite collaborators.");
      case "user_not_found":
        return apiError(404, "USER_NOT_FOUND", "No user found with that username.");
      case "self_invite":
        return apiError(400, "SELF_INVITE", "You already own this list.");
      case "ok":
        return privateJson({ member: result.member }, 201);
    }
  } catch (error) {
    return handlePlaceApiError(error, "Could not invite collaborator.");
  }
}
