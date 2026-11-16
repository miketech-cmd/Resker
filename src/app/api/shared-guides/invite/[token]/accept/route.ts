import { libraryShareTokenParamSchema } from "@/lib/validation/lists";
import { handlePlaceApiError } from "@/server/api-errors";
import { apiError, privateJson, requireUser } from "@/server/auth-guard";
import { acceptLibraryInviteToken } from "@/server/library-shares";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { token } = await context.params;
    const parsed = libraryShareTokenParamSchema.safeParse(token);
    if (!parsed.success) {
      return apiError(400, "INVALID_TOKEN", "Invalid shared library invite link.");
    }

    const result = await acceptLibraryInviteToken(user.id, parsed.data);
    if (result.status === "not_found") {
      return apiError(
        404,
        "INVITE_NOT_FOUND",
        "This private invite link is invalid or has been revoked.",
      );
    }
    if (result.status === "self") {
      return apiError(
        400,
        "CANNOT_INVITE_SELF",
        "This is your own invite link — send it to your partner.",
      );
    }

    return privateJson({
      ownerId: result.ownerId,
      ownerName: result.ownerName,
      ownerUsername: result.ownerUsername,
    });
  } catch (error) {
    return handlePlaceApiError(error, "Could not accept shared guide invite.");
  }
}
