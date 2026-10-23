import { z } from "zod";
import type { BuildingFootprint, GeoPoint } from "./types.js";
import { overpassFetch, OVERPASS_TIMEOUT_MS } from "./overpass.js";
import { MAX_RADIUS_METERS } from "./limits.js";
import type { UpstreamOptions } from "./upstream-config.js";

const Point = z.object({ lat: z.number().finite().min(-90).max(90), lon: z.number().finite().min(-180).max(180) });
const Geometry = z.array(Point);
const Element = z.object({
  type: z.enum(["way", "relation"]), id: z.number().int().nonnegative().safe(),
  tags: z.record(z.string()).default({}), geometry: Geometry.optional(),
  members: z.array(z.object({ type: z.string(), ref: z.number().int().nonnegative().safe(), role: z.string(), geometry: Geometry.optional() })).optional(),
});
const equal = (a: GeoPoint, b: GeoPoint) => a.lat === b.lat && a.lon === b.lon;

/** Reject open outlines instead of inventing the missing closing wall. */
export function validBuildingRing(ring: GeoPoint[]): boolean {
  if (ring.length < 4 || !equal(ring[0], ring.at(-1)!)) return false;
  if (new Set(ring.slice(0, -1).map((p) => `${p.lat}/${p.lon}`)).size !== ring.length - 1) return false;
  const origin = ring[0];
  const area = ring.slice(1).reduce((a, p, i) => a + (ring[i].lon - origin.lon) * (p.lat - origin.lat) - (p.lon - origin.lon) * (ring[i].lat - origin.lat), 0);
  if (Math.abs(area) <= 1e-12) return false;
  const side = (a: GeoPoint, b: GeoPoint, c: GeoPoint) => (b.lon - a.lon) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lon - a.lon);
  for (let i = 0; i < ring.length - 1; i++) for (let j = i + 2; j < ring.length - 1; j++) {
    if (i === 0 && j === ring.length - 2) continue;
    if (side(ring[i], ring[i + 1], ring[j]) * side(ring[i], ring[i + 1], ring[j + 1]) < 0 &&
      side(ring[j], ring[j + 1], ring[i]) * side(ring[j], ring[j + 1], ring[i + 1]) < 0) return false;
  }
  return true;
}

export function pointInBuildingRing(p: GeoPoint, ring: GeoPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    const cross = (b.lon - a.lon) * (p.lat - a.lat) - (b.lat - a.lat) * (p.lon - a.lon);
    if (Math.abs(cross) < 1e-14 && p.lat >= Math.min(a.lat,b.lat) && p.lat <= Math.max(a.lat,b.lat) && p.lon >= Math.min(a.lon,b.lon) && p.lon <= Math.max(a.lon,b.lon)) return false;
    if ((a.lat > p.lat) !== (b.lat > p.lat) && p.lon < a.lon + (b.lon - a.lon) * (p.lat - a.lat) / (b.lat - a.lat)) inside = !inside;
  }
  return inside;
}

export function buildingContains(building: BuildingFootprint, p: GeoPoint): boolean {
  return building.polygons.some(({ outer, holes }) => pointInBuildingRing(p, outer) && !holes.some((hole) => pointInBuildingRing(p, hole)));
}

function stitch(parts: GeoPoint[][]): GeoPoint[][] | undefined {
  const remaining = parts.map((p) => [...p]);
  const rings: GeoPoint[][] = [];
  while (remaining.length) {
    const ring = remaining.shift()!;
    if (ring.length < 2) return;
    while (!equal(ring[0], ring.at(-1)!)) {
      const matches = remaining.flatMap((part, i) => equal(ring.at(-1)!, part[0]) ? [{ i, reverse: false }] : equal(ring.at(-1)!, part.at(-1)!) ? [{ i, reverse: true }] : []);
      if (matches.length !== 1) return;
      const { i, reverse } = matches[0];
      const next = remaining.splice(i, 1)[0];
      if (reverse) next.reverse();
      ring.push(...next.slice(1));
    }
    if (!validBuildingRing(ring)) return;
    rings.push(ring);
  }
  return rings;
}

/** Keep source outlines, courtyard holes and typed identities. No box fitting,
 * invented subdivision, proximity matching or building-part duplication. */
export function buildingsFromElements(elements: unknown[]): BuildingFootprint[] {
  const parsed = elements.flatMap((el) => { const p = Element.safeParse(el); return p.success && p.data.tags.building && !["no", "construction", "demolished"].includes(p.data.tags.building) ? [p.data] : []; });
  const buildings: BuildingFootprint[] = [];
  const members = new Set<number>();
  for (const el of parsed.filter((e) => e.type === "relation" && e.tags.type === "multipolygon")) {
    const ways = el.members?.filter((m) => m.type === "way" && ["outer", "inner", ""].includes(m.role));
    ways?.forEach((m) => members.add(m.ref));
    if (!ways?.length || ways.some((m) => !m.geometry?.length)) continue;
    const outer = stitch(ways.filter((m) => m.role !== "inner").map((m) => m.geometry!));
    const inner = stitch(ways.filter((m) => m.role === "inner").map((m) => m.geometry!));
    if (!outer?.length || !inner || inner.some((hole) => outer.filter((ring) => pointInBuildingRing(hole[0], ring)).length !== 1)) continue;
    buildings.push({ id: `relation/${el.id}`, name: el.tags.name, tags: el.tags,
      polygons: outer.map((ring) => ({ outer: ring, holes: inner.filter((hole) => pointInBuildingRing(hole[0], ring)) })) });
    ways.forEach((m) => members.add(m.ref));
  }
  for (const el of parsed.filter((e) => e.type === "way" && !members.has(e.id))) {
    if (!el.geometry || !validBuildingRing(el.geometry)) continue;
    buildings.push({ id: `way/${el.id}`, name: el.tags.name, tags: el.tags, polygons: [{ outer: el.geometry, holes: [] }] });
  }
  return buildings.sort((a, b) => a.id.localeCompare(b.id));
}

export async function findBuildings(lat: number, lon: number, radiusMeters = 480, upstream: UpstreamOptions = {}): Promise<BuildingFootprint[]> {
  const radius = Math.min(radiusMeters, MAX_RADIUS_METERS);
  const query = `[out:json][timeout:25];(way["building"]["building"!="no"](around:${radius},${lat},${lon});relation["building"]["building"!="no"]["type"="multipolygon"](around:${radius},${lat},${lon}););out geom;`;
  return buildingsFromElements(await overpassFetch(query, OVERPASS_TIMEOUT_MS, upstream));
}
