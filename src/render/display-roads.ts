import type { NormalizedPosition, Road } from "../types.js";
import type { Projector } from "./projection.js";
import { clipSegment, type Point } from "./road-geometry.js";

export interface DisplayRoad {
  key: string;
  label: string;
  class: Road["class"];
  sourceRoadKeys: string[];
  sourceIds: string[];
  geometry: "source" | "straight" | "paired-carriageways";
  points: NormalizedPosition[];
}

interface Vertex extends Point { id: string }
interface Edge { a: Vertex; b: Vertex; source: number }
interface Axis { a: Point; b: Point; dx: number; dy: number; length: number }
interface Chain {
  group: string;
  sources: Set<number>;
  vertices: Vertex[];
  points: Point[];
  axis: Axis | null;
  geometry: DisplayRoad["geometry"];
}

const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;
const subtract = (a: Point, b: Point) => ({ x: a.x - b.x, y: a.y - b.y });
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Display geometry only. Source nodes and routing geometry are never modified. */
export function buildDisplayRoads(
  roads: Road[], project: Projector, canvas: { width: number; height: number },
  pixelsPerMeter: number, simplify = true,
): { roads: DisplayRoad[]; nodes: Array<{ sourceId: string; anchor: NormalizedPosition }> } {
  const normalize = (p: Point) => ({ x: p.x / canvas.width, y: p.y / canvas.height });
  const chains = joinWays(roads, project);
  if (simplify) {
    for (const chain of chains) {
      const visible = visiblePoints(chain.points, canvas);
      chain.axis = straightAxis(visible, 4 * pixelsPerMeter);
      if (chain.axis) {
        chain.points = [chain.axis.a, chain.axis.b];
        chain.geometry = "straight";
      }
    }
    // Only mutually unambiguous, overlapping opposite one-way carriageways.
    // A name or proximity alone never establishes a pair.
    const partners = chains.map((a, i) => chains.flatMap((b, j) =>
      i !== j && canPair(a, b, roads, project, pixelsPerMeter) ? [j] : []));
    const consumed = new Set<number>();
    const merged: Chain[] = [];
    chains.forEach((chain, i) => {
      if (consumed.has(i)) return;
      const j = partners[i][0];
      if (partners[i].length === 1 && partners[j].length === 1 && partners[j][0] === i) {
        merged.push(mergePair(chain, chains[j]));
        consumed.add(j);
      } else merged.push(chain);
    });
    chains.splice(0, chains.length, ...merged);
  }

  // Reattach side streets at their *existing* source nodes, never at a nearby
  // geometric crossing. Two carriageway junctions can share one display anchor.
  const memberships = new Map<string, { point: Point; chains: Set<Chain> }>();
  for (const chain of chains) for (const vertex of chain.vertices) {
    const item = memberships.get(vertex.id) ?? { point: vertex, chains: new Set<Chain>() };
    item.chains.add(chain);
    memberships.set(vertex.id, item);
  }
  const targets = new Map<string, Point>();
  for (const [id, { point, chains: members }] of memberships) {
    const axes = [...members].flatMap((chain) => chain.axis ? [chain.axis] : []);
    let target = axes.length ? projectOnAxis(point, axes[0]) : point;
    if (axes.length === 2) target = intersection(axes[0], axes[1]) ?? point;
    if (axes.length > 2 || distance(point, target) > 30 * pixelsPerMeter) target = point;
    targets.set(id, target);
  }
  for (const chain of chains) {
    if (!chain.axis) chain.points = chain.vertices.map((v) => targets.get(v.id) ?? v);
    else if (chain.geometry === "straight") {
      const ends = [chain.vertices[0], chain.vertices[chain.vertices.length - 1]];
      chain.points = [chain.axis.a, chain.axis.b].map((point, i) => {
        const target = targets.get(ends[i].id);
        return target && distance(ends[i], point) <= 5 * pixelsPerMeter
          ? projectOnAxis(target, chain.axis!) : point;
      });
    }
  }
  return {
    roads: chains.map((chain, i) => {
      const sources = [...chain.sources].sort((a, b) => a - b);
      const source = roads[sources[0]];
      return { key: `S${i + 1}`, label: source.name ?? "", class: source.class,
        sourceRoadKeys: sources.map((i) => `R${i + 1}`), sourceIds: sources.map((i) => roads[i].id),
        geometry: chain.geometry, points: chain.points.map(normalize) };
    }),
    nodes: [...targets].filter(([id]) => !id.startsWith("synthetic:"))
      .map(([sourceId, point]) => ({ sourceId, anchor: normalize(point) })),
  };
}

function joinWays(roads: Road[], project: Projector): Chain[] {
  const groups = new Map<string, Edge[]>();
  roads.forEach((road, source) => {
    const group = JSON.stringify([road.name || `id:${road.id}`, road.class,
      road.tags?.layer ?? "", road.tags?.bridge ?? "", road.tags?.tunnel ?? ""]);
    const nodes = road.nodes?.length ? road.nodes : road.points.map((p, i) => ({ ...p, id: `synthetic:${source}:${i}` }));
    const vertices = nodes.map((node) => {
      const [x, y] = project(node.lat, node.lon);
      return { id: node.id, x, y };
    });
    const edges = groups.get(group) ?? [];
    for (let i = 1; i < vertices.length; i++) {
      if (distance(vertices[i - 1], vertices[i]) > 0.001) edges.push({ a: vertices[i - 1], b: vertices[i], source });
    }
    groups.set(group, edges);
  });
  const chains: Chain[] = [];
  for (const [group, edges] of groups) {
    const atNode = new Map<string, number[]>();
    edges.forEach((edge, index) => {
      for (const v of [edge.a, edge.b]) atNode.set(v.id, [...(atNode.get(v.id) ?? []), index]);
    });
    const visited = new Set<number>();
    const walk = (first: number, start: Vertex) => {
      const vertices = [start];
      const sources = new Set<number>();
      let index = first, node = start;
      while (!visited.has(index)) {
        visited.add(index);
        const edge = edges[index];
        sources.add(edge.source);
        node = edge.a.id === node.id ? edge.b : edge.a;
        vertices.push(node);
        const next = atNode.get(node.id)!;
        if (next.length !== 2) break;
        const unvisited = next.find((i) => !visited.has(i));
        if (unvisited === undefined) break;
        index = unvisited;
      }
      chains.push({ group, sources, vertices, points: vertices, axis: null, geometry: "source" });
    };
    edges.forEach((edge, i) => {
      if (visited.has(i)) return;
      if (atNode.get(edge.a.id)!.length !== 2) walk(i, edge.a);
      else if (atNode.get(edge.b.id)!.length !== 2) walk(i, edge.b);
    });
    edges.forEach((edge, i) => { if (!visited.has(i)) walk(i, edge.a); });
  }
  return chains;
}

function visiblePoints(points: Point[], canvas: { width: number; height: number }): Point[] {
  const visible: Point[] = [];
  let last: Point | undefined;
  for (let i = 1; i < points.length; i++) {
    const clipped = clipSegment(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y,
      0, 0, canvas.width, canvas.height);
    if (!clipped) continue;
    const [a, b] = clipped.map(([x, y]) => ({ x, y }));
    // Separate visits to the canvas cannot be replaced by a chord across it.
    if (last && distance(last, a) > 0.01) return [];
    if (!last) visible.push(a);
    visible.push(b);
    last = b;
  }
  return visible;
}

function axisBetween(a: Point, b: Point): Axis | null {
  const length = distance(a, b);
  return length > 0.01 ? { a, b, length, dx: (b.x - a.x) / length, dy: (b.y - a.y) / length } : null;
}

function straightAxis(points: Point[], tolerance: number): Axis | null {
  if (points.length < 2) return null;
  const axis = axisBetween(points[0], points[points.length - 1]);
  if (!axis) return null;
  for (let i = 0; i < points.length; i++) {
    if (distance(points[i], projectOnAxis(points[i], axis)) > tolerance) return null;
    if (i === 0) continue;
    const segment = subtract(points[i], points[i - 1]);
    const length = Math.hypot(segment.x, segment.y);
    // Reject real jogs, bends and reversals even if their overall offset is small.
    if (length > 0.01 && (segment.x * axis.dx + segment.y * axis.dy) / length < Math.cos(Math.PI / 15)) return null;
  }
  return axis;
}

function projectOnAxis(point: Point, axis: Axis): Point {
  const t = (point.x - axis.a.x) * axis.dx + (point.y - axis.a.y) * axis.dy;
  return { x: axis.a.x + t * axis.dx, y: axis.a.y + t * axis.dy };
}

function trafficDirection(chain: Chain, roads: Road[], project: Projector): Point | null {
  let sum = { x: 0, y: 0 };
  for (const i of chain.sources) {
    const road = roads[i];
    if (!road.name || !road.nodes?.length || !["yes", "1", "-1"].includes(road.tags?.oneway ?? "")) return null;
    const points = road.nodes;
    const a = project(points[0].lat, points[0].lon), b = project(points[points.length - 1].lat, points[points.length - 1].lon);
    const sign = road.tags?.oneway === "-1" ? -1 : 1;
    sum = { x: sum.x + (b[0] - a[0]) * sign, y: sum.y + (b[1] - a[1]) * sign };
  }
  const length = Math.hypot(sum.x, sum.y);
  return length ? { x: sum.x / length, y: sum.y / length } : null;
}

function canPair(a: Chain, b: Chain, roads: Road[], project: Projector, ppm: number): boolean {
  if (a.group !== b.group || !a.axis || !b.axis || [...a.sources].some((i) => b.sources.has(i))) return false;
  const da = trafficDirection(a, roads, project), db = trafficDirection(b, roads, project);
  if (!da || !db || dot(da, db) > -Math.cos(Math.PI / 30)) return false;
  const aa = a.axis, bb = b.axis;
  const direction = { x: aa.dx, y: aa.dy };
  const ends = [dot(subtract(bb.a, aa.a), direction), dot(subtract(bb.b, aa.a), direction)].sort((x, y) => x - y);
  const overlap = Math.max(0, Math.min(aa.length, ends[1]) - Math.max(0, ends[0]));
  if (overlap < 0.85 * Math.max(aa.length, bb.length)) return false;
  const signedGaps = [bb.a, bb.b].map((p) => (p.x - aa.a.x) * -aa.dy + (p.y - aa.a.y) * aa.dx);
  if (signedGaps[0] * signedGaps[1] <= 0) return false;
  const gaps = signedGaps.map(Math.abs);
  return gaps.every((gap) => gap >= 2 * ppm && gap <= 45 * ppm) &&
    Math.abs(gaps[0] - gaps[1]) <= 8 * ppm;
}

function mergePair(a: Chain, b: Chain): Chain {
  const aa = a.axis!, bb = b.axis!;
  const sameDirection = aa.dx * bb.dx + aa.dy * bb.dy > 0;
  const midpoint = (p: Point, q: Point) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const start = midpoint(aa.a, sameDirection ? bb.a : bb.b);
  const end = midpoint(aa.b, sameDirection ? bb.b : bb.a);
  const axis = axisBetween(start, end)!;
  return { group: a.group, sources: new Set([...a.sources, ...b.sources]),
    vertices: [...a.vertices, ...b.vertices], points: [start, end], axis, geometry: "paired-carriageways" };
}

function intersection(a: Axis, b: Axis): Point | null {
  const determinant = a.dx * b.dy - a.dy * b.dx;
  if (Math.abs(determinant) < 0.15) return null;
  const delta = subtract(b.a, a.a);
  const t = (delta.x * b.dy - delta.y * b.dx) / determinant;
  return { x: a.a.x + t * a.dx, y: a.a.y + t * a.dy };
}
