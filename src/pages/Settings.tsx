import { useState, useEffect, useRef, useMemo } from "react"
import { Settings as SettingsIcon, Check, X, ExternalLink, Loader2, Globe, Link2, Unlink, Search, AlertTriangle } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useWpConfig, type SiteWeb } from "@/lib/WpConfigContext"
import { ingestionApiUrl, ingestionFetch } from "@/lib/api"
import { useAuth } from "@/lib/AuthContext"
import { useRegionsOverview, useUpdateSiteRegions } from "@/hooks"
import { cn } from "@/lib/utils"

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

export function Settings() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { availableSites, connectedSites, isLoading, error, connectToSite, disconnectFromSite, isConnected } = useWpConfig()
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
    enabled: isAdmin,
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
    enabled: isAdmin,
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
      {isAdmin ? (
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
      ) : null}
      <div className="flex items-center justify-between gap-3 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-stone-100 to-stone-200 rounded-xl flex items-center justify-center">
            <SettingsIcon className="h-5 w-5 text-stone-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-stone-800">Paramètres</h1>
            <p className="text-sm text-stone-500">Connectez-vous aux sites WordPress</p>
          </div>
        </div>
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
