import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { AnnuaireModal } from "@/features/article-poi-catchup/components/AnnuaireModal"

const baseProps = {
  open: true,
  candidateName: "Dominium Palace",
  articleTitle: "Ou dormir a Agadir",
  regionPoiSearch: "",
  onRegionPoiSearchChange: vi.fn(),
  regionPoiClusterFilter: "",
  onRegionPoiClusterFilterChange: vi.fn(),
  regionPoiTypeFilter: "",
  onRegionPoiTypeFilterChange: vi.fn(),
  availableClusterNames: ["Agadir"],
  availableTypeLabels: ["Hotel"],
  filteredRegionPois: [
    {
      rl_place_id: "rl-1",
      name: "Dominium Palace",
      place_type: "hotel",
      place_type_label_fr: "Hotel",
      cluster_ids: ["cluster-1"],
      cluster_names: ["Agadir"],
    },
  ],
  linkedRlPlaceIds: [],
  showRegionPoiSearchSpinner: false,
  showRegionPoiLoadingPlaceholder: false,
  selectedRegionPoi: null,
  onSelectRegionPoi: vi.fn(),
  mutationPending: false,
  createPoiName: "Dominium Palace",
  onCreatePoiNameChange: vi.fn(),
  createPoiType: "",
  onCreatePoiTypeChange: vi.fn(),
  createPoiTypeOptions: [{ value: "hotel", label: "Hotel" }],
  createPoiClusterId: "",
  onCreatePoiClusterIdChange: vi.fn(),
  createPoiClusterOptions: [{ value: "cluster-1", label: "Agadir" }],
  onCreatePoi: vi.fn(),
  onClose: vi.fn(),
  onValidateLink: vi.fn(),
}

describe("AnnuaireModal", () => {
  it("requires cluster selection before enabling create button", () => {
    const { rerender } = render(<AnnuaireModal {...baseProps} />)
    const createButton = screen.getByRole("button", { name: "Créer et lier automatiquement" })
    expect(createButton).toBeDisabled()

    rerender(<AnnuaireModal {...baseProps} createPoiType="hotel" createPoiClusterId="cluster-1" />)
    expect(screen.getByRole("button", { name: "Créer et lier automatiquement" })).toBeEnabled()
  })

  it("disables annuaire row when poi already linked on article", () => {
    render(<AnnuaireModal {...baseProps} linkedRlPlaceIds={["rl-1"]} />)
    const rowButton = screen.getByRole("button", { name: /Dominium Palace.*Déjà lié sur cet article/i })
    expect(rowButton).toBeDisabled()
  })

  it("calls create callback when form is valid and button clicked", () => {
    const onCreatePoi = vi.fn()
    render(
      <AnnuaireModal
        {...baseProps}
        onCreatePoi={onCreatePoi}
        createPoiType="hotel"
        createPoiClusterId="cluster-1"
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "Créer et lier automatiquement" }))
    expect(onCreatePoi).toHaveBeenCalledTimes(1)
  })
})
