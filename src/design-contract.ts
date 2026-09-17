/** A versioned visual brief, not a claim of measured audience preference. */
export const EDITORIAL_DESIGN = {
  id: "block-context-pictogram-v2",
  status: "prototype-unvalidated",
  basis: [
    { kind: "reference-observation", statement: "Earlier pictogram illustrations retain block-defining side streets, recognizable colored symbols and prominent literal labels. They are appearance references, not geographic evidence." },
    { kind: "user-preference", statement: "Pictogram-led output, editable vectors, actual street relationships and preservation of real bends." },
    { kind: "user-feedback", statement: "The three-street editorial draft lost block identity. Its weak intermediate-code comparison was not a faithful baseline for the earlier illustrated output. Preserve context and pictogram quality in revisions." },
    { kind: "design-hypothesis", statement: "Protect the source-node street enclosure, keep enough surrounding streets and restore colored pictograms. Compare with the actual prior artifact. Audience preference remains unmeasured." },
  ],
  criteria: [
    { id: "destination", check: "The destination is the first map label noticed at delivery size; its full name stays readable." },
    { id: "orientation", check: "The station, literal exit number and named main roads are easy to locate without inventing a walking route." },
    { id: "block-context", check: "The reader can identify the destination's block. Preserve the whole source-backed enclosing street boundary and keep it visible; a road-count budget must not erase it." },
    { id: "coherence", check: "Preserve the recognizable pictogram detail, color and readable labels of the appearance reference. Do not substitute tiny generic glyphs as an improvement." },
    { id: "geography", check: "Compare source and blueprint: preserve connectivity, actual bends and place-side relationships. Background fields are not building footprints." },
    { id: "legibility", check: "Inspect the rendered map at delivery size beside the actual earlier image. Identify the baseline's provenance; do not regenerate a weaker stand-in and call it the original. No broken words, collisions or clipped labels." },
  ],
  tokens: {
    roads: { primary: 30, secondary: 22, tertiary: 8, residential: 5, path: 2 },
    radius: 20, text: 20, destinationText: 21,
    focusPaddingMeters: 70,
    paper: "#fffefa", ground: "#fffefa", road: "#b5bac0", ink: "#283845", muted: "#64717b", accent: "#df513a",
    frame: { side: 20, top: 24, bottom: 40 },
  },
} as const;

export function editorialFrame(canvas: { width: number; height: number }) {
  const { side, top, bottom } = EDITORIAL_DESIGN.tokens.frame;
  return { x: side, y: top, width: canvas.width - side * 2, height: canvas.height - top - bottom };
}
