"use client";

import { WifiOff } from "lucide-react";
import { useSyncExternalStore } from "react";

function subscribeOnlineStatus(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot(): boolean {
  return navigator.onLine;
}

function getServerSnapshot(): boolean {
  return true;
}

export function OfflineBanner() {
  const isOnline = useSyncExternalStore(
    subscribeOnlineStatus,
    getOnlineSnapshot,
    getServerSnapshot,
  );

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-amber-500/35 bg-amber-500/12 px-4 py-2 text-xs text-amber-950 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200"
    >
      <div className="mx-auto flex max-w-3xl items-center gap-2">
        <WifiOff className="size-3.5 shrink-0" aria-hidden="true" />
        <span>
          You&apos;re offline. Showing cached places and lists — reconnect to save changes or load
          Google Maps links.
        </span>
      </div>
    </div>
  );
}
