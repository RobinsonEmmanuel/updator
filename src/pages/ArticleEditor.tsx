import { useParams } from "react-router-dom"

export function ArticleEditor() {
  const { id } = useParams<{ id: string }>()
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-stone-800 mb-4">Éditeur article</h1>
      <p className="text-stone-600">Article ID: {id}</p>
    </div>
  )
}
