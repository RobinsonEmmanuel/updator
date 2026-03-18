import { RouterProvider } from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { router } from "@/router"
import { queryClient } from "@/lib/queryClient"
import { SiteProvider } from "@/lib/SiteContext"
import { AuthProvider } from "@/lib/AuthContext"

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SiteProvider>
          <RouterProvider router={router} />
        </SiteProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
