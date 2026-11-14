"use client";

import { useTheme } from "next-themes";
import { Toaster as SonnerToaster, toast } from "sonner";

import { FoodIcon } from "@/components/icons/food-icons";

export function Toaster() {
  const { resolvedTheme } = useTheme();

  return (
    <SonnerToaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="top-center"
      toastOptions={{
        classNames: {
          toast: "!rounded-2xl !border !border-border !bg-surface !text-ink !shadow-md !font-sans",
          description: "!text-muted",
          actionButton: "!bg-accent !text-accent-ink !rounded-full",
        },
      }}
    />
  );
}

export function showSavedToast(statusLabel: string) {
  toast(`Added to ${statusLabel}`, {
    icon: (
      <span className="animate-steam-wisp inline-flex text-accent">
        <FoodIcon name="bowl" className="size-5" />
      </span>
    ),
  });
}

export { toast };
