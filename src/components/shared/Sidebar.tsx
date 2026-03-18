import { NavLink } from "react-router-dom"
import { LayoutDashboard, ListTodo, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/queue", label: "File de travail", icon: ListTodo },
]

export function Sidebar() {
  return (
    <aside className="w-56 bg-stone-100 border-r border-stone-200 flex flex-col">
      <div className="p-4 border-b border-stone-200">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-orange-600" />
          <span className="font-semibold text-stone-800">Actualiseurs</span>
        </div>
      </div>
      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-orange-100 text-orange-700"
                      : "text-stone-600 hover:bg-stone-200 hover:text-stone-800"
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
