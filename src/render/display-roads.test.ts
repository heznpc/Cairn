import { describe, expect, it } from "vitest";
import { Resvg } from "@resvg/resvg-js";
import { buildDisplayRoads } from "./display-roads.js";
import { prepareImageBrief } from "../image-brief.js";
import { createDiagramDocument } from "../diagram-document.js";
import { yeoksamMap } from "../../test/fixtures/yeoksam-map.js";
import type { Road } from "../types.js";

const canvas = { width: 1200, height: 800 };
const project = (lat: number, lon: number): [number, number] => [lon, lat];
function road(id: string, nodes: Array<[string, number, number]>, tags: Record<string, string> = {}, name = "Main"): Road {
  return { id, name, class: "primary", tags,
    nodes: nodes.map(([id, x, y]) => ({ id, lon: x, lat: y })),
    points: nodes.map(([, lon, lat]) => ({ lon, lat })) };
}

describe("rendered road geometry", () => {
  it("renders the four actual Teheran-ro ways as one continuous straight path in both blueprint and final map", () => {
    const doc = createDiagramDocument(yeoksamMap);
    const original = structuredClone(doc);
    const brief = prepareImageBrief(doc, "pictorial");
    const teheran = brief.facts.displayRoads.filter((road) => road.label === "테헤란로");
    expect(teheran).toHaveLength(1);
    expect(teheran[0].geometry).toBe("paired-carriageways");
    expect(teheran[0].sourceIds.sort()).toEqual(["218864491", "375049565", "919983793", "919983795"]);
    expect(teheran[0].points).toHaveLength(2);
    expect(brief.facts.displayRoads.filter((road) => road.label === "논현로")).toHaveLength(1);
    const tag = (svg: string) => svg.match(new RegExp(`<path data-display-road="${teheran[0].key}"[^>]+>`))![0];
    expect(tag(brief.mapSvg)).toBe(tag(brief.referenceSvg));
    expect(tag(brief.mapSvg).match(/ L/g)).toHaveLength(1);
    expect(brief.facts.roads.filter((road) => road.label === "테헤란로")).toHaveLength(4);
    expect(doc).toEqual(original);

    // The PNG itself must carry the straight band on both sides of the junction.
    const image = new Resvg(brief.mapSvg, { font: { loadSystemFonts: true } }).render();
    const [a, b] = teheran[0].points.map((p) => ({ x: p.x * brief.canvas.width, y: p.y * brief.canvas.height }));
    for (const t of [0.08, 0.15, 0.35, 0.72, 0.87, 0.94]) {
      const x = Math.round(a.x + (b.x - a.x) * t), y = Math.round(a.y + (b.y - a.y) * t);
      const offset = (y * image.width + x) * 4;
      expect([...image.pixels.subarray(offset, offset + 3)]).toEqual([173, 179, 184]);
    }
  });

  it("reattaches a side street to the merged centerline at its source junction", () => {
    const brief = prepareImageBrief(createDiagramDocument(yeoksamMap), "pictorial");
    const main = brief.facts.displayRoads.find((r) => r.label === "테헤란로")!;
    const side = brief.facts.displayRoads.find((r) => r.label === "테헤란로26길")!;
    const [a, b] = main.points;
    const distance = (p: {x: number; y: number}) => Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x));
    expect(Math.min(...side.points.map(distance))).toBeLessThan(1e-10);
  });

  it("keeps a genuine staggered street's jog and two distinct junction positions", () => {
    const roads = [road("w", [["w", 100, 300], ["j1", 500, 300]]),
      road("jog", [["j1", 500, 300], ["j2", 500, 340]]),
      road("e", [["j2", 500, 340], ["e", 1100, 340]])];
    const result = buildDisplayRoads(roads, project, canvas, 1);
    expect(result.roads).toHaveLength(1);
    expect(result.roads[0].geometry).toBe("source");
    expect(result.roads[0].points).toHaveLength(4);
    expect(result.nodes.find((n) => n.sourceId === "j1")!.anchor)
      .not.toEqual(result.nodes.find((n) => n.sourceId === "j2")!.anchor);
  });

  it.each(["two-way", "same direction", "different layer", "little overlap", "curved", "missing nodes", "crossing axes"])(
    "does not collapse unrelated parallel roads: %s", (scenario) => {
      const a = road("a", [["a1", 100, 300], ["a2", 1100, 300]], { oneway: "yes" });
      const b = road("b", [["b1", 1100, 325], ["b2", 100, 325]], { oneway: "yes" });
      if (scenario === "two-way") b.tags = {};
      if (scenario === "same direction") b.nodes!.reverse();
      if (scenario === "different layer") b.tags!.layer = "1";
      if (scenario === "little overlap") b.nodes![1].lon = 1000;
      if (scenario === "curved") b.nodes!.splice(1, 0, {id: "bend", lat: 365, lon: 600});
      if (scenario === "missing nodes") delete b.nodes;
      if (scenario === "crossing axes") b.nodes![1].lat = 275;
      expect(buildDisplayRoads([a, b], project, canvas, 1).roads).toHaveLength(2);
    },
  );

  it("does not move geometric crossings without shared nodes", () => {
    const a = road("a", [["a1", 100, 300], ["a2", 1100, 300]]);
    const b = road("b", [["b1", 500, 100], ["b2", 500, 700]], {}, "Other");
    const result = buildDisplayRoads([a, b], project, canvas, 1);
    expect(result.nodes).toHaveLength(4);
    expect(result.nodes.every((n) => n.anchor.x !== 500 / 1200 || n.anchor.y !== 300 / 800)).toBe(true);
  });

  it("preserves a roundabout and does not chord across separate canvas visits", () => {
    const loop = road("loop", [["a", 400, 300], ["b", 600, 300], ["c", 600, 500], ["d", 400, 500], ["a", 400, 300]]);
    expect(buildDisplayRoads([loop], project, canvas, 1).roads[0].geometry).toBe("source");
    const exits = road("exits", [["a", 100, 300], ["b", 1400, 300], ["c", 1400, 500], ["d", 100, 500]]);
    expect(buildDisplayRoads([exits], project, canvas, 1).roads[0].geometry).toBe("source");
  });

  it("preserves divided carriageways in the geographic neighborhood style", () => {
    const result = prepareImageBrief(createDiagramDocument(yeoksamMap), "neighborhood");
    expect(result.facts.displayRoads.filter((r) => r.label === "테헤란로")).toHaveLength(2);
    expect(result.facts.displayRoads.every((r) => r.geometry === "source")).toBe(true);
  });
});
