import { clonePublicListSchema } from "@/lib/validation/lists";
import { handlePlaceApiError } from "@/server/api-errors";
import { apiError, privateJson, requireUser } from "@/server/auth-guard";
import { clonePublicListToUser } from "@/server/lists";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { slug } = await context.params;

    let body: unknown = {};
    try {
      const text = await request.text();
      if (text.trim()) {
        body = JSON.parse(text);
      }
    } catch {
      return apiError(400, "INVALID_JSON", "Invalid request body.");
    }

    const parsed = clonePublicListSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        400,
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid clone options.",
      );
    }

    const result = await clonePublicListToUser(user.id, slug.trim(), parsed.data);
    if (!result) {
      return apiError(404, "LIST_NOT_FOUND", "Public list not found.");
    }

    return privateJson(result, 201);
  } catch (error) {
    return handlePlaceApiError(error, "Could not save public list.");
  }
}
