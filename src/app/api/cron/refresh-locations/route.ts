import { apiError, privateJson } from "@/server/auth-guard";
import { refreshStalePlaceLocations, verifyCronSecret } from "@/server/cron-refresh";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!verifyCronSecret(authHeader)) {
    return apiError(401, "UNAUTHORIZED", "Invalid cron authorization.");
  }

  try {
    const result = await refreshStalePlaceLocations(25);
    return privateJson({ ok: true, ...result });
  } catch (error) {
    console.error("[cron-refresh-locations]", error);
    return apiError(500, "CRON_FAILED", "Could not refresh place locations.");
  }
}
