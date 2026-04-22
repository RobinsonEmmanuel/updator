import { useMemo } from "react"
import type { RegionPoiLite } from "@/hooks"
import { decodeHtmlEntities, normalizeForMatch, buildRegionPoiMap } from "@/features/article-poi-catchup/domain"

interface Params {
  regionPois: RegionPoiLite[]
  regionPoiSearch: string
  regionPoiClusterFilter: string
  regionPoiTypeFilter: string
}

export function useRegionPoiDirectoryOptions({
  regionPois,
  regionPoiSearch,
  regionPoiClusterFilter,
  regionPoiTypeFilter,
}: Params) {
  const availableClusterNames = useMemo(
    () =>
      Array.from(
        new Set(
          regionPois
            .flatMap((poi) => poi.cluster_names || [])
            .map((name) => decodeHtmlEntities(name).trim())
            .filter((name) => name.length > 0)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [regionPois]
  )

  const availableTypeLabels = useMemo(
    () =>
      Array.from(
        new Set(
          regionPois.map((poi) => decodeHtmlEntities(poi.place_type_label_fr || poi.place_type || "Autre").trim())
        )
      ).sort((a, b) => a.localeCompare(b)),
    [regionPois]
  )

  const createPoiTypeOptions = useMemo(
    () =>
      Array.from(
        new Map(
          regionPois.map((poi) => [
            (poi.place_type || "").trim().toLowerCase(),
            {
              value: (poi.place_type || "").trim().toLowerCase(),
              label: decodeHtmlEntities(poi.place_type_label_fr || poi.place_type || "Autre").trim(),
            },
          ])
        ).values()
      )
        .filter((option) => option.value.length > 0)
        .sort((a, b) => a.label.localeCompare(b.label)),
    [regionPois]
  )

  const createPoiClusterOptions = useMemo(
    () =>
      Array.from(
        new Map(
          regionPois.flatMap((poi) => {
            const names = (poi.cluster_names || []).map((name) => decodeHtmlEntities(name).trim())
            const ids = poi.cluster_ids || []
            const size = Math.max(names.length, ids.length)
            return Array.from({ length: size }).map((_, index) => {
              const id = (ids[index] || ids[0] || "").trim()
              const label = (names[index] || names[0] || "").trim()
              return [id, { value: id, label: label || id }] as const
            })
          })
        ).values()
      )
        .filter((option) => option.value.length > 0 && option.label.length > 0)
        .sort((a, b) => a.label.localeCompare(b.label)),
    [regionPois]
  )

  const filteredRegionPois = useMemo(() => {
    const q = normalizeForMatch(regionPoiSearch)
    return regionPois.filter((poi) => {
      const placeTypeLabel = decodeHtmlEntities(poi.place_type_label_fr || poi.place_type || "")
      const clusterNames = (poi.cluster_names || []).map((name) => decodeHtmlEntities(name))
      if (regionPoiClusterFilter && !clusterNames.includes(regionPoiClusterFilter)) return false
      if (regionPoiTypeFilter && placeTypeLabel.toLowerCase() !== regionPoiTypeFilter.toLowerCase()) return false
      if (!q) return true
      return (
        normalizeForMatch(decodeHtmlEntities(poi.name)).includes(q) ||
        normalizeForMatch(placeTypeLabel).includes(q) ||
        normalizeForMatch(decodeHtmlEntities(poi.place_type || "")).includes(q) ||
        clusterNames.some((name) => normalizeForMatch(name).includes(q)) ||
        normalizeForMatch(poi.rl_place_id).includes(q)
      )
    })
  }, [regionPois, regionPoiSearch, regionPoiClusterFilter, regionPoiTypeFilter])

  const regionPoiById = useMemo(() => buildRegionPoiMap(regionPois), [regionPois])

  const placeTypeLabelByType = useMemo(() => {
    const map = new Map<string, string>()
    regionPois.forEach((poi) => {
      const key = (poi.place_type || "").trim().toLowerCase()
      const label = decodeHtmlEntities(poi.place_type_label_fr || "").trim()
      if (key && label && !map.has(key)) map.set(key, label)
    })
    return map
  }, [regionPois])

  return {
    availableClusterNames,
    availableTypeLabels,
    createPoiTypeOptions,
    createPoiClusterOptions,
    filteredRegionPois,
    regionPoiById,
    placeTypeLabelByType,
  }
}
