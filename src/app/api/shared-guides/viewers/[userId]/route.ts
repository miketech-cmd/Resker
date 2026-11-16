import { handlePlaceApiError } from "@/server/api-errors";
import { apiError, privateJson, requireUser } from "@/server/auth-guard";
import { removeLibraryViewer } from "@/server/library-shares";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { userId } = await context.params;
    const targetId = userId.trim();
    if (!targetId) {
      return apiError(400, "INVALID_ID", "Invalid user identifier.");
    }

    const { deleted } = await removeLibraryViewer(user.id, targetId);
    if (!deleted) {
      return apiError(404, "VIEWER_NOT_FOUND", "Viewer access not found.");
    }

    return privateJson({ removedUserId: targetId });
  } catch (error) {
    return handlePlaceApiError(error, "Could not remove viewer access.");
  }
}
