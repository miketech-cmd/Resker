import { handlePlaceApiError } from "@/server/api-errors";
import { apiError, privateJson, requireUser } from "@/server/auth-guard";
import { getSharedLibraryGuideDetail, removeLibraryViewer } from "@/server/library-shares";

type RouteContext = {
  params: Promise<{ ownerId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { ownerId } = await context.params;
    const cleanOwnerId = ownerId.trim();
    if (!cleanOwnerId) {
      return apiError(400, "INVALID_ID", "Invalid owner identifier.");
    }

    const detail = await getSharedLibraryGuideDetail(user.id, cleanOwnerId);
    if (!detail) {
      return apiError(404, "SHARED_GUIDE_NOT_FOUND", "Shared guide not found.");
    }

    return privateJson(detail);
  } catch (error) {
    return handlePlaceApiError(error, "Could not load shared guide.");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { ownerId } = await context.params;
    const cleanOwnerId = ownerId.trim();
    if (!cleanOwnerId) {
      return apiError(400, "INVALID_ID", "Invalid owner identifier.");
    }

    const { deleted } = await removeLibraryViewer(cleanOwnerId, user.id);
    if (!deleted) {
      return apiError(404, "SHARED_GUIDE_NOT_FOUND", "Shared guide access not found.");
    }

    return privateJson({ leftOwnerId: cleanOwnerId });
  } catch (error) {
    return handlePlaceApiError(error, "Could not leave shared guide.");
  }
}
