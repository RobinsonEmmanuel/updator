import { createBrowserRouter } from "react-router-dom"
import { Layout } from "@/components/shared"
import { ProtectedRoute } from "@/components/shared/ProtectedRoute"
import { Login } from "@/pages/Login"
import { Dashboard } from "@/pages/Dashboard"
import { WorkQueue } from "@/pages/WorkQueue"
import { ArticleEditor } from "@/pages/ArticleEditor"
import { Signals } from "@/pages/Signals"
import { Reporting } from "@/pages/Reporting"

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/",
    element: <ProtectedRoute />,
    children: [
      {
        element: <Layout />,
        children: [
          {
            index: true,
            element: <Dashboard />,
          },
          {
            path: "queue",
            element: <WorkQueue />,
          },
          {
            path: "article/:id",
            element: <ArticleEditor />,
          },
          {
            path: "signaux",
            element: <Signals />,
          },
          {
            path: "reporting",
            element: <Reporting />,
          },
        ],
      },
    ],
  },
])
