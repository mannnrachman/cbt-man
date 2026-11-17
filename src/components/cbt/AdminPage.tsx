import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

export function AdminPage({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("w-full space-y-6", className)} {...props} />
}

/**
 * The page title and description are shown in the admin shell header (the element with
 * id "admin-page-title"), so the header always names the current page. Actions stay at the
 * top of the content. Outside the admin shell the title renders in place.
 */
export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}) {
  // undefined: not mounted yet; null: no shell header on this page.
  const [slot, setSlot] = React.useState<HTMLElement | null | undefined>(undefined)
  React.useEffect(() => {
    setSlot(document.getElementById("admin-page-title"))
  }, [])

  const heading = (
    <div className="min-w-0">
      <h1 className="truncate text-title font-semibold tracking-tight text-foreground">{title}</h1>
      {description && <p className="text-ui text-muted-foreground">{description}</p>}
    </div>
  )

  return (
    <>
      {slot ? createPortal(heading, slot) : slot === null ? heading : null}
      {action && <div className="flex flex-wrap items-center justify-end gap-2">{action}</div>}
    </>
  )
}

export function AdminPageContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border border-border bg-card overflow-hidden", className)}
      {...props}
    />
  )
}
