import { cn } from "@/lib/utils"

interface ProgressBarProps {
  value: number
  max: number
  className?: string
  showLabel?: boolean
  variant?: "default" | "success" | "warning" | "danger"
}

const variantStyles = {
  default: "bg-stone-600",
  success: "bg-teal-600",
  warning: "bg-orange-500",
  danger: "bg-red-500",
}

export function ProgressBar({
  value,
  max,
  className,
  showLabel = false,
  variant = "default",
}: ProgressBarProps) {
  const percentage = max > 0 ? Math.round((value / max) * 100) : 0

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex-1 h-2 bg-stone-200 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", variantStyles[variant])}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-stone-500 w-10 text-right">{percentage}%</span>
      )}
    </div>
  )
}
