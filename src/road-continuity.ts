import type { NormalizedPosition, Road } from "./types.js";

type GeoPoint = { lat: number; lon: number };
type Arm = { roadKey: string; point: GeoPoint };

/** Describe observed geometry at shared nodes; never snap nodes or merge nearby junctions. */
export function roadContinuities(
  roads: Road[],
  anchor: (lat: number, lon: number) => NormalizedPosition,
) {
  const junctions = new Map<string, { point: GeoPoint; roads: Set<string>; arms: Map<string, Arm[]> }>();
  roads.forEach((road, index) => {
    if (!road.name || !road.nodes) return;
    road.nodes.forEach((node, nodeIndex) => {
      const junction = junctions.get(node.id) ?? { point: node, roads: new Set<string>(), arms: new Map<string, Arm[]>() };
      junction.roads.add(road.id);
      const arms = junction.arms.get(road.name!) ?? [];
      for (const step of [-1, 1]) {
        const point = sampleArm(road.nodes!, nodeIndex, step);
        if (point) arms.push({ roadKey: `R${index + 1}`, point });
      }
      junction.arms.set(road.name!, arms);
      junctions.set(node.id, junction);
    });
  });
  return [...junctions].flatMap(([sourceNodeId, junction]) => {
    if (junction.roads.size < 2) return [];
    return [...junction.arms].flatMap(([roadLabel, arms]) => {
      // A named road that branches at this node has no unambiguous through pair.
      if (arms.length !== 2) return [];
      const vectors = arms.map(({ point }) => localVector(junction.point, point));
      const cosine = (vectors[0].x * vectors[1].x + vectors[0].y * vectors[1].y) /
        (Math.hypot(vectors[0].x, vectors[0].y) * Math.hypot(vectors[1].x, vectors[1].y));
      const bendDegrees = 180 - Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
      return [{ sourceNodeId, roadLabel, anchor: anchor(junction.point.lat, junction.point.lon),
        arms: arms.map(({ roadKey, point }) => ({ roadKey, anchor: anchor(point.lat, point.lon) })),
        bendDegrees: Number(bendDegrees.toFixed(2)),
        alignment: bendDegrees <= 8 ? "near-straight" as const : "bent" as const }];
    });
  });
}

function localVector(a: GeoPoint, b: GeoPoint) {
  return { x: (b.lon - a.lon) * Math.cos(a.lat * Math.PI / 180) * 111_320,
    y: (b.lat - a.lat) * 111_320 };
}

/** Sample up to 30 m along the original way, so dense nodes do not dominate the angle. */
function sampleArm(points: GeoPoint[], start: number, step: number): GeoPoint | null {
  let remaining = 30;
  let previous = points[start];
  let sample: GeoPoint | null = null;
  for (let i = start + step; i >= 0 && i < points.length; i += step) {
    const point = points[i];
    const delta = localVector(previous, point);
    const length = Math.hypot(delta.x, delta.y);
    if (length < 0.01) continue;
    if (length >= remaining) {
      const t = remaining / length;
      sample = { lat: previous.lat + (point.lat - previous.lat) * t,
        lon: previous.lon + (point.lon - previous.lon) * t };
      break;
    }
    remaining -= length;
    sample = point;
    previous = point;
  }
  if (!sample) return null;
  const delta = localVector(points[start], sample);
  return Math.hypot(delta.x, delta.y) >= 1 ? sample : null;
}
