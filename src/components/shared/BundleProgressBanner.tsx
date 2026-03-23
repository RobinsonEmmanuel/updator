import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface BundleProgressBannerProps {
  ready: number
  total: number
  className?: string
}

/** Bandeau discret pendant que les bundles WordPress (multi-sites) se terminent. */
export function BundleProgressBanner({ ready, total, className }: BundleProgressBannerProps) {
  if (total <= 0 || ready >= total) return null

  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm text-stone-700 bg-orange-50/90 border border-orange-100/80 shadow-sm shadow-orange-100/40",
        className
      )}
    >
      <Loader2 className="h-4 w-4 text-orange-500 animate-spin shrink-0" aria-hidden />
      <span>
        Chargement des sites WordPress · <strong className="font-semibold tabular-nums">{ready}</strong>
        <span className="text-stone-400"> / </span>
        <span className="tabular-nums">{total}</span> prêts — les indicateurs se mettent à jour au fil de l’eau.
      </span>
    </div>
  )
}
