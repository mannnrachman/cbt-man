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
    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 p-6 sm:p-8 bg-[#00F0FF] dark:bg-[#00F0FF] text-black border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl relative overflow-hidden mb-6">
      <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-black rounded-full opacity-10"></div>
      <div className="space-y-2 relative z-10">
        <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-black drop-shadow-[2px_2px_0px_rgba(255,255,255,1)]">{title}</h1>
        {description && <p className="text-sm font-bold text-black/80 max-w-xl">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-3 shrink-0 relative z-10">{action}</div>}
    </div>
  )
}

export function AdminPageContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      className={cn("rounded-xl border-4 border-black bg-white dark:bg-slate-900 overflow-hidden shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]", className)} 
      {...props} 
    />
  )
}
