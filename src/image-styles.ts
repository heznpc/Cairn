/** Host image directions, independent of the deterministic SVG templates. */
export const IMAGE_STYLES = ["schematic", "neighborhood", "pictorial"] as const;
export type ImageStyle = (typeof IMAGE_STYLES)[number];

export const IMAGE_STYLE_PROFILES: Record<ImageStyle, {
  purpose: string;
  roadGroups: number;
  landmarkLimit: number;
  instructions: string;
}> = {
  schematic: {
    purpose: "Compact Korean yakdo for business cards and direction inserts",
    roadGroups: 4,
    landmarkLimit: 4,
    instructions: "Draw a compact schematic yakdo, not a decorated geographic map. " +
      "Remove anonymous buildings and minor streets. Redraw the dominant axes as clean straight " +
      "horizontal/vertical or 45-degree bands rather than tracing the reference. Collapse paired " +
      "carriageways with the same street name into ONE continuous solid band, with no central slit, " +
      "diagonal cuts, medians, lane splits or turning lanes. Never impose a crossroad where the source has none. Compress distances and enlarge the " +
      "destination while preserving intersection order and which side of each road a place occupies. " +
      "Use two road weights, small circular line pictograms, and a clear destination callout. " +
      "Keep the heading small. No decorative texture, shadows, giant title or empty poster margins.",
  },
  neighborhood: {
    purpose: "Local context for visitors comparing streets and surrounding places",
    roadGroups: 12,
    landmarkLimit: 8,
    instructions: "Draw a readable neighborhood guide. Preserve north-up orientation, road angles, " +
      "relative distances and the larger street network. Distinguish major streets from local streets. " +
      "Use modest destination emphasis and legible POI labels. Do not turn the neighborhood into " +
      "a two-road diagram. Building footprints require a separately supplied geographic reference; " +
      "without it, leave blocks unfilled rather than inventing buildings.",
  },
  pictorial: {
    purpose: "Recognizable landmark icons for venue, event and visitor guides",
    roadGroups: 6,
    landmarkLimit: 6,
    instructions: "Draw a pictogram-led wayfinding map. Use a larger destination symbol and a " +
      "consistent family of small recognizable place icons along a simplified street skeleton. " +
      "Collapse paired carriageways with the same street name into ONE continuous solid band. " +
      "Do not draw a central slit, diagonal cuts, medians, lane splits or turning lanes inside it. " +
      "Generic category icons are symbolic, never purported likenesses of real buildings. " +
      "Allow gently compressed distances and enlarged icons, but preserve relative direction, " +
      "road-side placement and intersection order. Keep labels beside their icons wherever possible. " +
      "Avoid a dense city map, decorative skyline, and unrelated illustrations.",
  },
};

export function isImageStyle(value: string): value is ImageStyle {
  return (IMAGE_STYLES as readonly string[]).includes(value);
}
