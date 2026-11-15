import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SignInForm } from "@/components/auth/signin-form";
import { getOptionalUser } from "@/server/auth-guard";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (await getOptionalUser()) {
    redirect("/places");
  }

  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" />}>
      <SignInForm />
    </Suspense>
  );
}
