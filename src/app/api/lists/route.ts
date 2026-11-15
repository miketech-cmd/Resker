import { createListSchema } from "@/lib/validation/lists";
import { handlePlaceApiError } from "@/server/api-errors";
import { apiError, privateJson, requireUser } from "@/server/auth-guard";
import { createUserList, getUserLists } from "@/server/lists";

export async function GET() {
  try {
    const user = await requireUser();
    const lists = await getUserLists(user.id);
    return privateJson({ lists });
  } catch (error) {
    return handlePlaceApiError(error, "Could not load lists.");
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

    const parsed = createListSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        400,
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Please check the list details.",
      );
    }

    const list = await createUserList(user.id, parsed.data);
    return privateJson({ list }, 201);
  } catch (error) {
    return handlePlaceApiError(error, "Could not create list.");
  }
}
