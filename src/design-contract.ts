/** A visual brief and preset-specific rejection rules, not audience research. */
export const EDITORIAL_DESIGN = {
  id: "urban-context-v4",
  status: "prototype-unvalidated",
  basis: [
    { kind: "reference-observation", statement: "Earlier pictogram illustrations retain block-defining side streets, recognizable symbols and prominent literal labels. Appearance references are not geographic evidence." },
    { kind: "user-preference", statement: "Pictogram-led output, editable vectors, actual street relationships and preservation of real bends." },
    { kind: "user-feedback", statement: "Earlier drafts lost block identity, then restored roads without resolving oversized road bands, wasted space, mixed pictogram styles, small text and labels across streets. A later road-only revision still erased the dense built environment. Those drafts are rejected baselines, not approved design." },
    { kind: "design-hypothesis", statement: "Fit the useful block and arrival landmarks together, use one flat symbol family, reserve the accent for the destination, and keep place names beside their source icons. Use one rigid map rotation when a nearby primary street is within 30 degrees of horizontal; preserve all angles and rotate north consistently." },
  ],
  criteria: [
    { id: "building-context", check: "For a building destination in a dense city, identify the actual building among neighboring footprints and their gaps. A road-bounded block alone is insufficient. Use only source polygons; missing coverage is unresolved, never empty land. Keep text off the highlighted building boundary." },
    { id: "destination", check: "At actual delivery size, name the first thing noticed before reading the source. Reject when the road bands or exit badge dominate the destination." },
    { id: "composition", check: "Inspect occupied and empty regions together. Reject a crowded destination/arrival cluster surrounded by unused space. Reframe the whole map without moving individual geographic anchors." },
    { id: "block-context", check: "Identify the destination's enclosing block without tracing faint lines. Keep its source-backed boundary and real bends visible. A closed graph alone is not visual success." },
    { id: "coherence", check: "Compare silhouette, container, weight, perspective and color across every pictogram. Reject a mix of unrelated icon families; added detail is not a substitute for coherence." },
    { id: "typography", check: "Read the exported image at its stated delivery size without zooming or tilting your head. Destination, arrival and context need distinct emphasis; do not solve crowding by shrinking text." },
    { id: "association", check: "Pair each name with its icon immediately. Reject names moved across a street or long leaders used to rescue an unsolved composition. Transit anchors on a street are a distinct case." },
    { id: "geography", check: "Compare source geometry and blueprint. Preserve connectivity, real bends, source anchors, the enclosing block and north direction. No invented footprints or access routes." },
  ],
  // These floors are hypotheses for this 600 px visitor-map preset only.
  delivery: { width: 600, destinationText: 16, placeText: 12, streetText: 10, hierarchyRatio: 1.35, blockShare: .12 },
  tokens: {
    roads: { primary: 24, secondary: 20, tertiary: 10, residential: 7, path: 3 },
    radius: 22, text: 24, destinationText: 34,
    paper: "#fffefa", ground: "#fffefa", road: "#d2d5d5", ink: "#293d47", muted: "#637078", accent: "#cf4d35",
    frame: { side: 32, top: 32, bottom: 48 },
  },
} as const;

export function editorialFrame(canvas: { width: number; height: number }) {
  const { side, top, bottom } = EDITORIAL_DESIGN.tokens.frame;
  return { x: side, y: top, width: canvas.width - side * 2, height: canvas.height - top - bottom };
}
