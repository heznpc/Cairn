import { describe, expect, it } from "vitest";
import { destinationBlock } from "./block-context.js";
import { prepareImageBrief } from "./image-brief.js";
import { createDiagramDocument, applyDiagramDocumentPatch } from "./diagram-document.js";
import { yeoksamMap } from "../test/fixtures/yeoksam-map.js";
import { editorialFrame } from "./design-contract.js";
import type { Road } from "./types.js";

const square = (): Road[] => {
  const corners = [
    { id: "a", lat: -.001, lon: -.001 }, { id: "b", lat: -.001, lon: .001 },
    { id: "c", lat: .001, lon: .001 }, { id: "d", lat: .001, lon: -.001 },
  ];
  return corners.map((a, i) => ({ id: String(i), name: `Street ${i}`, class: "residential",
    nodes: [a, corners[(i + 1) % 4]], points: [a, corners[(i + 1) % 4]].map(({ lat, lon }) => ({ lat, lon })) }));
};

describe("destination block context", () => {
  it("retains the actual four enclosing Yeoksam streets and their whole boundary in the viewport", () => {
    const document = createDiagramDocument(yeoksamMap);
    const brief = prepareImageBrief(document, "editorial");
    const block = brief.facts.destinationBlock!;
    expect(block.fullyVisible).toBe(true);
    expect(block.sourceRoadIds).toEqual(["210332890", "210332891", "218864491", "919983794"]);
    expect(block.sourceRoadIds.every((id) => brief.facts.roads.some((road) => road.sourceId === id))).toBe(true);
    expect(brief.facts.displayRoads.some((road) => road.label === "논현로85길")).toBe(true);
    const frame = editorialFrame(brief.canvas);
    block.outline.forEach((p) => {
      expect(p.x * brief.canvas.width).toBeGreaterThan(frame.x);
      expect(p.x * brief.canvas.width).toBeLessThan(frame.x + frame.width);
      expect(p.y * brief.canvas.height).toBeGreaterThan(frame.y);
      expect(p.y * brief.canvas.height).toBeLessThan(frame.y + frame.height);
    });
    expect(document.map).toEqual(yeoksamMap);
  });

  it("protects a low-ranked boundary road even when higher-ranked streets fill the style budget", () => {
    const roads = square();
    const extras: Road[] = Array.from({ length: 8 }, (_, i) => ({ id: `arterial-${i}`, name: `Arterial ${i}`, class: "primary",
      points: [{ lat: .0015 + i * .00001, lon: -.002 }, { lat: .0015 + i * .00001, lon: .002 }] }));
    const document = createDiagramDocument({ center: { lat: 0, lon: 0, label: "Venue" }, landmarks: [], roads: [...roads, ...extras],
      bbox: { north: .002, south: -.002, east: .002, west: -.002 } });
    const brief = prepareImageBrief(document, "editorial");
    expect(brief.facts.destinationBlock?.sourceRoadIds).toEqual(["0", "1", "2", "3"]);
    expect(roads.every((r) => brief.facts.roads.some((selected) => selected.sourceId === r.id))).toBe(true);
  });

  it("does not close a gap using matching coordinates or restore an explicitly hidden boundary", () => {
    const roads = square();
    roads[3].nodes = roads[3].nodes!.map((n) => ({ ...n, id: `other-${n.id}` }));
    expect(destinationBlock(roads, { lat: 0, lon: 0 })).toBeUndefined();
    const hidden = applyDiagramDocumentPatch(createDiagramDocument(yeoksamMap), { roads: { "210332890": { hidden: true } } });
    const brief = prepareImageBrief(hidden, "editorial");
    expect(brief.facts.destinationBlock).toBeUndefined();
    expect(brief.facts.roads.some((r) => r.sourceId === "210332890")).toBe(false);
    expect(brief.warnings.join(" ")).toContain("block readability is unverified");
  });

  it("ignores an internal dead end and never claims enclosure outside the road cycle", () => {
    const roads = square();
    const spur: Road = { id: "spur", class: "residential", nodes: [roads[0].nodes![0], { id: "end", lat: -.0005, lon: -.0005 }], points: [] };
    expect(destinationBlock([...roads, spur], { lat: 0, lon: 0 })?.sourceRoadIds).toEqual(["0", "1", "2", "3"]);
    expect(destinationBlock(roads, { lat: .002, lon: 0 })).toBeUndefined();
    expect(destinationBlock(roads, { lat: -.001, lon: 0 })).toBeUndefined();
  });

  it.each(["missing nodes", "service", "bridge", "layer"])("does not infer a street block through %s", (mode) => {
    const roads = square();
    if (mode === "missing nodes") delete roads[0].nodes;
    else roads[0].tags = mode === "service" ? { highway: "service" } : mode === "bridge" ? { bridge: "yes" } : { layer: "1" };
    expect(destinationBlock(roads, { lat: 0, lon: 0 })).toBeUndefined();
  });
});
