import type { BuildingFootprint, GeoPoint, NormalizedPosition } from "../types.js";
import { buildingContains, validBuildingRing } from "../buildings.js";
import { escapeXml } from "./xml.js";

export interface ProjectedBuilding {
  sourceId: string;
  name?: string;
  destination: boolean;
  polygons: Array<{ outer: NormalizedPosition[]; holes: NormalizedPosition[][] }>;
}

export function projectBuildings(buildings: BuildingFootprint[], center: GeoPoint,
  project: (lat: number, lon: number) => [number, number], canvas: { width: number; height: number }) {
  const valid = buildings.filter((b) => b.polygons.length && b.polygons.every((p) => validBuildingRing(p.outer) && p.holes.every(validBuildingRing)));
  const matches = valid.filter((b) => buildingContains(b, center));
  const destinationId = matches.length === 1 ? matches[0].id : null;
  const normalized = (ring: GeoPoint[]) => ring.map(({ lat, lon }) => {
    const [x, y] = project(lat, lon); return { x: x / canvas.width, y: y / canvas.height };
  });
  const projected: ProjectedBuilding[] = valid.map((b) => ({ sourceId: b.id, name: b.name, destination: b.id === destinationId,
    polygons: b.polygons.map((p) => ({ outer: normalized(p.outer), holes: p.holes.map(normalized) })) }));
  const visible = projected.filter((b) => b.polygons.some(({ outer }) => Math.min(...outer.map((p) => p.x)) < 1 &&
    Math.max(...outer.map((p) => p.x)) > 0 && Math.min(...outer.map((p) => p.y)) < 1 && Math.max(...outer.map((p) => p.y)) > 0));
  return { buildings: visible, suppliedCount: buildings.length, discardedCount: buildings.length - valid.length,
    visibleCount: visible.length, destinationBuildingId: destinationId,
    destinationMatch: matches.length > 1 ? "ambiguous" as const : destinationId ? "contains-source-point" as const : "none" as const,
    coverage: "partial-osm-data" as const };
}

/** Separate editable source polygons; evenodd preserves open courtyards. */
export function renderBuildingLayer(buildings: ProjectedBuilding[], canvas: { width: number; height: number }, accent: string, mono = false): string {
  const ringPath = (ring: NormalizedPosition[]) => ring.map((p, i) => `${i ? "L" : "M"}${(p.x * canvas.width).toFixed(2)},${(p.y * canvas.height).toFixed(2)}`).join(" ") + " Z";
  return `<g id="buildings">${[...buildings].sort((a,b) => Number(a.destination) - Number(b.destination)).map((b) =>
    `<path id="building-${encodeURIComponent(b.sourceId)}" data-building-footprint="${escapeXml(b.sourceId)}" data-destination-building="${b.destination}" d="${b.polygons.flatMap((p) => [ringPath(p.outer), ...p.holes.map(ringPath)]).join(" ")}" fill-rule="evenodd" fill="${b.destination ? mono ? "#d7d7d7" : "#f5e0d5" : mono ? "#eeeeee" : "#e9ece8"}" stroke="${b.destination ? accent : mono ? "#c7c7c7" : "#cbd2ca"}" stroke-width="${b.destination ? 2.5 : 1.2}" stroke-linejoin="round"><title>${escapeXml(b.name ?? b.sourceId)}</title></path>`
  ).join("")}</g>`;
}
