"use client";

import type { ComponentProps, ReactNode } from "react";
import { Drawer } from "vaul";

import { cn } from "@/lib/utils";

export function Sheet({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </Drawer.Root>
  );
}

export function SheetContent({
  className,
  children,
  ...props
}: ComponentProps<typeof Drawer.Content>) {
  return (
    <Drawer.Portal>
      <Drawer.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px]" />
      <Drawer.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90dvh] w-full max-w-xl flex-col rounded-t-3xl border-t border-border bg-surface text-ink shadow-xl outline-none",
          "pb-[max(1.25rem,env(safe-area-inset-bottom))]",
          className,
        )}
        {...props}
      >
        <div className="mx-auto mt-3 mb-2 h-1.5 w-10 shrink-0 rounded-full bg-border" />
        <div className="overflow-y-auto overscroll-contain px-5 pt-2">{children}</div>
      </Drawer.Content>
    </Drawer.Portal>
  );
}

export function SheetTitle({ className, ...props }: ComponentProps<typeof Drawer.Title>) {
  return (
    <Drawer.Title
      className={cn("font-serif text-xl font-medium tracking-tight text-ink", className)}
      {...props}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: ComponentProps<typeof Drawer.Description>) {
  return <Drawer.Description className={cn("text-sm text-muted", className)} {...props} />;
}
