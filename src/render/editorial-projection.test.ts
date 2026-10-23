import { describe, expect, it } from "vitest";
import { editorialProjection } from "./editorial-projection.js";
import { prepareImageBrief } from "../image-brief.js";
import { createDiagramDocument } from "../diagram-document.js";
import { yeoksamMap } from "../../test/fixtures/yeoksam-map.js";
import { editorialFrame } from "../design-contract.js";

describe("editorial composition projection", () => {
  it("uses one rotation and scale for the whole scene, preserving real bends and relative distances", () => {
    const selected = [yeoksamMap.center, ...yeoksamMap.landmarks];
    const projection = editorialProjection(yeoksamMap, yeoksamMap.roads, selected, editorialFrame({ width: 1200, height: 800 }));
    const cosLat = Math.cos(yeoksamMap.center.lat * Math.PI / 180);
    const scaleRatios: number[] = [];
    for (let i = 1; i < selected.length; i++) {
      const a = selected[i - 1], b = selected[i];
      const pa = projection.project(a.lat, a.lon), pb = projection.project(b.lat, b.lon);
      const distance = Math.hypot((b.lon - a.lon) * cosLat, b.lat - a.lat);
      scaleRatios.push(Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) / distance);
    }
    for (const ratio of scaleRatios) expect(ratio / scaleRatios[0]).toBeCloseTo(1, 7);
    const bend = yeoksamMap.roads.find((r) => r.id === "210332890")!.nodes!;
    const [a,b,c] = [bend[0], bend[2], bend[3]].map((p) => projection.project(p.lat,p.lon));
    expect(Math.abs((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]))).toBeGreaterThan(10);
  });

  it("declares the orientation and rotates north without altering source coordinates", () => {
    const brief = prepareImageBrief(createDiagramDocument(yeoksamMap), "editorial");
    expect(brief.facts.orientation.northUp).toBe(false);
    expect(brief.facts.orientation.rotationDegrees).toBeGreaterThan(15);
    expect(brief.mapSvg).toContain(`rotate(${brief.facts.orientation.rotationDegrees.toFixed(2)})`);
    expect(brief.facts.destination.lat).toBe(yeoksamMap.center.lat);
    expect(brief.facts.destination.lon).toBe(yeoksamMap.center.lon);
    expect(brief.sourceReferenceSvg).not.toContain("N ↑");
  });
});
