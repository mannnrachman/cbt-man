import * as React from "react"
import { cn } from "@/lib/utils"

export function AdminPage({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("w-full space-y-6", className)} {...props} />

}

export function AdminPageHeader({ 
  title, 
  description, 
  action 
}: { 
  title: React.ReactNode, 
  description?: React.ReactNode, 
  action?: React.ReactNode 
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-title font-medium tracking-tight text-foreground">{title}</h1>

        {description && <p className="text-ui text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2 shrink-0">{action}</div>}
    </div>
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
