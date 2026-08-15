import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import { getShellPortalRoot, getWorkspacePortalRoot } from "@/lib/workspace-portal"

export type DialogPortalRoot = "workspace" | "shell" | "body"
export type DialogTone = "ops" | "plain"

function resolveDialogPortalContainer(
  portalRoot: DialogPortalRoot | undefined,
): HTMLElement | undefined {
  if (typeof document === "undefined") return undefined
  if (portalRoot === "body") return document.body
  if (portalRoot === "shell") return getShellPortalRoot() ?? document.body
  return getWorkspacePortalRoot() ?? undefined
}

function shouldApplyOpsDialogDna(className: string | undefined, tone: DialogTone | undefined): boolean {
  if (tone === "plain") return false
  if (tone === "ops") return true
  const value = className ?? ""
  if (value.includes("wms-ops-profile-settings")) return false
  if (value.includes("wms-ops-profile-modal")) return false
  if (value.includes("wms-date-picker")) return false
  if (value.includes("data-wms-auth")) return false
  return true
}

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  container,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return (
    <DialogPrimitive.Portal
      data-slot="dialog-portal"
      container={container ?? getWorkspacePortalRoot() ?? undefined}
      {...props}
    />
  )
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  contained = false,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay> & { contained?: boolean }) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "pointer-events-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 inset-0 bg-black/45 backdrop-blur-[2px]",
        contained ? "absolute z-0" : "fixed z-50",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  portalRoot = "body",
  tone,
  overlayClassName,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  /** Where the dialog is portaled. Default `body` centers on the full viewport (v1 parity). */
  portalRoot?: DialogPortalRoot
  /** `ops` applies Terminal/Premium dialog DNA. `plain` skips it (profile slide-over, date pickers). */
  tone?: DialogTone
  overlayClassName?: string
}) {
  const { t } = useTranslation()
  const portalContainer = resolveDialogPortalContainer(portalRoot)
  const contained = portalRoot !== "body" && portalRoot !== "shell" && Boolean(portalContainer)
  const applyOps = shouldApplyOpsDialogDna(className, tone)
  return (
    <DialogPortal data-slot="dialog-portal" container={portalContainer}>
      <DialogOverlay contained={contained} className={overlayClassName} />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        data-wms-dialog-tone={applyOps ? "ops" : "plain"}
        className={cn(
          "wms-floating-surface pointer-events-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 top-[50%] left-[50%] grid w-full max-w-[calc(100%-1rem)] translate-x-[-50%] translate-y-[-50%] gap-4 overflow-hidden overscroll-contain rounded-2xl p-4 duration-200 sm:max-w-lg sm:p-6",
          contained
            ? "absolute z-10 max-h-[calc(100%_-_1rem)] sm:max-h-[calc(100%_-_2rem)]"
            : "fixed z-50 max-h-[calc(100dvh_-_1rem)] sm:max-h-[calc(100dvh_-_2rem)]",
          applyOps && "wms-ops-detail-dialog wms-ops-form flex flex-col !gap-0 border-0 !p-0 shadow-none",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="absolute top-4 right-4 z-30 grid size-8 place-items-center text-[var(--wms-app-text-muted)] opacity-90 transition hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wms-brand-ring)] disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">{t("common.close")}</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
