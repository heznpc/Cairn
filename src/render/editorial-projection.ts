import type { MapLayout, Road } from "../types.js";
import type { Box } from "./text.js";

/** One rigid rotation and one uniform scale. No individual street or POI moves. */
export function editorialProjection(map: MapLayout, roads: Road[], selected: Array<{ lat: number; lon: number }>, frame: Box) {
  const cosLat = Math.cos(map.center.lat * Math.PI / 180);
  const local = (lat: number, lon: number): [number, number] => [
    (lon - map.center.lon) * cosLat * 111_320, -(lat - map.center.lat) * 111_320,
  ];
  let closest = Infinity, rotation = 0;
  for (const road of roads.filter((r) => r.class === "primary")) {
    const points = road.nodes?.length ? road.nodes : road.points;
    for (let i = 1; i < points.length; i++) {
      const [x, y] = local(points[i - 1].lat, points[i - 1].lon);
      const [bx, by] = local(points[i].lat, points[i].lon);
      const dx = bx - x, dy = by - y, length = Math.hypot(dx, dy);
      if (length < 20) continue;
      const t = Math.max(0, Math.min(1, -(x * dx + y * dy) / (length * length)));
      const distance = Math.hypot(x + t * dx, y + t * dy);
      let angle = Math.atan2(dy, dx);
      if (angle > Math.PI / 2) angle -= Math.PI;
      if (angle < -Math.PI / 2) angle += Math.PI;
      if (distance < closest) { closest = distance; rotation = Math.abs(angle) <= Math.PI / 6 ? -angle : 0; }
    }
  }
  const rotated = (lat: number, lon: number): [number, number] => {
    const [x, y] = local(lat, lon);
    return [x * Math.cos(rotation) - y * Math.sin(rotation), x * Math.sin(rotation) + y * Math.cos(rotation)];
  };
  const points = selected.map((p) => rotated(p.lat, p.lon));
  const minX = Math.min(...points.map((p) => p[0])), maxX = Math.max(...points.map((p) => p[0]));
  const minY = Math.min(...points.map((p) => p[1])), maxY = Math.max(...points.map((p) => p[1]));
  // Pixel room for symbols and labels; geographic padding unnecessarily shrank
  // the entire useful block when the source selection was already compact.
  const padding = 76;
  const scale = Math.min((frame.width - padding * 2) / Math.max(80, maxX - minX), (frame.height - padding * 2) / Math.max(80, maxY - minY));
  return {
    rotationDegrees: rotation * 180 / Math.PI,
    project: (lat: number, lon: number): [number, number] => {
      const [x, y] = rotated(lat, lon);
      return [frame.x + frame.width / 2 + (x - (minX + maxX) / 2) * scale,
        frame.y + frame.height / 2 + (y - (minY + maxY) / 2) * scale];
    },
  };
}
