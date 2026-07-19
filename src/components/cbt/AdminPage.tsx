import * as React from "react"
import { cn } from "@/lib/utils"

export function AdminPage({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto max-w-5xl space-y-6", className)} {...props} />
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
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-zinc-100">{title}</h1>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2 shrink-0">{action}</div>}
    </div>
  )
}

export function AdminPageContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      className={cn("rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden shadow-sm", className)} 
      {...props} 
    />
  )
}
