"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await authClient.signOut();
      router.replace("/signin");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleSignOut}
      disabled={signingOut}
      className="w-full justify-center text-danger"
    >
      <LogOut className="size-4" aria-hidden="true" />
      {signingOut ? "Signing out..." : "Sign out"}
    </Button>
  );
}
