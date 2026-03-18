import { createBrowserRouter } from "react-router-dom"
import { Layout } from "@/components/shared"
import { Dashboard } from "@/pages/Dashboard"
import { WorkQueue } from "@/pages/WorkQueue"
import { ArticleEditor } from "@/pages/ArticleEditor"

export const router = createBrowserRouter([
  {
    path: "/",
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
    ],
  },
])
