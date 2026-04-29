import { useState, useEffect, useRef, useMemo } from "react"
import { Settings as SettingsIcon, Check, X, ExternalLink, Loader2, Globe, Link2, Unlink, Search, AlertTriangle, ChevronDown } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useWpConfig, type SiteWeb } from "@/lib/WpConfigContext"
import { ingestionApiUrl, ingestionFetch } from "@/lib/api"
import { useAuth } from "@/lib/AuthContext"
import {
  useCreateTodoItem,
  useDeleteTodoItem,
  useImportLegacyTodoItems,
  useChecklistItems,
  useRegionsOverview,
  useReorderTodoItems,
  useUpdateSiteRegions,
  useUpdateTodoItem,
} from "@/hooks"
import { cn } from "@/lib/utils"
import type { ChecklistItem } from "@/types"

interface TestResult {
  success: boolean
  message: string
  postsCount?: number
  categoriesCount?: number
}

interface SyncRunStatus {
  runId: string
  status: "queued" | "processing" | "completed" | "completed_with_errors" | "failed"
  source?: "cli" | "cron" | "manual"
  startedAt?: string
  endedAt?: string
  durationMs?: number
  counts?: {
    ok: number
    skipped: number
    failed: number
  }
  totals?: {
    inserted: number
    updated: number
    softDeleted: number
    skippedNoMatch: number
    errorsCount: number
  }
}

interface SyncRunHistoryResponse {
  data: SyncRunStatus[]
}

function formatDateTime(value?: string): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("fr-FR")
}

function formatDuration(durationMs?: number): string {
  if (typeof durationMs !== "number" || durationMs < 0) return "—"
  const totalSeconds = Math.floor(durationMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${seconds}s`
}

function ConnectModal({ 
  site, 
  onClose, 
  onConnect 
}: { 
  site: SiteWeb
  onClose: () => void
  onConnect: (username: string, appPassword: string) => Promise<void>
}) {
  const { testConnection } = useWpConfig()
  const [username, setUsername] = useState("")
  const [appPassword, setAppPassword] = useState("")
  const [isTesting, setIsTesting] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [connectSuccess, setConnectSuccess] = useState(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!connectSuccess) return
    const t = window.setTimeout(() => {
      onCloseRef.current()
    }, 2800)
    return () => window.clearTimeout(t)
  }, [connectSuccess])

  const handleTest = async () => {
    if (!username || !appPassword) return
    
    setIsTesting(true)
    setTestResult(null)

    try {
      const result = await testConnection(site._id, username, appPassword)
      
      if (result.success) {
        setTestResult({
          success: true,
          message: "Connexion réussie !",
          postsCount: result.postsCount,
          categoriesCount: result.categoriesCount,
        })
      } else {
        setTestResult({
          success: false,
          message: result.error || "Erreur de connexion",
        })
      }
    } catch {
      setTestResult({
        success: false,
        message: "Erreur de connexion",
      })
    } finally {
      setIsTesting(false)
    }
  }

  const handleConnect = async () => {
    if (!username || !appPassword) return
    
    setIsConnecting(true)
    try {
      await onConnect(username, appPassword)
      setConnectSuccess(true)
    } catch {
      setTestResult({
        success: false,
        message: "Erreur lors de la connexion",
      })
    } finally {
      setIsConnecting(false)
    }
  }

  if (connectSuccess) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl text-center border border-green-100">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 ring-4 ring-green-50">
            <Check className="h-8 w-8 text-green-600" strokeWidth={2.5} />
          </div>
          <h3 className="text-lg font-semibold text-stone-900 mb-1">Site connecté</h3>
          <p className="text-sm text-stone-600 mb-2">
            <span className="font-medium text-orange-700">{site.name}</span> est bien lié à votre compte.
          </p>
          <p className="text-xs text-stone-500">
            Vous pouvez utiliser ce site depuis le tableau de bord et la file d’attente.
          </p>
          <p className="text-xs text-stone-400 mt-4">Fermeture automatique…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-100 to-orange-200 rounded-lg flex items-center justify-center">
            <Globe className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h3 className="font-semibold text-stone-800">{site.name}</h3>
            <p className="text-sm text-stone-500">{site.url.replace(/^https?:\/\//, "")}</p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">
              Identifiant WordPress
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="votre_identifiant"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">
              Mot de passe application
            </label>
            <input
              type="password"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="xxxx xxxx xxxx xxxx"
            />
          </div>
        </div>

        {testResult && (
          <div
            className={cn(
              "mb-4 text-sm px-3 py-2 rounded-lg",
              testResult.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            )}
          >
            <div className="flex items-center gap-2">
              {testResult.success ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              <span>{testResult.message}</span>
            </div>
            {testResult.success && (
              <div className="mt-1 text-xs opacity-75">
                {testResult.postsCount} articles · {testResult.categoriesCount} catégories
              </div>
            )}
          </div>
        )}

        <div className="bg-amber-50 rounded-lg p-3 mb-6">
          <p className="text-xs text-amber-700">
            <strong>Comment obtenir un mot de passe application :</strong>
            <br />
            WordPress Admin → Utilisateurs → Profil → Mots de passe d'application
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleTest}
            disabled={isTesting || !username || !appPassword}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              "bg-stone-100 text-stone-700 hover:bg-stone-200",
              (isTesting || !username || !appPassword) && "opacity-50 cursor-not-allowed"
            )}
          >
            {isTesting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Test...
              </>
            ) : (
              "Tester"
            )}
          </button>

          <button
            onClick={handleConnect}
            disabled={isConnecting || !username || !appPassword}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              "bg-orange-500 text-white hover:bg-orange-600",
              (isConnecting || !username || !appPassword) && "opacity-50 cursor-not-allowed"
            )}
          >
            {isConnecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Connexion...
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4" />
                Se connecter
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 text-stone-500 hover:text-stone-700 text-sm"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}

function SiteCard({ 
  site, 
  isConnected, 
  regionNames = [],
  onConnect, 
  onDisconnect,
  onEditRegions,
}: { 
  site: SiteWeb
  isConnected: boolean
  regionNames?: string[]
  onConnect: () => void
  onDisconnect: () => void
  onEditRegions?: () => void
}) {
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [showRegions, setShowRegions] = useState(false)

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    try {
      await onDisconnect()
    } finally {
      setIsDisconnecting(false)
    }
  }

  return (
    <div className={cn(
      "bg-white/60 backdrop-blur-sm rounded-xl p-4 shadow-sm shadow-stone-100 transition-all",
      isConnected && "ring-2 ring-green-500/30"
    )}>
      <div className="flex items-center justify-between min-h-[56px]">
        <div>
          <h3 className="font-medium text-stone-800">{site.name}</h3>
          <a
            href={site.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-stone-500 hover:text-orange-600 flex items-center gap-1"
          >
            {site.url.replace(/^https?:\/\//, "")}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <button
                onClick={() => setShowRegions((v) => !v)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                  showRegions
                    ? "bg-amber-200 text-amber-900"
                    : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                )}
              >
                Zones ({regionNames.length}) {showRegions ? "▲" : "▼"}
              </button>
              <button
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                title="Déconnecter"
                className={cn(
                  "flex items-center justify-center px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all",
                  "bg-red-50 text-red-600 hover:bg-red-100",
                  isDisconnecting && "opacity-50 cursor-not-allowed"
                )}
              >
                {isDisconnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Unlink className="h-4 w-4" />
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setShowRegions((v) => !v)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                  showRegions
                    ? "bg-amber-200 text-amber-900"
                    : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                )}
              >
                Zones ({regionNames.length}) {showRegions ? "▲" : "▼"}
              </button>
              <button
                onClick={onConnect}
                title="Se connecter"
                className="flex items-center justify-center px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all bg-orange-100 text-orange-700 hover:bg-orange-200"
              >
                <Link2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <div
        className={cn(
          "grid transition-all duration-300 ease-out",
          showRegions ? "grid-rows-[1fr] opacity-100 mt-3" : "grid-rows-[0fr] opacity-0 mt-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="pt-3 border-t border-stone-200">
            <p className="text-xs text-stone-500 leading-relaxed break-words min-h-[18px]">
              {regionNames.length > 0 ? regionNames.join(" · ") : "Aucune zone associée pour le moment."}
            </p>
            {onEditRegions && (
              <button
                type="button"
                onClick={onEditRegions}
                className="mt-2 px-2.5 py-1 rounded-md text-xs text-stone-700 bg-stone-100 hover:bg-stone-200"
              >
                Ouvrir le panneau zones
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function RegionsModal({
  site,
  allRegions,
  onClose,
  onSave,
  isSaving,
}: {
  site: SiteWeb
  allRegions: Array<{
    id: string
    name: string
    assignedSiteIds: string[]
    assignedSiteNames: string[]
    isUnassigned: boolean
  }>
  onClose: () => void
  onSave: (regionIds: string[]) => Promise<void>
  isSaving: boolean
}) {
  const [checkedRegionIds, setCheckedRegionIds] = useState<string[]>(site.regionIds || [])
  const [regionSearch, setRegionSearch] = useState("")
  const [onlyCurrentSite, setOnlyCurrentSite] = useState(false)

  useEffect(() => {
    setCheckedRegionIds(site.regionIds || [])
    setRegionSearch("")
    setOnlyCurrentSite(false)
  }, [site._id, site.regionIds])

  const filteredRegions = useMemo(() => {
    const query = regionSearch.trim().toLowerCase()
    if (!query) return allRegions
    return allRegions.filter((r) => r.name.toLowerCase().includes(query) || r.id.toLowerCase().includes(query))
  }, [allRegions, regionSearch])

  const crossSiteWarnings = useMemo(() => {
    return checkedRegionIds
      .map((regionId) => allRegions.find((r) => r.id === regionId))
      .filter((region): region is NonNullable<typeof region> => !!region)
      .filter((region) => region.assignedSiteIds.some((id) => id !== site._id))
      .map((region) => ({
        regionId: region.id,
        regionName: region.name,
        otherSiteNames: region.assignedSiteNames.filter((_name, idx) => region.assignedSiteIds[idx] !== site._id),
      }))
  }, [allRegions, checkedRegionIds, site._id])

  const groupedRegions = useMemo(() => {
    const currentSite = filteredRegions.filter((region) => checkedRegionIds.includes(region.id))
    const unassigned = filteredRegions.filter(
      (region) => !checkedRegionIds.includes(region.id) && region.assignedSiteIds.length === 0
    )
    const assignedElsewhere = filteredRegions.filter(
      (region) => !checkedRegionIds.includes(region.id) && region.assignedSiteIds.length > 0
    )
    return { currentSite, unassigned, assignedElsewhere }
  }, [checkedRegionIds, filteredRegions])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-3xl shadow-xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-stone-900">Régions RL · {site.name}</h3>
            <p className="text-sm text-stone-500">Ajoutez/retirez des associations région/site.</p>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <input
            value={regionSearch}
            onChange={(e) => setRegionSearch(e.target.value)}
            placeholder="Rechercher une région RL (nom ou ID)…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-200 bg-white text-sm"
          />
        </div>

        <div className="flex items-center justify-between text-xs">
          <label className="inline-flex items-center gap-2 text-stone-600">
            <input
              type="checkbox"
              checked={onlyCurrentSite}
              onChange={(e) => setOnlyCurrentSite(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-stone-300"
            />
            Lecture: seulement les régions de ce site
          </label>
          <span className="text-stone-500">
            {checkedRegionIds.length} sélectionnée{checkedRegionIds.length > 1 ? "s" : ""}
          </span>
        </div>

        <div className="max-h-72 overflow-auto rounded-lg border border-stone-100 bg-white p-2 space-y-3">
          {filteredRegions.length === 0 ? (
            <p className="p-3 text-sm text-stone-500">Aucune région trouvée.</p>
          ) : (
            <>
              <div>
                <p className="px-2 pb-1 text-xs font-medium text-green-700">
                  Assignées à ce site ({groupedRegions.currentSite.length})
                </p>
                {groupedRegions.currentSite.length === 0 ? (
                  <p className="px-2 py-1 text-xs text-stone-400">Aucune.</p>
                ) : (
                  <div className="space-y-1">
                    {groupedRegions.currentSite.map((region) => (
                      <button
                        key={region.id}
                        type="button"
                        onClick={() =>
                          setCheckedRegionIds((prev) => prev.filter((id) => id !== region.id))
                        }
                        className="w-full flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-2.5 py-2 text-left hover:bg-green-100"
                      >
                        <p className="text-sm text-stone-800 truncate">
                          {region.name || "(sans nom)"} · <span className="font-mono text-xs">{region.id}</span>
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {!onlyCurrentSite && (
                <>
                  <div>
                    <p className="px-2 pb-1 text-xs font-medium text-sky-700">
                      Non assignées ({groupedRegions.unassigned.length})
                    </p>
                    {groupedRegions.unassigned.length === 0 ? (
                      <p className="px-2 py-1 text-xs text-stone-400">Aucune.</p>
                    ) : (
                      <div className="space-y-1">
                        {groupedRegions.unassigned.map((region) => (
                          <button
                            key={region.id}
                            type="button"
                            onClick={() =>
                              setCheckedRegionIds((prev) => [...new Set([...prev, region.id])])
                            }
                            className="w-full flex items-center justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-2 text-left hover:bg-sky-100"
                          >
                            <p className="text-sm text-stone-800 truncate">
                              {region.name || "(sans nom)"} · <span className="font-mono text-xs">{region.id}</span>
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="px-2 pb-1 text-xs font-medium text-amber-700">
                      Assignées à un/plusieurs autres sites ({groupedRegions.assignedElsewhere.length})
                    </p>
                    {groupedRegions.assignedElsewhere.length === 0 ? (
                      <p className="px-2 py-1 text-xs text-stone-400">Aucune.</p>
                    ) : (
                      <div className="space-y-1">
                        {groupedRegions.assignedElsewhere.map((region) => (
                          <button
                            key={region.id}
                            type="button"
                            onClick={() =>
                              setCheckedRegionIds((prev) => [...new Set([...prev, region.id])])
                            }
                            className="w-full flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-left hover:bg-amber-100"
                          >
                            <div className="min-w-0">
                              <p className="text-sm text-stone-800 truncate">
                                {region.name || "(sans nom)"} · <span className="font-mono text-xs">{region.id}</span>
                              </p>
                              <p className="text-[11px] text-stone-500 truncate">Déjà sur {region.assignedSiteNames.join(", ")}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {crossSiteWarnings.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-800 mb-1 inline-flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Régions partagées avec d’autres sites (autorisé)
            </p>
            <div className="space-y-1 max-h-24 overflow-auto">
              {crossSiteWarnings.map((warning) => (
                <p key={warning.regionId} className="text-xs text-amber-800">
                  {warning.regionName} · aussi sur {warning.otherSiteNames.join(", ")}
                </p>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-sm text-stone-700 bg-stone-100 hover:bg-stone-200"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => void onSave(checkedRegionIds)}
            disabled={isSaving}
            className="px-3 py-1.5 rounded-lg text-sm text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60"
          >
            Sauver ({checkedRegionIds.length})
          </button>
        </div>
      </div>
    </div>
  )
}

function UnassignedRegionsModal({
  regions,
  onClose,
}: {
  regions: Array<{ id: string; name: string }>
  onClose: () => void
}) {
  const [search, setSearch] = useState("")
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return regions
    return regions.filter((r) => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q))
  }, [regions, search])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-stone-900">Régions RL non associées</h3>
            <p className="text-sm text-stone-500">
              {regions.length} région{regions.length > 1 ? "s" : ""} sans site.
            </p>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une région RL (nom ou ID)…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-200 bg-white text-sm"
          />
        </div>

        <div className="max-h-80 overflow-auto rounded-lg border border-stone-100 bg-white p-2">
          {filtered.length === 0 ? (
            <p className="p-3 text-sm text-stone-500">Aucune région trouvée.</p>
          ) : (
            <div className="space-y-1">
              {filtered.map((region) => (
                <div
                  key={region.id}
                  className="w-full rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-2"
                >
                  <p className="text-sm text-stone-800 truncate">
                    {region.name || "(sans nom)"} · <span className="font-mono text-xs">{region.id}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-sm text-stone-700 bg-stone-100 hover:bg-stone-200"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

function SyncHealthCard({
  latestRun,
  runs,
  isLoading,
  isTriggering,
  canTrigger,
  error,
  onTrigger,
}: {
  latestRun: SyncRunStatus | null
  runs: SyncRunStatus[]
  isLoading: boolean
  isTriggering: boolean
  canTrigger: boolean
  error: string | null
  onTrigger: () => Promise<void>
}) {
  const status = latestRun?.status || "—"
  const statusClass =
    status === "completed"
      ? "text-green-700 bg-green-100"
      : status === "completed_with_errors"
        ? "text-amber-700 bg-amber-100"
        : status === "failed"
          ? "text-red-700 bg-red-100"
          : "text-stone-700 bg-stone-100"

  return (
    <section className="mb-8 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-stone-900">Santé du sync articles_raw</h2>
          <p className="text-sm text-stone-500">
            Cron quotidien attendu: nuit (Railway Job). Source unique: `articles_raw`.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onTrigger()}
          disabled={!canTrigger || isTriggering}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium",
            "bg-orange-500 text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          )}
        >
          {isTriggering ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Relancer la sync
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-lg bg-stone-50 p-3">
          <p className="text-xs uppercase tracking-wide text-stone-500">Statut</p>
          <span className={cn("mt-1 inline-flex rounded-full px-2 py-1 text-xs font-semibold", statusClass)}>
            {status}
          </span>
        </div>
        <div className="rounded-lg bg-stone-50 p-3">
          <p className="text-xs uppercase tracking-wide text-stone-500">Dernier run</p>
          <p className="mt-1 text-sm text-stone-800">{formatDateTime(latestRun?.startedAt)}</p>
        </div>
        <div className="rounded-lg bg-stone-50 p-3">
          <p className="text-xs uppercase tracking-wide text-stone-500">Durée</p>
          <p className="mt-1 text-sm text-stone-800">{formatDuration(latestRun?.durationMs)}</p>
        </div>
        <div className="rounded-lg bg-stone-50 p-3">
          <p className="text-xs uppercase tracking-wide text-stone-500">Compteurs</p>
          <p className="mt-1 text-sm text-stone-800">
            +{latestRun?.totals?.inserted || 0} / ~{latestRun?.totals?.updated || 0} / -{latestRun?.totals?.softDeleted || 0}
          </p>
        </div>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="mt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">Historique récent</p>
        {isLoading ? (
          <div className="py-3 text-sm text-stone-500">Chargement…</div>
        ) : runs.length === 0 ? (
          <div className="py-3 text-sm text-stone-500">Aucun run enregistré.</div>
        ) : (
          <div className="max-h-48 space-y-2 overflow-auto">
            {runs.map((run) => (
              <div key={run.runId} className="flex items-center justify-between rounded-lg border border-stone-100 px-3 py-2 text-xs">
                <span className="font-mono text-stone-500">{run.runId.slice(0, 8)}</span>
                <span className="text-stone-700">{run.source || "—"}</span>
                <span className="text-stone-700">{run.status}</span>
                <span className="text-stone-500">{formatDateTime(run.startedAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

const TODO_CATEGORY_OPTIONS = ["liens", "contenu", "technique", "traduction", "structure"]

interface TodoFormState {
  title: string
  description: string
  active: boolean
  order: number
  category: string
  mainPrompt: string
  additionalPrompts: string[]
  technicalExamples: string[]
  technicalNotes: string
}

function cleanStringArray(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean)
}

function toFormState(item?: ChecklistItem): TodoFormState {
  if (!item) {
    return {
      title: "",
      description: "",
      active: true,
      order: 0,
      category: "contenu",
      mainPrompt: "",
      additionalPrompts: [],
      technicalExamples: [],
      technicalNotes: "",
    }
  }

  return {
    title: item.title || item.label || "",
    description: item.description || "",
    active: item.active,
    order: item.order,
    category: item.category || "contenu",
    mainPrompt: item.mainPrompt || "",
    additionalPrompts: item.additionalPrompts || [],
    technicalExamples: item.technicalHints?.examples || [],
    technicalNotes: item.technicalHints?.notes || "",
  }
}

function TodoConfigSection() {
  const checklistQuery = useChecklistItems()
  const createTodoItem = useCreateTodoItem()
  const updateTodoItem = useUpdateTodoItem()
  const deleteTodoItem = useDeleteTodoItem()
  const reorderTodoItems = useReorderTodoItems()
  const importLegacyTodoItems = useImportLegacyTodoItems()

  const [createForm, setCreateForm] = useState<TodoFormState>(toFormState())
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<TodoFormState>(toFormState())

  const items = useMemo(
    () => [...(checklistQuery.data || [])].sort((a, b) => a.order - b.order),
    [checklistQuery.data]
  )

  const busy =
    checklistQuery.isLoading ||
    createTodoItem.isPending ||
    updateTodoItem.isPending ||
    deleteTodoItem.isPending ||
    reorderTodoItems.isPending ||
    importLegacyTodoItems.isPending

  const handleCreate = async () => {
    if (!createForm.title.trim()) return
    await createTodoItem.mutateAsync({
      title: createForm.title.trim(),
      description: createForm.description.trim(),
      active: createForm.active,
      order: createForm.order > 0 ? createForm.order : undefined,
      category: createForm.category.trim() || "contenu",
      mainPrompt: createForm.mainPrompt.trim(),
      additionalPrompts: cleanStringArray(createForm.additionalPrompts),
      technicalHints: {
        examples: cleanStringArray(createForm.technicalExamples),
        notes: createForm.technicalNotes.trim(),
      },
    })
    setCreateForm(toFormState())
    setShowCreateModal(false)
  }

  const startEditing = (item: ChecklistItem) => {
    setEditingId(item.id)
    setExpandedItemId(item.id)
    setEditForm(toFormState(item))
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditForm(toFormState())
  }

  const saveEditing = async () => {
    if (!editingId || !editForm.title.trim()) return
    await updateTodoItem.mutateAsync({
      id: editingId,
      title: editForm.title.trim(),
      description: editForm.description.trim(),
      active: editForm.active,
      order: editForm.order,
      category: editForm.category.trim() || "contenu",
      mainPrompt: editForm.mainPrompt.trim(),
      additionalPrompts: cleanStringArray(editForm.additionalPrompts),
      technicalHints: {
        examples: cleanStringArray(editForm.technicalExamples),
        notes: editForm.technicalNotes.trim(),
      },
    })
    cancelEditing()
  }

  const reorderByOffset = async (id: string, offset: -1 | 1) => {
    const index = items.findIndex((item) => item.id === id)
    if (index < 0) return
    const nextIndex = index + offset
    if (nextIndex < 0 || nextIndex >= items.length) return
    const reordered = [...items]
    const [entry] = reordered.splice(index, 1)
    reordered.splice(nextIndex, 0, entry)
    await reorderTodoItems.mutateAsync(reordered.map((item) => item.id))
  }

  const toggleItemActive = async (item: ChecklistItem) => {
    if (editingId === item.id) {
      setEditForm((prev) => ({ ...prev, active: !prev.active }))
      return
    }
    await updateTodoItem.mutateAsync({ id: item.id, active: !item.active })
  }

  const addEditAdditionalPrompt = () => setEditForm((prev) => ({ ...prev, additionalPrompts: [...prev.additionalPrompts, ""] }))
  const updateEditAdditionalPrompt = (index: number, value: string) =>
    setEditForm((prev) => ({
      ...prev,
      additionalPrompts: prev.additionalPrompts.map((entry, i) => (i === index ? value : entry)),
    }))
  const removeEditAdditionalPrompt = (index: number) =>
    setEditForm((prev) => ({
      ...prev,
      additionalPrompts: prev.additionalPrompts.filter((_, i) => i !== index),
    }))

  const addEditTechnicalExample = () => setEditForm((prev) => ({ ...prev, technicalExamples: [...prev.technicalExamples, ""] }))
  const updateEditTechnicalExample = (index: number, value: string) =>
    setEditForm((prev) => ({
      ...prev,
      technicalExamples: prev.technicalExamples.map((entry, i) => (i === index ? value : entry)),
    }))
  const removeEditTechnicalExample = (index: number) =>
    setEditForm((prev) => ({
      ...prev,
      technicalExamples: prev.technicalExamples.filter((_, i) => i !== index),
    }))

  const addCreateAdditionalPrompt = () =>
    setCreateForm((prev) => ({ ...prev, additionalPrompts: [...prev.additionalPrompts, ""] }))
  const updateCreateAdditionalPrompt = (index: number, value: string) =>
    setCreateForm((prev) => ({
      ...prev,
      additionalPrompts: prev.additionalPrompts.map((entry, i) => (i === index ? value : entry)),
    }))
  const removeCreateAdditionalPrompt = (index: number) =>
    setCreateForm((prev) => ({
      ...prev,
      additionalPrompts: prev.additionalPrompts.filter((_, i) => i !== index),
    }))

  const addCreateTechnicalExample = () =>
    setCreateForm((prev) => ({ ...prev, technicalExamples: [...prev.technicalExamples, ""] }))
  const updateCreateTechnicalExample = (index: number, value: string) =>
    setCreateForm((prev) => ({
      ...prev,
      technicalExamples: prev.technicalExamples.map((entry, i) => (i === index ? value : entry)),
    }))
  const removeCreateTechnicalExample = (index: number) =>
    setCreateForm((prev) => ({
      ...prev,
      technicalExamples: prev.technicalExamples.filter((_, i) => i !== index),
    }))

  return (
    <section className="mb-8 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-stone-900">Configuration Todo mise à jour</h2>
          <p className="text-sm text-stone-500">CRUD complet des items + prompts IA + aides techniques.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void importLegacyTodoItems.mutateAsync(false)}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg text-xs bg-stone-100 text-stone-700 hover:bg-stone-200 disabled:opacity-60"
          >
            Importer la base actuelle
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 rounded-lg text-xs bg-orange-500 text-white hover:bg-orange-600"
          >
            Créer un item
          </button>
        </div>
      </div>

      {(checklistQuery.error || createTodoItem.error || updateTodoItem.error || deleteTodoItem.error || reorderTodoItems.error || importLegacyTodoItems.error) ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {(checklistQuery.error as Error | null)?.message ||
            (createTodoItem.error as Error | null)?.message ||
            (updateTodoItem.error as Error | null)?.message ||
            (deleteTodoItem.error as Error | null)?.message ||
            (reorderTodoItems.error as Error | null)?.message ||
            (importLegacyTodoItems.error as Error | null)?.message}
        </p>
      ) : null}

      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-stone-500">Aucun item pour le moment.</p>
        ) : null}
        {items.map((item) => {
          const isEditing = editingId === item.id
          const isExpanded = expandedItemId === item.id || isEditing
          const model = isEditing ? editForm : toFormState(item)
          return (
            <div key={item.id} className="rounded-xl border border-stone-200 bg-white p-3 space-y-2">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700">#{item.order}</span>
                    <span className="font-medium text-stone-800">{item.title}</span>
                    <span className={cn("px-2 py-0.5 rounded", item.active ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-600")}>
                      {item.active ? "Actif" : "Inactif"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-stone-600 line-clamp-2">{item.description || "Aucune description"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setExpandedItemId((prev) => (prev === item.id ? null : item.id))}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-stone-200 text-xs text-stone-700 hover:bg-stone-50"
                >
                  Détails
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isExpanded ? "rotate-180" : "")} />
                </button>
              </div>

              {isExpanded ? (
                <>
                  <div className="flex flex-wrap items-center gap-1 text-xs pt-1">
                    <button type="button" onClick={() => void reorderByOffset(item.id, -1)} className="px-2 py-1 rounded border border-stone-200 hover:bg-stone-50">↑</button>
                    <button type="button" onClick={() => void reorderByOffset(item.id, 1)} className="px-2 py-1 rounded border border-stone-200 hover:bg-stone-50">↓</button>
                    <button
                      type="button"
                      onClick={() => void toggleItemActive(item)}
                      className={cn(
                        "px-2 py-1 rounded border text-xs",
                        item.active ? "border-green-200 text-green-700 hover:bg-green-50" : "border-stone-200 text-stone-700 hover:bg-stone-50"
                      )}
                    >
                      {item.active ? "Désactiver" : "Activer"}
                    </button>
                    {!isEditing ? (
                      <button type="button" onClick={() => startEditing(item)} className="px-2 py-1 rounded border border-stone-200 hover:bg-stone-50">Éditer</button>
                    ) : (
                      <>
                        <button type="button" onClick={() => void saveEditing()} className="px-2 py-1 rounded bg-emerald-500 text-white hover:bg-emerald-600">Sauver</button>
                        <button type="button" onClick={cancelEditing} className="px-2 py-1 rounded border border-stone-200 hover:bg-stone-50">Annuler</button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm(`Supprimer "${item.title}" ?`)) return
                        void deleteTodoItem.mutateAsync(item.id)
                      }}
                      className="px-2 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50"
                    >
                      Suppr.
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input
                      value={model.title}
                      disabled={!isEditing}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
                      className="px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm disabled:bg-stone-50"
                    />
                    <select
                      value={model.category}
                      disabled={!isEditing}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, category: event.target.value }))}
                      className="px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm disabled:bg-stone-50"
                    >
                      {TODO_CATEGORY_OPTIONS.map((category) => (
                        <option key={`${item.id}-category-${category}`} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={model.order}
                      disabled={!isEditing}
                      onChange={(event) =>
                        setEditForm((prev) => ({ ...prev, order: Math.max(1, Number.parseInt(event.target.value || "1", 10)) }))
                      }
                      className="px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm disabled:bg-stone-50"
                    />
                    <textarea
                      value={model.description}
                      disabled={!isEditing}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
                      className="px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm md:col-span-2 min-h-16 disabled:bg-stone-50"
                    />
                    <textarea
                      value={model.mainPrompt}
                      disabled={!isEditing}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, mainPrompt: event.target.value }))}
                      className="px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm md:col-span-2 min-h-20 disabled:bg-stone-50"
                    />
                    <div className="rounded-lg border border-stone-200 bg-stone-50 p-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-stone-600">Prompts additionnels</p>
                        <button
                          type="button"
                          disabled={!isEditing}
                          onClick={addEditAdditionalPrompt}
                          className="px-2 py-1 rounded text-xs border border-stone-200 bg-white hover:bg-stone-100 disabled:opacity-60"
                        >
                          + Ajouter
                        </button>
                      </div>
                      {model.additionalPrompts.length === 0 ? <p className="text-[11px] text-stone-500">Aucun prompt additionnel.</p> : null}
                      {model.additionalPrompts.map((prompt, index) => (
                        <div key={`${item.id}-prompt-${index}`} className="flex items-center gap-1.5">
                          <input
                            value={prompt}
                            disabled={!isEditing}
                            onChange={(event) => updateEditAdditionalPrompt(index, event.target.value)}
                            className="flex-1 px-2 py-1.5 rounded border border-stone-200 bg-white text-xs disabled:bg-stone-50"
                          />
                          <button
                            type="button"
                            disabled={!isEditing}
                            onClick={() => removeEditAdditionalPrompt(index)}
                            className="px-2 py-1 rounded text-xs border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60"
                          >
                            Suppr.
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-lg border border-stone-200 bg-stone-50 p-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-stone-600">Exemples techniques</p>
                        <button
                          type="button"
                          disabled={!isEditing}
                          onClick={addEditTechnicalExample}
                          className="px-2 py-1 rounded text-xs border border-stone-200 bg-white hover:bg-stone-100 disabled:opacity-60"
                        >
                          + Ajouter
                        </button>
                      </div>
                      {model.technicalExamples.length === 0 ? <p className="text-[11px] text-stone-500">Aucun exemple technique.</p> : null}
                      {model.technicalExamples.map((example, index) => (
                        <div key={`${item.id}-example-${index}`} className="flex items-center gap-1.5">
                          <input
                            value={example}
                            disabled={!isEditing}
                            onChange={(event) => updateEditTechnicalExample(index, event.target.value)}
                            className="flex-1 px-2 py-1.5 rounded border border-stone-200 bg-white text-xs disabled:bg-stone-50"
                          />
                          <button
                            type="button"
                            disabled={!isEditing}
                            onClick={() => removeEditTechnicalExample(index)}
                            className="px-2 py-1 rounded text-xs border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60"
                          >
                            Suppr.
                          </button>
                        </div>
                      ))}
                    </div>
                    <textarea
                      value={model.technicalNotes}
                      disabled={!isEditing}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, technicalNotes: event.target.value }))}
                      className="px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm min-h-16 disabled:bg-stone-50"
                    />
                  </div>

                  <div className="text-[11px] text-stone-500">Statut: {model.active ? "Actif" : "Inactif"}</div>
                </>
              ) : null}
            </div>
          )
        })}
      </div>

      {showCreateModal ? (
        <div
          className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border border-stone-200 bg-white shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-stone-900">Créer un item Todo</h3>
                <p className="text-xs text-stone-500">Configure le contenu, les prompts et les aides techniques.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-stone-100 text-stone-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  value={createForm.title}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Titre (obligatoire)"
                  className="px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm"
                />
                <select
                  value={createForm.category}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, category: event.target.value }))}
                  className="px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm"
                >
                  {TODO_CATEGORY_OPTIONS.map((category) => (
                    <option key={`create-category-${category}`} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  value={createForm.order}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, order: Math.max(0, Number.parseInt(event.target.value || "0", 10)) }))
                  }
                  placeholder="Ordre (0 = auto)"
                  className="px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm"
                />
                <label className="inline-flex items-center gap-2 px-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={createForm.active}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, active: event.target.checked }))}
                    className="h-4 w-4 rounded border-stone-300"
                  />
                  Actif
                </label>
                <textarea
                  value={createForm.description}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Description"
                  className="px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm md:col-span-2 min-h-16"
                />
                <textarea
                  value={createForm.mainPrompt}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, mainPrompt: event.target.value }))}
                  placeholder="Prompt principal"
                  className="px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm md:col-span-2 min-h-20"
                />
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-stone-600">Prompts additionnels</p>
                    <button
                      type="button"
                      onClick={addCreateAdditionalPrompt}
                      className="px-2 py-1 rounded text-xs border border-stone-200 bg-white hover:bg-stone-100"
                    >
                      + Ajouter
                    </button>
                  </div>
                  {createForm.additionalPrompts.length === 0 ? <p className="text-[11px] text-stone-500">Aucun prompt additionnel.</p> : null}
                  {createForm.additionalPrompts.map((prompt, index) => (
                    <div key={`create-prompt-${index}`} className="flex items-center gap-1.5">
                      <input
                        value={prompt}
                        onChange={(event) => updateCreateAdditionalPrompt(index, event.target.value)}
                        className="flex-1 px-2 py-1.5 rounded border border-stone-200 bg-white text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => removeCreateAdditionalPrompt(index)}
                        className="px-2 py-1 rounded text-xs border border-red-200 text-red-700 hover:bg-red-50"
                      >
                        Suppr.
                      </button>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-stone-600">Exemples techniques</p>
                    <button
                      type="button"
                      onClick={addCreateTechnicalExample}
                      className="px-2 py-1 rounded text-xs border border-stone-200 bg-white hover:bg-stone-100"
                    >
                      + Ajouter
                    </button>
                  </div>
                  {createForm.technicalExamples.length === 0 ? <p className="text-[11px] text-stone-500">Aucun exemple technique.</p> : null}
                  {createForm.technicalExamples.map((example, index) => (
                    <div key={`create-example-${index}`} className="flex items-center gap-1.5">
                      <input
                        value={example}
                        onChange={(event) => updateCreateTechnicalExample(index, event.target.value)}
                        className="flex-1 px-2 py-1.5 rounded border border-stone-200 bg-white text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => removeCreateTechnicalExample(index)}
                        className="px-2 py-1 rounded text-xs border border-red-200 text-red-700 hover:bg-red-50"
                      >
                        Suppr.
                      </button>
                    </div>
                  ))}
                </div>
                <textarea
                  value={createForm.technicalNotes}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, technicalNotes: event.target.value }))}
                  placeholder="Notes techniques / IA"
                  className="px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm min-h-16"
                />
              </div>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-stone-200 px-4 py-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 rounded-lg border border-stone-200 text-sm text-stone-700 hover:bg-stone-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={busy || !createForm.title.trim()}
                className="px-3 py-1.5 rounded-lg text-sm bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60"
              >
                Créer l’item
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export function Settings() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { availableSites, connectedSites, isLoading, error, connectToSite, disconnectFromSite, isConnected } = useWpConfig()
  const [activeTab, setActiveTab] = useState<"connectivity" | "todo" | "cron">("connectivity")
  const [connectingSite, setConnectingSite] = useState<SiteWeb | null>(null)
  const [editingRegionsSite, setEditingRegionsSite] = useState<SiteWeb | null>(null)
  const [showUnassignedRegions, setShowUnassignedRegions] = useState(false)
  const isAdmin = user?.role === "admin"

  const regionsOverview = useRegionsOverview()
  const updateRegions = useUpdateSiteRegions(editingRegionsSite?._id)
  const regionNameById = useMemo(
    () => new Map((regionsOverview.data?.data || []).map((r) => [r.id, r.name || r.id])),
    [regionsOverview.data?.data]
  )
  const unassignedRegions = useMemo(
    () =>
      (regionsOverview.data?.data || [])
        .filter((r) => r.isUnassigned)
        .map((r) => ({ id: r.id, name: r.name || r.id })),
    [regionsOverview.data?.data]
  )

  const syncStatusQuery = useQuery({
    queryKey: ["ingestion-sync-status"],
    queryFn: async (): Promise<SyncRunStatus | null> => {
      const res = await ingestionFetch(ingestionApiUrl("/api/v1/ingest/articles-raw-sync/status"))
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || "Impossible de charger le statut du sync")
      }
      return (await res.json()) as SyncRunStatus | null
    },
    enabled: isAdmin && activeTab === "cron",
    refetchInterval: (query) => {
      const run = query.state.data as SyncRunStatus | null
      if (run?.status === "queued" || run?.status === "processing") return 8000
      return 30000
    },
  })

  const syncRunsQuery = useQuery({
    queryKey: ["ingestion-sync-runs"],
    queryFn: async (): Promise<SyncRunHistoryResponse> => {
      const res = await ingestionFetch(ingestionApiUrl("/api/v1/ingest/articles-raw-sync/runs?limit=20"))
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || "Impossible de charger l'historique du sync")
      }
      return (await res.json()) as SyncRunHistoryResponse
    },
    enabled: isAdmin && activeTab === "cron",
    refetchInterval: 30000,
  })

  const triggerSyncMutation = useMutation({
    mutationFn: async () => {
      const res = await ingestionFetch(ingestionApiUrl("/api/v1/ingest/articles-raw-sync/trigger"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "all", writeMode: "insert-missing" }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error || "Impossible de lancer la sync")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingestion-sync-status"] })
      queryClient.invalidateQueries({ queryKey: ["ingestion-sync-runs"] })
    },
  })

  if (error) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          Erreur de connexion au serveur. Vérifiez que le backend est lancé.
        </div>
      </div>
    )
  }

  const handleConnect = async (username: string, appPassword: string) => {
    if (!connectingSite) return
    await connectToSite(connectingSite._id, username, appPassword)
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-stone-100 to-stone-200 rounded-xl flex items-center justify-center">
            <SettingsIcon className="h-5 w-5 text-stone-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-stone-800">Paramètres</h1>
            <p className="text-sm text-stone-500">Configuration de l’outil d’actualisation</p>
          </div>
        </div>
      </div>

      <div className="mb-5">
        <div className="inline-flex rounded-xl border border-stone-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab("connectivity")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm",
              activeTab === "connectivity" ? "bg-orange-100 text-orange-800 font-medium" : "text-stone-600 hover:bg-stone-50"
            )}
          >
            Connectivité aux sites
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("todo")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm",
              activeTab === "todo" ? "bg-emerald-100 text-emerald-800 font-medium" : "text-stone-600 hover:bg-stone-50"
            )}
          >
            Config Todo
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("cron")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm",
              activeTab === "cron" ? "bg-sky-100 text-sky-800 font-medium" : "text-stone-600 hover:bg-stone-50"
            )}
          >
            Rapport cron
          </button>
        </div>
      </div>

      {activeTab === "connectivity" ? (
        <>
          <div className="flex items-center justify-end mb-5">
            <button
              type="button"
              onClick={() => setShowUnassignedRegions(true)}
              className="px-3 py-1.5 rounded-lg text-sm text-sky-700 bg-sky-100 hover:bg-sky-200"
            >
              Régions non associées ({unassignedRegions.length})
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-start">
            {/* Colonne gauche — sites connectés */}
            <section className="min-w-0">
              <h2 className="text-sm font-medium text-stone-500 mb-4 flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500 shrink-0" />
                Mes sites connectés
                <span className="text-stone-400 font-normal">({connectedSites.length})</span>
              </h2>
              {connectedSites.length > 0 ? (
                <div className="space-y-3">
                  {connectedSites.map((site) => (
                    <SiteCard
                      key={site._id}
                      site={site}
                      isConnected={true}
                      regionNames={(site.regionIds || []).map((id) => regionNameById.get(id) || id)}
                      onConnect={() => {}}
                      onDisconnect={() => disconnectFromSite(site._id)}
                      onEditRegions={() => setEditingRegionsSite(site)}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/80 px-4 py-8 text-center text-sm text-stone-500">
                  Aucun site pour l’instant. Connectez un site dans la colonne de droite.
                </div>
              )}
            </section>

            {/* Colonne droite — sites à connecter */}
            <section className="min-w-0">
              <h2 className="text-sm font-medium text-stone-500 mb-4">
                Sites à connecter
                <span className="text-stone-400 font-normal ml-1">
                  ({availableSites.filter((s) => !isConnected(s._id)).length})
                </span>
              </h2>

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
                </div>
              ) : (
                <div className="space-y-3">
                  {availableSites
                    .filter((site) => !isConnected(site._id))
                    .map((site) => (
                      <SiteCard
                        key={site._id}
                        site={site}
                        isConnected={false}
                        regionNames={(site.regionIds || []).map((id) => regionNameById.get(id) || id)}
                        onConnect={() => setConnectingSite(site)}
                        onDisconnect={() => {}}
                        onEditRegions={() => setEditingRegionsSite(site)}
                      />
                    ))}

                  {availableSites.filter((site) => !isConnected(site._id)).length === 0 && (
                    <div className="rounded-xl border border-dashed border-green-200 bg-green-50/50 px-4 py-8 text-center text-sm text-stone-600">
                      Vous êtes connecté à tous les sites disponibles.
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </>
      ) : null}

      {activeTab === "todo" ? <TodoConfigSection /> : null}

      {activeTab === "cron" ? (
        isAdmin ? (
          <SyncHealthCard
            latestRun={syncStatusQuery.data || null}
            runs={syncRunsQuery.data?.data || []}
            isLoading={syncStatusQuery.isLoading || syncRunsQuery.isLoading}
            isTriggering={triggerSyncMutation.isPending}
            canTrigger={!triggerSyncMutation.isPending}
            error={
              (syncStatusQuery.error as Error | null)?.message ||
              (syncRunsQuery.error as Error | null)?.message ||
              (triggerSyncMutation.error as Error | null)?.message ||
              null
            }
            onTrigger={async () => {
              await triggerSyncMutation.mutateAsync()
            }}
          />
        ) : (
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-600">
              Le rapport cron est réservé aux comptes admin.
            </p>
          </section>
        )
      ) : null}

      {/* Connect modal */}
      {connectingSite && (
        <ConnectModal
          site={connectingSite}
          onClose={() => setConnectingSite(null)}
          onConnect={handleConnect}
        />
      )}
      {editingRegionsSite && (
        <RegionsModal
          site={editingRegionsSite}
          allRegions={regionsOverview.data?.data || []}
          isSaving={updateRegions.isPending}
          onClose={() => setEditingRegionsSite(null)}
          onSave={async (regionIds) => {
            await updateRegions.mutateAsync(regionIds)
            setEditingRegionsSite(null)
          }}
        />
      )}
      {showUnassignedRegions && (
        <UnassignedRegionsModal
          regions={unassignedRegions}
          onClose={() => setShowUnassignedRegions(false)}
        />
      )}
    </div>
  )
}
