import type { LandmarkCategory, NormalizedPosition, RenderTheme } from "../types.js";
import type { ImageStyle } from "../image-styles.js";
import type { DisplayRoad } from "./display-roads.js";
import { landmarkIcon } from "./icons.js";
import { clipSegment, type Point } from "./road-geometry.js";
import { escapeXml } from "./xml.js";
import { textBoxWidth, overlapArea, type Box } from "./text.js";

interface Canvas { width: number; height: number }
interface Place { key: string; label: string; category?: LandmarkCategory; anchor: NormalizedPosition }
const widthFor = (road: DisplayRoad) => ({ primary: 26, secondary: 18, tertiary: 7, residential: 5, path: 3 })[road.class];
const pixels = (p: NormalizedPosition, canvas: Canvas): Point => ({ x: p.x * canvas.width, y: p.y * canvas.height });

/** The same path layer is used in the blueprint and the delivered SVG/PNG. */
export function displayRoadPaths(roads: DisplayRoad[], canvas: Canvas, color = "#adb3b8"): string {
  return roads.map((road) => {
    const d = road.points.map((point, i) => {
      const p = pixels(point, canvas);
      return `${i ? "L" : "M"}${p.x.toFixed(3)},${p.y.toFixed(3)}`;
    }).join(" ");
    return `<path data-display-road="${escapeXml(road.key)}" data-source-roads="${escapeXml(road.sourceIds.join(" "))}" data-geometry="${road.geometry}" d="${d}" stroke="${color}" stroke-width="${widthFor(road)}" fill="none" stroke-linecap="butt" stroke-linejoin="round"/>`;
  }).join("");
}

/** Code-rendered map: image-model output cannot replace this road layer. */
export function renderBriefMap(canvas: Canvas, roads: DisplayRoad[], places: Place[], theme: RenderTheme, style: ImageStyle): string {
  const background = theme === "mono" || theme === "civic" ? "#ffffff" : "#fffefa";
  const ink = "#26323d";
  const accent = theme === "mono" ? "#181818" : theme === "civic" ? "#1769a0" : "#de493b";
  const roadColor = theme === "mono" ? "#aaaaaa" : "#adb3b8";
  const radius = style === "schematic" ? 16 : 20;
  const icons = places.map((place) => ({ ...place, ...pixels(place.anchor, canvas) }));
  const iconBoxes = icons.map((p) => ({ x: p.x - radius - 4, y: p.y - radius - 4, width: 2 * radius + 8, height: 2 * radius + 8 }));
  const segments = roads.flatMap((road) => road.points.slice(1).map((p, i) => ({
    a: pixels(road.points[i], canvas), b: pixels(p, canvas), halfWidth: widthFor(road) / 2 + 5,
  })));
  const labels = icons.map((place) => {
    const size = place.key === "D" ? 20 : 17;
    const maxChars = place.key === "D" ? 6 : 8;
    const words = place.label.trim().split(/\s+/u);
    const lines: string[] = [];
    for (const word of words) {
      const previous = lines.at(-1);
      if (previous && Array.from(`${previous} ${word}`).length <= maxChars) lines[lines.length - 1] += ` ${word}`;
      else {
        const chars = Array.from(word);
        for (let i = 0; i < chars.length; i += maxChars) lines.push(chars.slice(i, i + maxChars).join(""));
      }
    }
    return { place, size, lines, width: Math.max(1, ...lines.map((line) => textBoxWidth(line, size, 0))), height: lines.length * (size + 5) };
  });
  // A bounded beam lets a crowded hospital/venue pair trade label positions
  // without moving their geographic icons or masking a road with white boxes.
  let plans: Array<{ score: number; boxes: Box[] }> = [{ score: 0, boxes: [] }];
  for (const { place, width, height } of labels) {
    const candidates = [radius + 8, radius + 24, radius + 48, radius + 80].flatMap((gap) => [
      { x: place.x - width / 2, y: place.y + gap, width, height },
      { x: place.x - width / 2, y: place.y - gap - height, width, height },
      { x: place.x + gap, y: place.y - height / 2, width, height },
      { x: place.x - width - gap, y: place.y - height / 2, width, height },
      { x: place.x - width - gap, y: place.y + gap / 2, width, height },
      { x: place.x + gap, y: place.y + gap / 2, width, height },
    ]);
    const scored = candidates.map((box, i) => {
      const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      let score = i * 0.02 + Math.hypot(center.x - place.x, center.y - place.y);
      if (box.x < 24 || box.y < 45 || box.x + box.width > canvas.width - 24 || box.y + box.height > canvas.height - 40) score += 1e6;
      for (const icon of iconBoxes) score += overlapArea(box, icon) * 100;
      for (const { a, b, halfWidth: h } of segments) {
        if (clipSegment(a.x, a.y, b.x, b.y, box.x - h, box.y - h, box.x + box.width + h, box.y + box.height + h)) score += 1e5;
        const side = (p: Point) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
        const sideDistance = Math.abs(side(place)) / (Math.hypot(b.x - a.x, b.y - a.y) || 1);
        if (sideDistance > h + radius && side(place) * side(center) < 0 && crosses(place, center, a, b)) score += 1e6;
      }
      return { box, score };
    });
    plans = plans.flatMap((plan) => scored.map(({ box, score }) => ({ boxes: [...plan.boxes, box],
      score: plan.score + score + plan.boxes.reduce((sum, other) => sum + overlapArea(box, other) * 100, 0) })))
      .sort((a, b) => a.score - b.score).slice(0, 64);
  }
  const boxes = plans[0].boxes;
  const body = [displayRoadPaths(roads, canvas, roadColor)];
  // Place each street name once on a clear part of its own band, away from POIs.
  const named = new Set<string>();
  for (const road of roads) {
    if (!road.label || named.has(road.label)) continue;
    const candidates = road.points.slice(1).flatMap((point, i) => {
      const a = pixels(road.points[i], canvas), b = pixels(point, canvas);
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      const labelWidth = textBoxWidth(road.label, 13, 6);
      if (length < labelWidth + 30) return [];
      return [0.25, 0.5, 0.75].map((t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t,
        angle: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI, labelWidth }));
    });
    const label = candidates.find((p) => p.x > p.labelWidth / 2 + 24 && p.x < canvas.width - p.labelWidth / 2 - 24 &&
      p.y > 60 && p.y < canvas.height - 60 &&
      ![...iconBoxes, ...boxes].some((box) => overlapArea({ x: p.x - p.labelWidth / 2 - 10, y: p.y - 18, width: p.labelWidth + 20, height: 36 }, box) > 0));
    if (!label) continue;
    named.add(road.label);
    const angle = label.angle > 90 ? label.angle - 180 : label.angle < -90 ? label.angle + 180 : label.angle;
    body.push(`<text transform="translate(${label.x.toFixed(2)} ${label.y.toFixed(2)}) rotate(${angle.toFixed(2)})" text-anchor="middle" dominant-baseline="middle" font-size="13" fill="${ink}">${escapeXml(road.label)}</text>`);
  }
  icons.forEach((place, i) => {
    const category = place.category ?? "building";
    const color = place.key === "D" ? accent : category === "park" ? "#527c4e" : category === "hospital" ? "#447f98" : ink;
    const scale = place.key === "D" ? 1.8 : 1.25;
    const circle = place.key === "D" ? "" : `<circle r="${radius}" fill="${background}" stroke="${color}" stroke-width="1.8"/>`;
    body.push(`<g data-place="${escapeXml(place.key)}" transform="translate(${place.x.toFixed(3)} ${place.y.toFixed(3)})">${circle}<g transform="scale(${scale})">${landmarkIcon(category, 0, 0, color)}</g></g>`);
    const box = boxes[i], { lines, size } = labels[i];
    body.push(`<text data-place-label="${escapeXml(place.key)}" x="${(box.x + box.width / 2).toFixed(2)}" y="${(box.y + size).toFixed(2)}" text-anchor="middle" font-size="${size}" font-weight="${place.key === "D" ? 700 : 550}" fill="${place.key === "D" ? accent : ink}">${lines.map((line, j) => `<tspan x="${(box.x + box.width / 2).toFixed(2)}" dy="${j ? size + 5 : 0}">${escapeXml(line)}</tspan>`).join("")}</text>`);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}" font-family="Arial, 'Apple SD Gothic Neo', 'Noto Sans CJK KR', sans-serif"><metadata>Map data © OpenStreetMap contributors, ODbL. Deterministic road geometry.</metadata><rect width="100%" height="100%" fill="${background}"/><defs><clipPath id="map"><rect x="16" y="16" width="${canvas.width - 32}" height="${canvas.height - 56}"/></clipPath></defs><g clip-path="url(#map)">${body.join("")}</g><text x="28" y="${canvas.height - 16}" font-size="12" fill="#737b81">© OpenStreetMap contributors</text></svg>`;
}

function crosses(a: Point, b: Point, c: Point, d: Point): boolean {
  const dx = b.x - a.x, dy = b.y - a.y, ex = d.x - c.x, ey = d.y - c.y;
  const determinant = dx * ey - dy * ex;
  if (Math.abs(determinant) < 1e-6) return false;
  const t = ((c.x - a.x) * ey - (c.y - a.y) * ex) / determinant;
  const u = ((c.x - a.x) * dy - (c.y - a.y) * dx) / determinant;
  return t > 0 && t < 1 && u > 0 && u < 1;
}
