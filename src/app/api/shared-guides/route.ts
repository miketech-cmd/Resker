import { inviteLibraryViewerSchema } from "@/lib/validation/lists";
import { handlePlaceApiError } from "@/server/api-errors";
import { apiError, privateJson, requireUser } from "@/server/auth-guard";
import { getSharedGuidesOverviewData, inviteLibraryViewer } from "@/server/library-shares";

export async function GET() {
  try {
    const user = await requireUser();
    const overview = await getSharedGuidesOverviewData(user.id);
    return privateJson(overview);
  } catch (error) {
    return handlePlaceApiError(error, "Could not load shared guides.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Invalid request body.");
    }

    const parsed = inviteLibraryViewerSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        400,
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Enter a valid @username.",
      );
    }

    const result = await inviteLibraryViewer(user.id, parsed.data.username);
    if (result.status === "not_found") {
      return apiError(404, "USER_NOT_FOUND", "No Resker user found with that username.");
    }
    if (result.status === "self") {
      return apiError(400, "CANNOT_INVITE_SELF", "You already own your saved library.");
    }

    return privateJson({ viewer: result.viewer }, 201);
  } catch (error) {
    return handlePlaceApiError(error, "Could not share your library with that user.");
  }
}
