import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/AuthContext"

const envMode = import.meta.env.VITE_ENVIRONMENT_MODE === "true"

export function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const { login, authError, clearAuthError } = useAuth()
  const navigate = useNavigate()

  const handleLogin = async () => {
    clearAuthError()
    setLocalError(null)
    if (!email.trim()) {
      setLocalError("Email requis")
      return
    }
    if (!envMode && !password.trim()) {
      setLocalError("Mot de passe requis")
      return
    }
    setLoading(true)
    try {
      await login(email.trim(), envMode ? undefined : password)
      navigate("/")
    } catch {
      // authError set by context
    } finally {
      setLoading(false)
    }
  }

  const displayError = localError || authError

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-xl shadow-stone-200/50 p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mb-3 shadow-lg shadow-orange-200">
              <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M12 18v-6" />
                <path d="M9 15l3 3 3-3" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-stone-800">Updator</h1>
            <p className="text-xs text-stone-500">Backoffice</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Email Region Lovers
              </label>
              <input
                id="rl-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400"
                placeholder="email@regionlovers.fr"
              />
            </div>

            {!envMode && (
              <div>
                <label htmlFor="rl-password" className="block text-sm font-medium text-stone-700 mb-2">
                  Mot de passe Region Lovers
                </label>
                <input
                  id="rl-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400"
                  placeholder="••••••••"
                />
                <p className="text-xs text-stone-400 mt-1.5">
                  Le mot de passe est sensible à la casse (identique à Swagger / Region Lovers).
                </p>
              </div>
            )}

            {displayError && (
              <p className="text-sm text-red-600" role="alert">
                {displayError}
              </p>
            )}

            <Button
              type="button"
              onClick={handleLogin}
              disabled={loading}
              className="w-full h-11 bg-orange-600 hover:bg-orange-700 text-white rounded-xl disabled:opacity-60"
            >
              {loading ? "Connexion…" : "Se connecter"}
            </Button>
          </div>

          <p className="text-xs text-stone-400 text-center mt-6">
            {envMode ? "Mode environnement — mot de passe géré côté serveur" : "Connexion Region Lovers"}
          </p>
        </div>
      </div>
    </div>
  )
}
