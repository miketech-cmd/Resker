import "server-only";

import { ApiRateLimitError } from "@/server/api-usage";
import { UnauthorizedError, apiError } from "@/server/auth-guard";
import { GooglePlacesError } from "@/server/google";

export function handlePlaceApiError(error: unknown, fallbackMessage: string) {
  if (error instanceof UnauthorizedError) {
    return apiError(401, "UNAUTHORIZED", error.message);
  }
  if (error instanceof ApiRateLimitError) {
    return apiError(error.status, error.code, error.message);
  }
  if (error instanceof GooglePlacesError) {
    return apiError(error.status, error.code, error.message);
  }
  console.error("[places-api]", error);
  return apiError(500, "INTERNAL_ERROR", fallbackMessage);
}
