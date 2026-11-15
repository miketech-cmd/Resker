import { publicListsFilterSchema } from "@/lib/validation/lists";
import { handlePlaceApiError } from "@/server/api-errors";
import { getOptionalUser, privateJson } from "@/server/auth-guard";
import { getPublicLists } from "@/server/lists";

export async function GET(request: Request) {
  try {
    const viewer = await getOptionalUser();
    const { searchParams } = new URL(request.url);
    const parsed = publicListsFilterSchema.safeParse({
      q: searchParams.get("q") ?? undefined,
      city: searchParams.get("city") ?? undefined,
    });

    const lists = await getPublicLists(
      viewer?.id ?? null,
      parsed.success ? parsed.data : undefined,
    );

    return privateJson({ lists });
  } catch (error) {
    return handlePlaceApiError(error, "Could not load public lists.");
  }
}
