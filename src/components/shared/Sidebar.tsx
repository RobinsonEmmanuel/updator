import { useState } from "react"
import { NavLink, useNavigate } from "react-router-dom"
import { LayoutDashboard, ListTodo, LogOut, Bell, BarChart3, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/AuthContext"

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/queue", label: "File de travail", icon: ListTodo },
  { to: "/signaux", label: "Signaux", icon: Bell },
  { to: "/reporting", label: "Reporting", icon: BarChart3 },
  { to: "/settings", label: "Paramètres", icon: Settings },
]

export function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  return (
    <>
      {/* Zone de détection hover sur le bord gauche */}
      <div
        className="fixed left-0 top-0 w-3 h-full z-40"
        onMouseEnter={() => setIsExpanded(true)}
      />

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full bg-white/95 backdrop-blur-sm border-r border-stone-200/60 flex flex-col z-30 transition-all duration-300 ease-out shadow-lg shadow-stone-200/20",
          isExpanded ? "w-52" : "w-14"
        )}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        {/* Logo */}
        <div className={cn(
          "h-14 flex items-center border-b border-stone-100 transition-all",
          isExpanded ? "px-4 gap-3" : "px-0 justify-center"
        )}>
          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="M12 18v-6" />
              <path d="M9 15l3 3 3-3" />
            </svg>
          </div>
          <span className={cn(
            "font-semibold text-stone-800 whitespace-nowrap transition-opacity duration-200",
            isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
          )}>
            Updator
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-all",
                      isActive
                        ? "bg-orange-50 text-orange-700"
                        : "text-stone-500 hover:bg-stone-50 hover:text-stone-700",
                      !isExpanded && "justify-center"
                    )
                  }
                  title={!isExpanded ? item.label : undefined}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  <span className={cn(
                    "whitespace-nowrap transition-opacity duration-200",
                    isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
                  )}>
                    {item.label}
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* User + Logout */}
        <div className={cn(
          "border-t border-stone-100 py-3 px-2",
          isExpanded ? "space-y-2" : ""
        )}>
          {isExpanded && user && (
            <div className="px-2.5 py-1.5">
              <p className="text-xs text-stone-400">Connecté</p>
              <p className="text-sm font-medium text-stone-700">{user.name}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={cn(
              "flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium text-stone-500 hover:bg-red-50 hover:text-red-600 transition-all w-full",
              !isExpanded && "justify-center"
            )}
            title={!isExpanded ? "Déconnexion" : undefined}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            <span className={cn(
              "whitespace-nowrap transition-opacity duration-200",
              isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
            )}>
              Déconnexion
            </span>
          </button>
        </div>
      </aside>

      {/* Spacer pour le contenu */}
      <div className="w-14 flex-shrink-0" />
    </>
  )
}
