import { describe, expect, it } from "vitest";
import { roadContinuities } from "./road-continuity.js";
import { prepareImageBrief } from "./image-brief.js";
import { createDiagramDocument } from "./diagram-document.js";
import type { Road } from "./types.js";
import yeoksam from "../test/fixtures/yeoksam-intersection.json" with { type: "json" };

const anchor = (lat: number, lon: number) => ({ x: lon, y: lat });
function road(id: string, name: string, points: Array<[string, number, number]>): Road {
  const nodes = points.map(([id, x, y]) => ({ id, lat: 37.5 + y / 111_320,
    lon: 127 + x / (111_320 * Math.cos(37.5 * Math.PI / 180)) }));
  return { id, name, class: "primary", nodes, points: nodes.map(({ lat, lon }) => ({ lat, lon })) };
}

describe("source road continuity", () => {
  it("recognizes the actual Yeoksam approaches as aligned at both carriageway crossings", () => {
    const roads = yeoksam.roads as Road[];
    const before = structuredClone(roads);
    const continuities = prepareImageBrief(createDiagramDocument({ roads, landmarks: [],
      center: { lat: 37.5008, lon: 127.03695, label: "역삼역" },
      bbox: { south: 37.5005, north: 37.5012, west: 127.0365, east: 127.0373 },
    }), "pictorial").facts.roadContinuities;
    expect(continuities).toHaveLength(4);
    expect(new Set(continuities.map((item) => item.sourceNodeId))).toEqual(new Set(["2280678728", "2280678732"]));
    for (const name of ["테헤란로", "논현로"]) {
      const items = continuities.filter((item) => item.roadLabel === name);
      expect(items).toHaveLength(2);
      expect(items.every((item) => item.alignment === "near-straight" && item.bendDegrees < 4)).toBe(true);
    }
    expect(roads).toEqual(before);
  });

  it("measures a straight continuation independently of way direction and node density", () => {
    const roads = [road("west", "Main", [["w", -50, 0], ["close", -1, 0], ["j", 0, 0]]),
      road("east", "Main", [["e", 50, 0], ["j", 0, 0]])];
    const [result] = roadContinuities(roads, anchor);
    expect(result).toMatchObject({ alignment: "near-straight", bendDegrees: 0, sourceNodeId: "j" });
    expect(result.arms.map((arm) => arm.roadKey)).toEqual(["R1", "R2"]);
    const sampleX = (result.arms[0].anchor.x - 127) * 111_320 * Math.cos(37.5 * Math.PI / 180);
    expect(sampleX).toBeCloseTo(-30);
  });

  it("preserves a real bend instead of treating the same street name as a straight-line rule", () => {
    const [result] = roadContinuities([
      road("a", "Main", [["w", -50, 0], ["j", 0, 0]]),
      road("b", "Main", [["j", 0, 0], ["n", 0, 50]]),
    ], anchor);
    expect(result).toMatchObject({ alignment: "bent", bendDegrees: 90 });
  });

  it("keeps the two bends and distinct nodes of a staggered junction", () => {
    const results = roadContinuities([
      road("a", "Main", [["w", -60, 0], ["j1", 0, 0]]),
      road("jog", "Main", [["j1", 0, 0], ["j2", 0, 25]]),
      road("b", "Main", [["j2", 0, 25], ["e", 60, 25]]),
    ], anchor);
    expect(results.map(({ sourceNodeId, alignment }) => ({ sourceNodeId, alignment }))).toEqual([
      { sourceNodeId: "j1", alignment: "bent" }, { sourceNodeId: "j2", alignment: "bent" },
    ]);
    expect(results[0].anchor).not.toEqual(results[1].anchor);
  });

  it("does not infer continuity from coincident coordinates or missing node identities", () => {
    const a = road("a", "Main", [["w", -50, 0], ["j1", 0, 0]]);
    const b = road("b", "Main", [["j2", 0, 0], ["e", 50, 0]]);
    expect(roadContinuities([a, b], anchor)).toEqual([]);
    delete b.nodes;
    expect(roadContinuities([a, b], anchor)).toEqual([]);
  });

  it("does not guess a through pair at an ambiguous three-way branch", () => {
    expect(roadContinuities([
      road("a", "Main", [["w", -50, 0], ["j", 0, 0]]),
      road("b", "Main", [["j", 0, 0], ["e", 50, 0]]),
      road("c", "Main", [["j", 0, 0], ["n", 0, 50]]),
    ], anchor)).toEqual([]);
  });
});
