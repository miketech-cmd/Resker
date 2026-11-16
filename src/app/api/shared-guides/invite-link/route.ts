import { handlePlaceApiError } from "@/server/api-errors";
import { privateJson, requireUser } from "@/server/auth-guard";
import {
  createOrRotateLibraryInviteToken,
  revokeLibraryInviteToken,
} from "@/server/library-shares";

export async function POST() {
  try {
    const user = await requireUser();
    const inviteToken = await createOrRotateLibraryInviteToken(user.id);
    return privateJson({ inviteToken });
  } catch (error) {
    return handlePlaceApiError(error, "Could not create private invite link.");
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    await revokeLibraryInviteToken(user.id);
    return privateJson({ inviteToken: null });
  } catch (error) {
    return handlePlaceApiError(error, "Could not revoke private invite link.");
  }
}
