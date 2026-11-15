import { handlePlaceApiError } from "@/server/api-errors";
import { apiError, getOptionalUser, privateJson } from "@/server/auth-guard";
import { getPublicListBySlug } from "@/server/lists";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const viewer = await getOptionalUser();
    const { slug } = await context.params;
    const cleanedSlug = slug.trim();

    if (!cleanedSlug || cleanedSlug.length > 100) {
      return apiError(400, "INVALID_SLUG", "Invalid public list identifier.");
    }

    const detail = await getPublicListBySlug(cleanedSlug, viewer?.id ?? null);
    if (!detail) {
      return apiError(404, "LIST_NOT_FOUND", "Public list not found.");
    }

    return privateJson(detail);
  } catch (error) {
    return handlePlaceApiError(error, "Could not load public list.");
  }
}
