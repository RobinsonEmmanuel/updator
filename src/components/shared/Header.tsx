import { Bell } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useSites, useOpenSignals } from "@/hooks"
import { useSiteContext } from "@/lib/SiteContext"

export function Header() {
  const { selectedSiteId, setSelectedSiteId } = useSiteContext()
  const { data: sites, isLoading: sitesLoading } = useSites()
  const { data: openSignals } = useOpenSignals(selectedSiteId ?? undefined)

  const signalsCount = openSignals?.length ?? 0

  return (
    <header className="h-14 bg-white border-b border-stone-200 flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <Select
          value={selectedSiteId ?? "all"}
          onValueChange={(value) =>
            setSelectedSiteId(value === "all" ? null : value)
          }
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Tous les sites" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les sites</SelectItem>
            {!sitesLoading &&
              sites?.map((site) => (
                <SelectItem key={site.id} value={site.id}>
                  {site.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-stone-600">
          <Bell className="h-5 w-5" />
          {signalsCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {signalsCount} signal{signalsCount > 1 ? "x" : ""}
            </Badge>
          )}
        </div>
      </div>
    </header>
  )
}
