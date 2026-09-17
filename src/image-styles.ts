/** Host image directions, independent of the deterministic SVG templates. */
export const IMAGE_STYLES = ["schematic", "neighborhood", "pictorial", "editorial"] as const;
export type ImageStyle = (typeof IMAGE_STYLES)[number];

export const IMAGE_STYLE_PROFILES: Record<ImageStyle, {
  purpose: string;
  roadGroups: number;
  landmarkLimit: number;
  instructions: string;
}> = {
  editorial: {
    purpose: "Block-preserving pictogram guide based on a recorded visual design contract",
    roadGroups: 6,
    landmarkLimit: 4,
    instructions: "Preserve the streets enclosing the destination block and the surrounding orientation streets. " +
      "Use quiet gray road bands on warm white, one flat pictogram family and clear full-name labels. Reserve accent color for the destination. " +
      "Keep the destination building and name prominent, literal exit numbers in source-backed badges, and secondary symbols restrained. Keep names on the same street side as their icons. " +
      "Do not replace an accepted illustrated appearance with tiny generic glyphs, a large poster heading or a two-road cross. " +
      "Block context describes street enclosure, never a building footprint or access permission. " +
      "Keep the supplied display-road paths and geographic anchors, including actual bends. " +
      "Render supplied building footprints as subdued context and distinguish the matched destination outline. Do not invent buildings, parcels, lanes, junctions, routes or transit-line colors. " +
      "Respect facts.orientation for the whole scene and north arrow. Review the actual-size image against designContract; designReview never confers visual approval.",
  },
  schematic: {
    purpose: "Compact Korean yakdo for business cards and direction inserts",
    roadGroups: 4,
    landmarkLimit: 4,
    instructions: "Draw a compact schematic yakdo, not a decorated geographic map. " +
      "Remove anonymous buildings and minor streets. Preserve the supplied display-road paths: " +
      "only source-aligned approaches stay straight; keep actual bends, curves and staggered junctions. " +
      "Do not snap roads to horizontal, vertical or 45-degree axes. Carriageways already paired in " +
      "displayRoads form ONE continuous solid band, with no central slit, diagonal cuts, medians, " +
      "lane splits or turning lanes. Never merge roads merely because their names match. " +
      "Never impose a crossroad where the source has none. Enlarge the " +
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
      "Use the supplied display-road paths; only carriageways already paired there form ONE continuous solid band. " +
      "Keep actual bends and staggered junctions, and never merge roads merely because their names match. " +
      "Do not draw a central slit, diagonal cuts, medians, lane splits or turning lanes inside it. " +
      "Generic category icons are symbolic, never purported likenesses of real buildings. " +
      "Enlarge icons while preserving the supplied road paths, relative direction, " +
      "road-side placement and intersection order. Keep labels beside their icons wherever possible. " +
      "Avoid a dense city map, decorative skyline, and unrelated illustrations.",
  },
};

export function isImageStyle(value: string): value is ImageStyle {
  return (IMAGE_STYLES as readonly string[]).includes(value);
}
