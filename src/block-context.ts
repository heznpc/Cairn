import type { Road } from "./types.js";

export interface GeoPoint { lat: number; lon: number }
export interface BlockBoundary {
  sourceRoadIds: string[];
  sourceNodeIds: string[];
  points: GeoPoint[];
}

/** Find a source-node street face containing the destination. No proximity
 * snapping: geometric crossings without shared OSM nodes never join here.
 * Service driveways, paths and grade-separated ways are not block boundaries.
 */
export function destinationBlock(roads: Road[], center: GeoPoint): BlockBoundary | undefined {
  const nodes = new Map<string, GeoPoint>();
  const edges = new Map<string, Map<string, Set<string>>>();
  const add = (a: string, b: string, road: string) => {
    const adjacent = edges.get(a) ?? new Map<string, Set<string>>();
    const ids = adjacent.get(b) ?? new Set<string>();
    ids.add(road); adjacent.set(b, ids); edges.set(a, adjacent);
  };
  for (const road of roads) {
    if (road.class === "path" || !road.nodes || road.tags?.highway === "service" ||
      road.tags?.highway?.endsWith("_link") || (road.tags?.layer && road.tags.layer !== "0") ||
      (road.tags?.bridge && road.tags.bridge !== "no") || (road.tags?.tunnel && road.tags.tunnel !== "no")) continue;
    road.nodes.forEach((node) => nodes.set(node.id, node));
    road.nodes.slice(1).forEach((node, i) => {
      const a = road.nodes![i].id, b = node.id;
      if (a !== b) { add(a, b, road.id); add(b, a, road.id); }
    });
  }
  // Prune dead ends before walking faces so an internal cul-de-sac cannot
  // turn the containing face into an out-and-back polygon.
  const leaves = [...edges].filter(([, next]) => next.size < 2).map(([id]) => id);
  for (let i = 0; i < leaves.length; i++) {
    const id = leaves[i];
    for (const neighbor of edges.get(id)?.keys() ?? []) {
      edges.get(neighbor)?.delete(id);
      if (edges.get(neighbor)?.size === 1) leaves.push(neighbor);
    }
    edges.delete(id);
  }
  const lonScale = Math.cos(center.lat * Math.PI / 180);
  const point = (id: string) => {
    const p = nodes.get(id)!;
    return { x: (p.lon - center.lon) * lonScale * 111_320, y: (p.lat - center.lat) * 111_320 };
  };
  const ordered = new Map([...edges].map(([id, next]) => {
    const a = point(id);
    return [id, [...next.keys()].sort((x, y) => {
      const b = point(x), c = point(y);
      return Math.atan2(b.y - a.y, b.x - a.x) - Math.atan2(c.y - a.y, c.x - a.x) || x.localeCompare(y);
    })];
  }));
  const visited = new Set<string>();
  let best: { area: number; boundary: BlockBoundary } | undefined;
  const edgeCount = [...edges.values()].reduce((n, adjacent) => n + adjacent.size, 0);
  for (const [start, adjacent] of ordered) for (const first of adjacent) {
    if (visited.has(`${start}/${first}`)) continue;
    const ring: string[] = [], roadIds = new Set<string>();
    let a = start, b = first, closed = false;
    for (let step = 0; step <= edgeCount; step++) {
      const key = `${a}/${b}`;
      if (visited.has(key)) break;
      visited.add(key); ring.push(a);
      for (const id of edges.get(a)?.get(b) ?? []) roadIds.add(id);
      const next = ordered.get(b)!;
      const c = next[(next.indexOf(a) + next.length - 1) % next.length];
      a = b; b = c;
      if (a === start && b === first) { closed = true; break; }
    }
    if (!closed || ring.length < 3 || new Set(ring).size !== ring.length) continue;
    const polygon = ring.map(point);
    const area = polygon.reduce((sum, p, i) => {
      const q = polygon[(i + 1) % polygon.length];
      return sum + p.x * q.y - q.x * p.y;
    }, 0) / 2;
    // Clockwise walks are the unbounded outer face. Exclude tiny traffic
    // islands and self-intersecting polygons from block-context evidence.
    if (area < 100 || (best && area >= best.area) || !containsOrigin(polygon) || !isSimple(polygon)) continue;
    best = { area, boundary: { sourceRoadIds: [...roadIds].sort(), sourceNodeIds: ring,
      points: ring.map((id) => { const { lat, lon } = nodes.get(id)!; return { lat, lon }; }) } };
  }
  return best?.boundary;
}

function containsOrigin(points: Array<{ x: number; y: number }>): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / (dx * dx + dy * dy || 1)));
    if (Math.hypot(a.x + dx * t, a.y + dy * t) < .1) return false;
    if ((a.y > 0) !== (b.y > 0) && 0 < a.x + (b.x - a.x) * -a.y / (b.y - a.y)) inside = !inside;
  }
  return inside;
}

function isSimple(points: Array<{ x: number; y: number }>): boolean {
  const side = (a: typeof points[number], b: typeof a, c: typeof a) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  for (let i = 0; i < points.length; i++) for (let j = i + 2; j < points.length; j++) {
    if (i === 0 && j === points.length - 1) continue;
    const a = points[i], b = points[(i + 1) % points.length], c = points[j], d = points[(j + 1) % points.length];
    if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) return false;
  }
  return true;
}
