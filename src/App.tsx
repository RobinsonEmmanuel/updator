import { RouterProvider } from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { router } from "@/router"
import { queryClient } from "@/lib/queryClient"
import { SiteProvider } from "@/lib/SiteContext"

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SiteProvider>
        <RouterProvider router={router} />
      </SiteProvider>
    </QueryClientProvider>
  )
}

export default App
