import type { LandmarkCategory, NormalizedPosition, RenderTheme } from "../types.js";
import type { ImageStyle } from "../image-styles.js";
import type { DisplayRoad } from "./display-roads.js";
import { landmarkIcon } from "./icons.js";
import { pictogram, editorialPictogram, type PictogramKind } from "./pictograms.js";
import { clipSegment, type Point } from "./road-geometry.js";
import { escapeXml } from "./xml.js";
import { textBoxWidth, overlapArea, type Box } from "./text.js";
import { EDITORIAL_DESIGN, editorialFrame } from "../design-contract.js";

interface Canvas { width: number; height: number }
interface Place {
  key: string; sourceId?: string; label: string; category?: LandmarkCategory;
  pictogram?: PictogramKind; anchor: NormalizedPosition;
}
const visualStyles = {
  editorial: EDITORIAL_DESIGN.tokens,
  schematic: { roads: { primary: 24, secondary: 16, tertiary: 5, residential: 4, path: 2 }, radius: 16, text: 17, destinationText: 19 },
  neighborhood: { roads: { primary: 14, secondary: 10, tertiary: 4, residential: 3, path: 2 }, radius: 13, text: 15, destinationText: 17 },
  pictorial: { roads: { primary: 26, secondary: 18, tertiary: 7, residential: 5, path: 3 }, radius: 20, text: 17, destinationText: 20 },
} as const;
const widthFor = (road: DisplayRoad, style: ImageStyle) => visualStyles[style].roads[road.class];
const pixels = (p: NormalizedPosition, canvas: Canvas): Point => ({ x: p.x * canvas.width, y: p.y * canvas.height });

/** The same path layer is used in the blueprint and the delivered SVG/PNG. */
export function displayRoadPaths(roads: DisplayRoad[], canvas: Canvas, color = "#adb3b8", style: ImageStyle = "pictorial"): string {
  return roads.map((road) => {
    const d = road.points.map((point, i) => {
      const p = pixels(point, canvas);
      return `${i ? "L" : "M"}${p.x.toFixed(3)},${p.y.toFixed(3)}`;
    }).join(" ");
    return `<path data-display-road="${escapeXml(road.key)}" id="road-${escapeXml(road.key)}" data-source-roads="${escapeXml(road.sourceIds.join(" "))}" data-geometry="${road.geometry}" d="${d}" stroke="${color}" stroke-width="${widthFor(road, style)}" fill="none" stroke-linecap="butt" stroke-linejoin="round"/>`;
  }).join("");
}

/** Code-rendered map: image-model output cannot replace this road layer. */
export function renderBriefMap(canvas: Canvas, roads: DisplayRoad[], places: Place[], theme: RenderTheme, style: ImageStyle): string {
  const editorial = style === "editorial";
  const design = EDITORIAL_DESIGN.tokens;
  const frame = editorial ? editorialFrame(canvas) : { x: 16, y: 16, width: canvas.width - 32, height: canvas.height - 56 };
  const background = editorial ? design.paper : theme === "mono" || theme === "civic" ? "#ffffff" : "#fffefa";
  const ink = editorial ? design.ink : "#26323d";
  const accent = theme === "mono" ? "#181818" : theme === "civic" ? "#1769a0" : editorial ? design.accent : "#de493b";
  const roadColor = editorial ? design.road : theme === "mono" ? "#aaaaaa" : "#adb3b8";
  const visual = visualStyles[style];
  const radius = visual.radius;
  const icons = places.map((place) => ({ ...place, ...pixels(place.anchor, canvas),
    radius: style === "pictorial" ? place.key === "D" || place.category === "park" ? 28 : 23 : radius }));
  const iconBoxes = icons.map((p) => ({ x: p.x - p.radius - 4, y: p.y - p.radius - 4, width: 2 * p.radius + 8, height: 2 * p.radius + 8 }));
  const segments = roads.flatMap((road) => road.points.slice(1).map((p, i) => ({
    a: pixels(road.points[i], canvas), b: pixels(p, canvas), halfWidth: widthFor(road, style) / 2 + 5,
    major: road.class === "primary" || road.class === "secondary",
  })));
  const labels = icons.map((place) => {
    const size = place.key === "D" ? visual.destinationText : visual.text;
    const maxChars = editorial ? place.key === "D" ? 18 : 7 : place.key === "D" ? 6 : 8;
    const padding = editorial && place.key === "D" ? 8 : 0;
    const words = place.label.trim().split(/\s+/u);
    const lines: string[] = [];
    for (const word of words) {
      const previous = lines.at(-1);
      if (previous && Array.from(`${previous} ${word}`).length <= maxChars) lines[lines.length - 1] += ` ${word}`;
      else {
        const chars = Array.from(word);
        const chunk = editorial ? Math.max(maxChars, 18) : maxChars;
        for (let i = 0; i < chars.length; i += chunk) lines.push(chars.slice(i, i + chunk).join(""));
      }
    }
    return { place, size, lines, padding, width: Math.max(1, ...lines.map((line) => textBoxWidth(line, size, 0))) + padding * 2, height: lines.length * (size + 5) + padding * 2 };
  });
  // A bounded beam lets a crowded hospital/venue pair trade label positions
  // without moving their geographic icons or masking a road with white boxes.
  let plans: Array<{ score: number; boxes: Box[] }> = [{ score: 0, boxes: [] }];
  for (const { place, width, height } of labels) {
    const radius = place.radius;
    const candidates = [radius + 8, radius + 24, radius + 48, radius + 80, radius + 112].flatMap((gap) => [
      ...(editorial ? [0, -12, 12, -24, 24, -width / 4, width / 4, -width / 2, width / 2, -width, width] : [0, -width / 4, width / 4]).flatMap((offset) => [
        { x: place.x - width / 2 + offset, y: place.y + gap, width, height },
        { x: place.x - width / 2 + offset, y: place.y - gap - height, width, height },
      ]),
      { x: place.x + gap, y: place.y - height / 2, width, height },
      { x: place.x - width - gap, y: place.y - height / 2, width, height },
      { x: place.x - width - gap, y: place.y + gap / 2, width, height },
      { x: place.x + gap, y: place.y + gap / 2, width, height },
    ]);
    const scored = candidates.map((box, i) => {
      const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const pin = nearestLabelEdge(place, box);
      let score = i * 0.02 + Math.hypot(center.x - place.x, center.y - place.y) * (editorial && place.key === "D" ? 8 : 1);
      if (box.x < frame.x + 8 || box.y < (editorial ? frame.y + 12 : 45) || box.x + box.width > frame.x + frame.width - 8 || box.y + box.height > (editorial ? frame.y + frame.height - 8 : canvas.height - 40)) score += 1e6;
      iconBoxes.forEach((icon, j) => {
        if (overlapArea(box, icon) > 0) score += 1e8;
        if (icons[j].key !== place.key && clipSegment(place.x, place.y, pin.x, pin.y,
          icon.x, icon.y, icon.x + icon.width, icon.y + icon.height)) score += 1e6;
      });
      for (const { a, b, halfWidth: h, major } of segments) {
        if (clipSegment(a.x, a.y, b.x, b.y, box.x - h, box.y - h, box.x + box.width + h, box.y + box.height + h)) score += editorial ? 1e7 : 1e5;
        const side = (p: Point) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
        const sideDistance = Math.abs(side(place)) / (Math.hypot(b.x - a.x, b.y - a.y) || 1);
        // A distant label can cross a road with a leader; its icon never moves.
        // Keep text off roads before preferring the same side for its label.
        if (sideDistance > h + radius && side(place) * side(center) < 0 && crosses(place, center, a, b)) score += editorial && major && place.key === "D" ? 1e6 : 100;
      }
      return { box, score };
    });
    plans = plans.flatMap((plan) => scored.map(({ box, score }) => ({ boxes: [...plan.boxes, box],
      score: plan.score + score + plan.boxes.reduce((sum, other, j) => {
        const pin = nearestLabelEdge(place, box), otherPlace = labels[j].place;
        const otherPin = nearestLabelEdge(otherPlace, other);
        const hasLeader = Math.hypot(pin.x - place.x, pin.y - place.y) > place.radius + 24;
        const otherHasLeader = Math.hypot(otherPin.x - otherPlace.x, otherPin.y - otherPlace.y) > otherPlace.radius + 24;
        let penalty = overlapArea(box, other) > 0 ? 1e8 : 0;
        if (hasLeader && otherHasLeader && crosses(place, pin, otherPlace, otherPin)) penalty += 1e6;
        if (hasLeader && clipSegment(place.x, place.y, pin.x, pin.y, other.x, other.y, other.x + other.width, other.y + other.height)) penalty += 1e6;
        if (otherHasLeader && clipSegment(otherPlace.x, otherPlace.y, otherPin.x, otherPin.y, box.x, box.y, box.x + box.width, box.y + box.height)) penalty += 1e6;
        return sum + penalty;
      }, 0) })))
      .sort((a, b) => a.score - b.score).slice(0, 64);
  }
  const boxes = plans[0].boxes;
  const roadLabels: string[] = [];
  const placeGroups: string[] = [];
  // Place each street name once on a clear part of its own band, away from POIs.
  const named = new Set<string>();
  for (const road of roads) {
    if (!road.label || named.has(road.label)) continue;
    const candidates = road.points.slice(1).flatMap((point, i) => {
      const a = pixels(road.points[i], canvas), b = pixels(point, canvas);
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      const labelWidth = textBoxWidth(road.label, editorial ? 16 : 13, 6);
      if (length < labelWidth + 30) return [];
      return [0.25, 0.5, 0.75].map((t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t,
        angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI, labelWidth }));
    });
    const label = candidates.find((p) => p.x > p.labelWidth / 2 + (editorial ? frame.x + 16 : 24) && p.x < (editorial ? frame.x + frame.width - 16 : canvas.width - 24) - p.labelWidth / 2 &&
      p.y > (editorial ? frame.y + 24 : 60) && p.y < (editorial ? frame.y + frame.height - 24 : canvas.height - 60) &&
      ![...iconBoxes, ...boxes].some((box) => overlapArea({ x: p.x - p.labelWidth / 2 - 10, y: p.y - 18, width: p.labelWidth + 20, height: 36 }, box) > 0));
    if (!label) continue;
    named.add(road.label);
    const angle = label.angle > 90 ? label.angle - 180 : label.angle < -90 ? label.angle + 180 : label.angle;
    roadLabels.push(`<text id="road-label-${escapeXml(road.key)}" transform="translate(${label.x.toFixed(2)} ${label.y.toFixed(2)}) rotate(${angle.toFixed(2)})" text-anchor="middle" dominant-baseline="middle" font-size="${editorial ? 16 : 13}" fill="${editorial ? design.muted : ink}">${escapeXml(road.label)}</text>`);
  }
  icons.forEach((place, i) => {
    const category = place.category ?? "building";
    const color = place.key === "D" ? accent : category === "park" ? "#527c4e" : category === "hospital" ? "#447f98" : ink;
    const scale = place.key === "D" ? style === "neighborhood" ? 1.3 : 1.8 : style === "neighborhood" ? 1 : 1.25;
    const circle = place.key === "D" ? "" : `<circle r="${radius}" fill="${background}" stroke="${color}" stroke-width="1.8"/>`;
    const id = place.key === "D" ? "destination" : `landmark-${escapeXml(encodeURIComponent(place.sourceId ?? place.key))}`;
    const symbol = editorial ? editorialPictogram(place.pictogram ?? category, place.key === "D" ? accent : ink, ink)
      : style === "pictorial"
      ? `<g transform="scale(${place.key === "D" ? 1.1 : 0.9})">${pictogram(place.pictogram ?? category, theme, place.key === "D")}</g>`
      : `${circle}<g transform="scale(${scale})">${landmarkIcon(category, 0, 0, color)}</g>`;
    const icon = `<g id="icon-${id}" transform="translate(${place.x.toFixed(3)} ${place.y.toFixed(3)})">${symbol}</g>`;
    const box = boxes[i], { lines, size, padding } = labels[i];
    const pin = nearestLabelEdge(place, box);
    const dx = pin.x - place.x, dy = pin.y - place.y, distance = Math.hypot(dx, dy);
    const leader = distance > place.radius + 24
      ? `<path id="leader-${id}" d="M${(place.x + dx * place.radius / distance).toFixed(2)},${(place.y + dy * place.radius / distance).toFixed(2)} L${pin.x.toFixed(2)},${pin.y.toFixed(2)}" fill="none" stroke="#7c858b" stroke-width="1"/>` : "";
    const plaque = editorial && place.key === "D" ? `<rect id="destination-plaque" x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="3" fill="${accent}"/>` : "";
    const text = `<text id="label-${id}" data-place-label="${escapeXml(place.key)}" data-label-box="${[box.x, box.y, box.width, box.height].map((v) => v.toFixed(2)).join(" ")}" x="${(box.x + box.width / 2).toFixed(2)}" y="${(box.y + size + padding - (editorial ? 2 : 0)).toFixed(2)}" text-anchor="middle" font-size="${size}" font-weight="${place.key === "D" || editorial ? 700 : 550}" fill="${plaque ? '#ffffff' : place.key === "D" ? accent : ink}">${lines.map((line, j) => `<tspan x="${(box.x + box.width / 2).toFixed(2)}" dy="${j ? size + 5 : 0}">${escapeXml(line)}</tspan>`).join("")}</text>`;
    placeGroups.push(`<g id="place-${id}" data-place="${escapeXml(place.key)}"><title>${escapeXml(place.label)}</title>${leader}${icon}${plaque}${text}</g>`);
  });
  const heading = editorial ? `<g id="heading" fill="${ink}"><path d="M36,34 H62" stroke="${accent}" stroke-width="4"/><text x="74" y="40" font-size="14" letter-spacing="2">LOCATION</text><text x="36" y="91" font-size="32" font-weight="700">${escapeXml(places.find((p) => p.key === 'D')?.label ?? '')}</text><g transform="translate(${canvas.width - 64} 72)"><text y="-24" text-anchor="middle" font-size="13">N</text><path d="M0,-14 L-6,9 L0,5 L6,9 Z" fill="${ink}"/></g></g><rect id="map-ground" x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}" fill="${theme === 'mono' ? '#eeeeee' : design.ground}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}" font-family="${editorial ? "'Apple SD Gothic Neo', 'Noto Sans CJK KR', Arial" : "Arial, 'Apple SD Gothic Neo', 'Noto Sans CJK KR'"}, sans-serif"><metadata>Map data © OpenStreetMap contributors, ODbL. Deterministic road geometry. Category pictograms are symbolic, not building likenesses.</metadata><rect id="background" width="100%" height="100%" fill="${background}"/>${heading}<defs><clipPath id="map"><rect x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}"/></clipPath></defs><g clip-path="url(#map)"><g id="roads">${displayRoadPaths(roads, canvas, roadColor, style)}</g><g id="road-labels">${roadLabels.join("")}</g><g id="places">${placeGroups.join("")}</g></g><text id="attribution" x="${editorial ? frame.x : 28}" y="${canvas.height - (editorial ? 20 : 16)}" font-size="12" fill="#737b81">© OpenStreetMap contributors</text></svg>`;
}

function nearestLabelEdge(point: Point, box: Box): Point {
  return { x: Math.max(box.x, Math.min(box.x + box.width, point.x)),
    y: Math.max(box.y, Math.min(box.y + box.height, point.y)) };
}

function crosses(a: Point, b: Point, c: Point, d: Point): boolean {
  const dx = b.x - a.x, dy = b.y - a.y, ex = d.x - c.x, ey = d.y - c.y;
  const determinant = dx * ey - dy * ex;
  if (Math.abs(determinant) < 1e-6) return false;
  const t = ((c.x - a.x) * ey - (c.y - a.y) * ex) / determinant;
  const u = ((c.x - a.x) * dy - (c.y - a.y) * dx) / determinant;
  return t > 0 && t < 1 && u > 0 && u < 1;
}
