import { useState, useEffect, useRef } from "react"
import { Settings as SettingsIcon, Check, X, ExternalLink, Loader2, Globe, Link2, Unlink } from "lucide-react"
import { useWpConfig, type SiteWeb } from "@/lib/WpConfigContext"
import { cn } from "@/lib/utils"

interface TestResult {
  success: boolean
  message: string
  postsCount?: number
  categoriesCount?: number
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
  username,
  onConnect, 
  onDisconnect 
}: { 
  site: SiteWeb
  isConnected: boolean
  username?: string
  onConnect: () => void
  onDisconnect: () => void
}) {
  const [isDisconnecting, setIsDisconnecting] = useState(false)

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center",
            isConnected 
              ? "bg-gradient-to-br from-green-100 to-green-200" 
              : "bg-gradient-to-br from-stone-100 to-stone-200"
          )}>
            <Globe className={cn(
              "h-5 w-5",
              isConnected ? "text-green-600" : "text-stone-500"
            )} />
          </div>
          <div>
            <h3 className="font-medium text-stone-800">{site.name}</h3>
            <div className="flex items-center gap-2">
              <a
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-stone-500 hover:text-orange-600 flex items-center gap-1"
              >
                {site.url.replace(/^https?:\/\//, "")}
                <ExternalLink className="h-3 w-3" />
              </a>
              {isConnected && username && (
                <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  {username}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isConnected ? (
            <button
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                "bg-red-50 text-red-600 hover:bg-red-100",
                isDisconnecting && "opacity-50 cursor-not-allowed"
              )}
            >
              {isDisconnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Unlink className="h-4 w-4" />
              )}
              Déconnecter
            </button>
          ) : (
            <button
              onClick={onConnect}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all bg-orange-100 text-orange-700 hover:bg-orange-200"
            >
              <Link2 className="h-4 w-4" />
              Se connecter
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function Settings() {
  const { availableSites, connectedSites, isLoading, error, connectToSite, disconnectFromSite, isConnected } = useWpConfig()
  const [connectingSite, setConnectingSite] = useState<SiteWeb | null>(null)

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
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-gradient-to-br from-stone-100 to-stone-200 rounded-xl flex items-center justify-center">
          <SettingsIcon className="h-5 w-5 text-stone-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Paramètres</h1>
          <p className="text-sm text-stone-500">Connectez-vous aux sites WordPress</p>
        </div>
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
                  username={site.username}
                  onConnect={() => {}}
                  onDisconnect={() => disconnectFromSite(site._id)}
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
                    onConnect={() => setConnectingSite(site)}
                    onDisconnect={() => {}}
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
    </div>
  )
}
