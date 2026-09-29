import type { NormalizedPosition } from "./types.js";
import type { DisplayRoad } from "./render/display-roads.js";
import { clipSegment } from "./render/road-geometry.js";
import { overlapArea } from "./render/text.js";
import { EDITORIAL_DESIGN, editorialFrame } from "./design-contract.js";

interface Facts {
  destination: { key: string; anchor: NormalizedPosition };
  landmarks: Array<{ key: string; anchor: NormalizedPosition }>;
  displayRoads: DisplayRoad[];
  buildingContext?: { acquisition: string; visibleCount: number; destinationMatch: string; buildings: import("./render/footprints.js").ProjectedBuilding[] };
  destinationBlock?: { sourceRoadIds?: string[]; outline: NormalizedPosition[]; fullyVisible: boolean };
}
export interface DesignIssue { code: string; target: string; message: string }

/** Inspect measurable failures in the actual exported SVG. Never awards a
 * visual pass: hierarchy, composition and pictogram coherence need image review.
 * Thresholds belong to this 600 px editorial preset, not universal map rules.
 */
export function assessMapDesign(svg: string, canvas: { width: number; height: number }, facts: Facts) {
  const target = EDITORIAL_DESIGN.delivery;
  const scale = target.width / canvas.width;
  const frame = editorialFrame(canvas);
  const issues: DesignIssue[] = [];
  const add = (code: string, target: string, message: string) => issues.push({ code, target, message });
  const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
  const labels = [...svg.matchAll(/<text\b[^>]*data-place-label="[^"]+"[^>]*>/g)].map(([tag]) => {
    const [x, y, width, height] = (attr(tag, "data-label-box") ?? "").split(" ").map(Number);
    return { key: attr(tag, "data-place-label")!, font: Number(attr(tag, "font-size")), box: { x, y, width, height } };
  });
  const roadWidths = new Map([...svg.matchAll(/<path\b[^>]*data-display-road="[^"]+"[^>]*>/g)]
    .map(([tag]) => [attr(tag, "data-display-road")!, Number(attr(tag, "stroke-width"))]));
  for (const road of facts.displayRoads) {
    if (!Number.isFinite(roadWidths.get(road.key))) add("missing-road", road.key, "Rendered street path or width is missing.");
  }
  const roads = facts.displayRoads.flatMap((road) => road.points.slice(1).map((b, i) => ({
    key: road.key, a: { x: road.points[i].x * canvas.width, y: road.points[i].y * canvas.height },
    b: { x: b.x * canvas.width, y: b.y * canvas.height }, half: (roadWidths.get(road.key) ?? 0) / 2,
  })));
  for (const place of [facts.destination, ...facts.landmarks]) {
    const label = labels.find((l) => l.key === place.key);
    if (!label || ![label.font, ...Object.values(label.box)].every(Number.isFinite)) {
      add("missing-label", place.key, "Required place label or its layout bounds are missing."); continue;
    }
    const minimum = place.key === "D" ? target.destinationText : target.placeText;
    if (label.font * scale < minimum) add("small-type", place.key, `Label is ${(label.font * scale).toFixed(1)} px at delivery size; this preset requires ${minimum} px.`);
    const p = { x: place.anchor.x * canvas.width, y: place.anchor.y * canvas.height };
    const { x, y, width, height } = label.box;
    const pin = { x: Math.max(x, Math.min(x + width, p.x)), y: Math.max(y, Math.min(y + height, p.y)) };
    if (x < frame.x || y < frame.y || x + width > frame.x + frame.width || y + height > frame.y + frame.height) add("clipped-label", place.key, "Label exceeds the visible map frame.");
    for (const road of roads) {
      if (clipSegment(road.a.x, road.a.y, road.b.x, road.b.y, x - road.half, y - road.half, x + width + road.half, y + height + road.half)) {
        add("label-on-road", place.key, `Label obscures street ${road.key}.`); break;
      }
    }
    for (const road of roads) {
      // A station anchored on a street can label either adjacent side; an
      // off-street hospital cannot send its name across another street.
      if (clipSegment(road.a.x, road.a.y, road.b.x, road.b.y, p.x - 28 - road.half, p.y - 28 - road.half, p.x + 28 + road.half, p.y + 28 + road.half)) continue;
      if (segmentsCross(p, pin, road.a, road.b)) { add("label-crosses-road", place.key, `Name is across street ${road.key} from its geographic icon.`); break; }
    }
  }
  const destination = labels.find((l) => l.key === "D");
  const secondary = Math.max(0, ...labels.filter((l) => l.key !== "D").map((l) => l.font));
  if (destination && secondary && destination.font / secondary < target.hierarchyRatio) add("weak-hierarchy", "D", "Destination type is too close in size to surrounding labels for this preset.");
  for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
    if (overlapArea(labels[i].box, labels[j].box) > 0) add("overlapping-labels", labels[i].key, `Label overlaps ${labels[j].key}.`);
  }
  const streetTags = [...svg.matchAll(/<text\b[^>]*id="road-label-[^"]+"[^>]*>/g)].map(([tag]) => tag);
  const streetFonts = streetTags.map((tag) => Number(attr(tag, "font-size")) * scale);
  if (streetFonts.some((n) => !Number.isFinite(n) || n < target.streetText)) add("small-street-type", "streets", "Street labels are below the delivery-size type floor.");
  const labeledKeys = new Set(streetTags.map((tag) => attr(tag, "id")!.slice("road-label-".length)));
  const labeledNames = new Set(facts.displayRoads.filter((r) => labeledKeys.has(r.key)).map((r) => r.label));
  const essentialNames = new Set(facts.displayRoads.filter((r) => r.class === "primary" || r.class === "secondary" ||
    r.sourceIds.some((id) => facts.destinationBlock?.sourceRoadIds?.includes(id))).map((r) => r.label).filter(Boolean));
  for (const name of essentialNames) if (!labeledNames.has(name)) add("missing-street-name", "streets", `Essential street name is not visible: ${name}`);
  if (!facts.buildingContext?.visibleCount || ["not-requested", "unavailable"].includes(facts.buildingContext.acquisition)) {
    add("building-context-unavailable", "buildings", "Visible building context is missing. A successful empty fetch or a road-only draft cannot establish the built environment.");
  }
  if (facts.buildingContext?.visibleCount && facts.buildingContext.destinationMatch !== "contains-source-point") {
    add("unresolved-destination-building", "D", "Nearby buildings are present but the destination source point does not identify one unambiguous footprint.");
  }
  const destinationBuilding = facts.buildingContext?.buildings.find((building) => building.destination);
  if (destinationBuilding) {
    const edges = destinationBuilding.polygons.flatMap((polygon) => [polygon.outer, ...polygon.holes].flatMap((ring) =>
      ring.slice(1).map((b, i) => ({ a: ring[i], b }))));
    const streetLabels = streetTags.filter((tag) => attr(tag, "data-label-box")).map((tag) => {
      const [x, y, width, height] = attr(tag, "data-label-box")!.split(" ").map(Number);
      return { key: attr(tag, "id")!, box: { x, y, width, height } };
    });
    for (const label of [...labels, ...streetLabels]) {
      const { x, y, width, height } = label.box;
      if (edges.some(({ a, b }) => clipSegment(a.x * canvas.width, a.y * canvas.height, b.x * canvas.width, b.y * canvas.height,
        x - 2, y - 2, x + width + 2, y + height + 2))) {
        add("label-on-building-boundary", label.key, "Label obscures the highlighted destination building outline.");
      }
    }
  }
  const polygon = facts.destinationBlock?.outline;
  const blockShare = polygon ? Math.abs(polygon.reduce((n, p, i) => {
    const q = polygon[(i + 1) % polygon.length]; return n + p.x * q.y - q.x * p.y;
  }, 0)) / 2 : null;
  if (!facts.destinationBlock?.fullyVisible) add("unresolved-block", "D", "The full source-backed destination block is not available and visible.");
  if (blockShare !== null && blockShare < target.blockShare) add("small-focus-block", "D", "The useful destination block occupies too little of the composition; reframe before shrinking labels.");
  return {
    status: issues.length ? "blocked" as const : "needs-visual-review" as const,
    delivery: { width: target.width, height: canvas.height * scale },
    metrics: { destinationBlockShare: blockShare, destinationTextPx: destination ? destination.font * scale : null, secondaryTextPx: secondary * scale },
    issues,
    visualReview: { status: "pending" as const, criteria: EDITORIAL_DESIGN.criteria.map(({ id, check }) => ({ id, check, status: "pending" as const })) },
  };
}

function segmentsCross(a: { x: number; y: number }, b: typeof a, c: typeof a, d: typeof a): boolean {
  const side = (p: typeof a, q: typeof a, r: typeof a) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}
