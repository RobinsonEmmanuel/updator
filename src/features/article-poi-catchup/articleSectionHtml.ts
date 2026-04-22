import { decodeHtmlEntities, normalizeForMatch } from "@/features/article-poi-catchup/domain"

export interface ArticleSectionView {
  id: string
  title: string
  level: "h1" | "h2" | "h3" | "intro"
  html: string
  text: string
  candidateIds: string[]
  suggestionCount: number
}

export interface CandidateSectionMeta {
  candidate_id: string
  name: string
  source?: string
  section_title?: string
  occurrences?: Array<{ section_title?: string }>
  suggestions?: unknown[]
}

export function parseSectionsFromHtml(html: string, candidates: CandidateSectionMeta[]): ArticleSectionView[] {
  const source = html || ""
  if (typeof window === "undefined" || typeof DOMParser === "undefined" || !source) {
    return [
      {
        id: "intro",
        title: "Contenu",
        level: "intro",
        html: source,
        text: decodeHtmlEntities(source),
        candidateIds: [],
        suggestionCount: 0,
      },
    ]
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(source, "text/html")

  doc.body.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src") || ""
    if (!src) return
    img.setAttribute("data-preview-src", src)
    img.setAttribute("style", "max-width:200px;width:100%;height:auto;cursor:zoom-in;display:block;margin:8px 0;")
    img.setAttribute("loading", "lazy")
  })

  type RawSection = { id: string; title: string; level: "h1" | "h2" | "h3" | "intro"; nodes: Node[] }
  const children = Array.from(doc.body.childNodes)
  const headingEntries = children
    .map((node, nodeIndex) => {
      const el = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : null
      const tag = (el?.tagName || "").toLowerCase()
      if (tag !== "h1" && tag !== "h2" && tag !== "h3") return null
      const title = decodeHtmlEntities(el?.textContent || "").replace(/\s+/g, " ").trim()
      if (!title) return null
      return {
        nodeIndex,
        level: tag as "h1" | "h2" | "h3",
        title,
        normalizedTitle: normalizeForMatch(title),
      }
    })
    .filter((entry): entry is { nodeIndex: number; level: "h1" | "h2" | "h3"; title: string; normalizedTitle: string } => !!entry)

  const normalizedCandidates = candidates
    .map((candidate) => ({ ...candidate, normalized: normalizeForMatch(candidate.name) }))
    .filter((candidate) => candidate.normalized.length >= 3)

  const extractSommaireTitles = (): string[] => {
    const containers = Array.from(doc.body.querySelectorAll("div,section,aside,nav"))
    for (const container of containers) {
      const text = normalizeForMatch(container.textContent || "")
      if (!text.includes("sommaire")) continue
      const list = container.querySelector("ul,ol")
      if (!list) continue
      const titles = Array.from(list.querySelectorAll("li"))
        .map((li) => decodeHtmlEntities(li.textContent || "").replace(/\s+/g, " ").trim())
        .filter((t) => t.length > 0)
      if (titles.length > 0) return titles
    }
    return []
  }

  const sommaireTitles = extractSommaireTitles()
  const usedHeadingNodeIndexes = new Set<number>()
  const sommaireAnchors = sommaireTitles
    .map((title) => {
      const normalizedTitle = normalizeForMatch(title)
      if (!normalizedTitle) return null
      const match = headingEntries.find((entry) => {
        if (usedHeadingNodeIndexes.has(entry.nodeIndex)) return false
        return (
          entry.normalizedTitle === normalizedTitle ||
          entry.normalizedTitle.includes(normalizedTitle) ||
          normalizedTitle.includes(entry.normalizedTitle)
        )
      })
      if (!match) return null
      usedHeadingNodeIndexes.add(match.nodeIndex)
      return {
        nodeIndex: match.nodeIndex,
        level: match.level,
        title,
      }
    })
    .filter((entry): entry is { nodeIndex: number; level: "h1" | "h2" | "h3"; title: string } => !!entry)
    .sort((a, b) => a.nodeIndex - b.nodeIndex)

  const fallbackAnchors = (() => {
    if (sommaireAnchors.length > 0) return sommaireAnchors
    const h2Only = headingEntries.filter((entry) => entry.level === "h2")
    const selected = h2Only.length > 0 ? h2Only : headingEntries
    return selected.map((entry) => ({
      nodeIndex: entry.nodeIndex,
      level: entry.level,
      title: entry.title,
    }))
  })()

  const sections: RawSection[] = []
  if (fallbackAnchors.length === 0) {
    sections.push({ id: "intro", title: "Introduction", level: "intro", nodes: children.map((node) => node.cloneNode(true)) })
  } else {
    const firstIndex = fallbackAnchors[0].nodeIndex
    if (firstIndex > 0) {
      sections.push({
        id: "intro",
        title: "Introduction",
        level: "intro",
        nodes: children.slice(0, firstIndex).map((node) => node.cloneNode(true)),
      })
    }
    fallbackAnchors.forEach((anchor, idx) => {
      const end = idx + 1 < fallbackAnchors.length ? fallbackAnchors[idx + 1].nodeIndex : children.length
      const nodes = children.slice(anchor.nodeIndex, end).map((node) => node.cloneNode(true))
      sections.push({
        id: `section-${idx + 1}-${anchor.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "heading"}`,
        title: anchor.title,
        level: anchor.level,
        nodes,
      })
    })
  }

  const builtSections = sections
    .map((section) => {
      const tmp = doc.createElement("div")
      section.nodes.forEach((node) => tmp.appendChild(node))
      const htmlContent = tmp.innerHTML
      const textContent = decodeHtmlEntities(tmp.textContent || "").replace(/\s+/g, " ").trim()
      const normalizedText = normalizeForMatch(textContent)
      const sectionTitleNormalized = normalizeForMatch(section.title)
      const candidateIds = normalizedCandidates
        .filter((candidate) => {
          const titleMatches = [
            candidate.section_title || "",
            ...(Array.isArray(candidate.occurrences) ? candidate.occurrences.map((o) => o.section_title || "") : []),
          ]
            .map((t) => normalizeForMatch(t))
            .filter((t) => t.length > 0)
            .some((candidateSectionTitle) =>
              candidateSectionTitle === sectionTitleNormalized ||
              candidateSectionTitle.includes(sectionTitleNormalized) ||
              sectionTitleNormalized.includes(candidateSectionTitle)
            )
          if (titleMatches) return true
          return normalizedText.includes(candidate.normalized)
        })
        .map((candidate) => candidate.candidate_id)
      const suggestionCount = candidates
        .filter((candidate) => candidateIds.includes(candidate.candidate_id))
        .reduce((acc, candidate) => acc + (Array.isArray(candidate.suggestions) ? candidate.suggestions.length : 0), 0)
      return {
        id: section.id,
        title: section.title,
        level: section.level,
        html: htmlContent,
        text: textContent,
        candidateIds,
        suggestionCount,
      } satisfies ArticleSectionView
    })
    .filter((section) => section.html.trim().length > 0 || section.level !== "intro")
  return builtSections
}

export function highlightSectionHtmlByCandidates(
  html: string,
  candidates: Array<{
    candidate_id: string
    name: string
    section_title?: string
    evidence_excerpt?: string
    occurrences?: Array<{ excerpt?: string; section_title?: string }>
  }>,
  activeCandidateId: string | null
): string {
  const source = html || ""
  if (!source || typeof window === "undefined" || typeof DOMParser === "undefined") return source
  const parser = new DOMParser()
  const doc = parser.parseFromString(source, "text/html")

  const buildEvidenceVariants = (candidate: {
    name: string
    section_title?: string
    evidence_excerpt?: string
    occurrences?: Array<{ excerpt?: string; section_title?: string }>
  }): string[] => {
    const snippets = [
      candidate.section_title || "",
      candidate.evidence_excerpt || "",
      ...(candidate.occurrences || []).flatMap((entry) => [entry.excerpt || "", entry.section_title || ""]),
    ]
    const seedToken = normalizeForMatch(candidate.name)
      .split(" ")
      .find((token) => token.length >= 4)
    if (!seedToken) return []

    return snippets
      .flatMap((snippet) => decodeHtmlEntities(snippet).split(/[.!?;\n]/g))
      .map((part) => part.replace(/\s+/g, " ").replace(/[.…]/g, "").trim())
      .filter((part) => part.length >= 8 && part.length <= 90)
      .filter((part) => normalizeForMatch(part).includes(seedToken))
  }

  const baseEntries = candidates
    .map((candidate) => {
      const label = decodeHtmlEntities(candidate.name).trim()
      return {
        candidateId: candidate.candidate_id,
        label,
        normalized: normalizeForMatch(candidate.name),
        evidenceVariants: buildEvidenceVariants(candidate),
      }
    })
    .filter((entry) => entry.label.length >= 3)
    .sort((a, b) => b.label.length - a.label.length)

  if (baseEntries.length === 0) return doc.body.innerHTML

  const variants: Array<{ pattern: string; candidateId: string; normalized: string }> = []
  const seenVariant = new Set<string>()
  baseEntries.forEach((entry) => {
    const raw = entry.label
    const withCurlyApostrophe = raw.replace(/'/g, "’")
    const withStraightApostrophe = raw.replace(/’/g, "'")
    const noParen = raw.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim()
    const acronym = (raw.match(/\(([^)]+)\)/)?.[1] || "").trim()
    ;[raw, withCurlyApostrophe, withStraightApostrophe, noParen, acronym, ...entry.evidenceVariants]
      .filter((v) => v && v.length >= 3)
      .forEach((variant) => {
        const normalizedVariant = normalizeForMatch(variant)
        if (!normalizedVariant) return
        const key = `${entry.candidateId}:${normalizedVariant}`
        if (seenVariant.has(key)) return
        seenVariant.add(key)
        const escaped = variant
          .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
          .replace(/\\\s\+/g, "\\s+")
          .replace(/\s+/g, "\\s+")
          .replace(/['’`´]/g, "['’`´]")
          .replace(/-/g, "[-–—]")
        variants.push({ pattern: escaped, candidateId: entry.candidateId, normalized: normalizedVariant })
      })
  })

  const patterns = variants.map((entry) => entry.pattern)
  if (patterns.length === 0) return doc.body.innerHTML
  const regex = new RegExp(`(${patterns.join("|")})`, "gi")
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  let node = walker.nextNode()
  while (node) {
    textNodes.push(node as Text)
    node = walker.nextNode()
  }

  textNodes.forEach((textNode) => {
    const parentTag = textNode.parentElement?.tagName.toLowerCase()
    if (parentTag === "script" || parentTag === "style" || parentTag === "noscript" || parentTag === "mark") return
    const textValue = textNode.nodeValue || ""
    if (!textValue || !regex.test(textValue)) return

    regex.lastIndex = 0
    const frag = doc.createDocumentFragment()
    let lastIndex = 0
    textValue.replace(regex, (match, _group, offset) => {
      if (offset > lastIndex) frag.appendChild(doc.createTextNode(textValue.slice(lastIndex, offset)))
      const normalizedMatch = normalizeForMatch(match)
      const candidateId =
        variants.find(
          (entry) =>
            normalizedMatch === entry.normalized ||
            normalizedMatch.includes(entry.normalized) ||
            entry.normalized.includes(normalizedMatch)
        )?.candidateId ||
        baseEntries.find(
          (entry) =>
            normalizedMatch === entry.normalized ||
            normalizedMatch.includes(entry.normalized) ||
            entry.normalized.includes(normalizedMatch)
        )?.candidateId ||
        null
      const mark = doc.createElement("mark")
      mark.textContent = match
      if (candidateId) {
        mark.setAttribute("data-candidate-id", candidateId)
        mark.className =
          activeCandidateId === candidateId
            ? "inline rounded px-0.5 cursor-pointer !bg-orange-300 !text-orange-950 ring-1 ring-orange-400 font-semibold"
            : "inline rounded px-0.5 cursor-pointer !bg-yellow-200 !text-stone-900 ring-1 ring-yellow-300"
      } else {
        mark.className = "inline rounded px-0.5 !bg-yellow-200 !text-stone-900 ring-1 ring-yellow-300"
      }
      frag.appendChild(mark)
      lastIndex = offset + match.length
      return match
    })
    if (lastIndex < textValue.length) frag.appendChild(doc.createTextNode(textValue.slice(lastIndex)))
    textNode.parentNode?.replaceChild(frag, textNode)
  })

  return doc.body.innerHTML
}

export function resolveSectionTitleCandidateId(
  title: string,
  candidates: Array<{
    candidate_id: string
    name: string
    section_title?: string
    occurrences?: Array<{ section_title?: string }>
  }>
): string | null {
  const normalizedTitle = normalizeForMatch(title)
  if (!normalizedTitle) return null
  for (const candidate of candidates) {
    const variants = [
      candidate.name,
      candidate.section_title || "",
      ...(candidate.occurrences || []).map((entry) => entry.section_title || ""),
    ]
      .map((value) => normalizeForMatch(value))
      .filter((value) => value.length >= 3)
    if (
      variants.some(
        (variant) =>
          normalizedTitle.includes(variant) ||
          variant.includes(normalizedTitle) ||
          directionalWordOverlap(normalizedTitle, variant) >= 0.6
      )
    ) {
      return candidate.candidate_id
    }
  }
  return null
}

export function directionalWordOverlap(a: string, b: string): number {
  const aWords = new Set(a.split(" ").filter((word) => word.length >= 3))
  const bWords = new Set(b.split(" ").filter((word) => word.length >= 3))
  if (aWords.size === 0 || bWords.size === 0) return 0
  let overlap = 0
  aWords.forEach((word) => {
    if (bWords.has(word)) overlap++
  })
  return overlap / Math.max(1, Math.min(aWords.size, bWords.size))
}
