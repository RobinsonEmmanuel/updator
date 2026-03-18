import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

interface StatCardProps {
  label: string
  value: number | string
  icon?: ReactNode
  variant?: "default" | "success" | "warning" | "danger"
  subtitle?: string
}

const variantStyles = {
  default: "text-stone-800",
  success: "text-teal-600",
  warning: "text-orange-600",
  danger: "text-red-600",
}

export function StatCard({ label, value, icon, variant = "default", subtitle }: StatCardProps) {
  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-xl p-5 shadow-sm shadow-stone-100">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-stone-500">{label}</p>
        {icon && <span className="text-stone-300">{icon}</span>}
      </div>
      <p className={cn("text-3xl font-semibold tracking-tight", variantStyles[variant])}>
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-stone-400 mt-1">{subtitle}</p>
      )}
    </div>
  )
}
