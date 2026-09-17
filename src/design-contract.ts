/** A versioned visual brief, not a claim of measured audience preference. */
export const EDITORIAL_DESIGN = {
  id: "editorial-pictogram-v1",
  status: "prototype-unvalidated",
  basis: [
    { kind: "reference-observation", statement: "User-supplied Korean commercial yakdo examples: quiet block ground, clear street bands, one dominant destination label, restrained landmark symbols." },
    { kind: "user-preference", statement: "Pictogram-led output, editable vectors, actual street relationships and preservation of real bends." },
    { kind: "design-hypothesis", statement: "A single accent, unified pictograms and destination-first type hierarchy should make this visitor insert easier to scan. Audience preference has not been measured." },
  ],
  criteria: [
    { id: "destination", check: "The destination is the first map label noticed at delivery size; its full name stays readable." },
    { id: "orientation", check: "The station, literal exit number and named main roads are easy to locate without inventing a walking route." },
    { id: "coherence", check: "Secondary symbols use one visual family; the destination owns the strongest accent." },
    { id: "geography", check: "Compare source and blueprint: preserve connectivity, actual bends and place-side relationships. Background fields are not building footprints." },
    { id: "legibility", check: "Inspect the rendered map at its intended size beside the previous output. No broken words, collisions, clipped labels or unclear leaders." },
  ],
  tokens: {
    roads: { primary: 38, secondary: 28, tertiary: 12, residential: 8, path: 3 },
    radius: 19, text: 20, destinationText: 20,
    focusPaddingMeters: 40,
    paper: "#ffffff", ground: "#eeede9", road: "#ffffff", ink: "#343633", muted: "#797c76", accent: "#b85a38",
    frame: { side: 36, top: 130, bottom: 54 },
  },
} as const;

export function editorialFrame(canvas: { width: number; height: number }) {
  const { side, top, bottom } = EDITORIAL_DESIGN.tokens.frame;
  return { x: side, y: top, width: canvas.width - side * 2, height: canvas.height - top - bottom };
}
