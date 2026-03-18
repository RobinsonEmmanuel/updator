import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/AuthContext"
import type { Actualiseur } from "@/types"

const actualiseurs: Actualiseur[] = ["Julie", "Myriam", "Claire", "Emmanuel"]

export function Login() {
  const [selected, setSelected] = useState<Actualiseur>("Julie")
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleLogin = () => {
    login(selected)
    navigate("/")
  }

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
            <h1 className="text-xl font-semibold text-stone-800">Actualisator</h1>
            <p className="text-xs text-stone-500">Backoffice</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Qui êtes-vous ?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {actualiseurs.map((name) => (
                  <button
                    key={name}
                    onClick={() => setSelected(name)}
                    className={`p-3 rounded-xl text-sm font-medium transition-all ${
                      selected === name
                        ? "bg-orange-100 text-orange-700 ring-2 ring-orange-500"
                        : "bg-stone-50 text-stone-600 hover:bg-stone-100"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleLogin}
              className="w-full h-11 bg-orange-600 hover:bg-orange-700 text-white rounded-xl"
            >
              Se connecter
            </Button>
          </div>

          <p className="text-xs text-stone-400 text-center mt-6">
            Proto — connexion simplifiée
          </p>
        </div>
      </div>
    </div>
  )
}
