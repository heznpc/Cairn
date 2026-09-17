import { describe, expect, it } from "vitest";
import { createDiagramDocument, applyDiagramDocumentPatch } from "../diagram-document.js";
import { prepareImageBrief } from "../image-brief.js";
import { yeoksamMap } from "../../test/fixtures/yeoksam-map.js";
import { IMAGE_STYLES } from "../image-styles.js";
import { overlapArea } from "./text.js";
import { clipSegment } from "./road-geometry.js";
import { EDITORIAL_DESIGN, editorialFrame } from "../design-contract.js";

describe("editable pictorial map", () => {
  it("keeps editorial labels inside the map and off street bands while preserving source coordinates", () => {
    const document = createDiagramDocument(yeoksamMap);
    const brief = prepareImageBrief(document, "editorial");
    expect(brief.designContract?.status).toBe("prototype-unvalidated");
    expect(brief.facts.destination).toMatchObject({ lat: yeoksamMap.center.lat, lon: yeoksamMap.center.lon });
    expect(brief.facts.landmarks.map((p) => p.sourceId)).toHaveLength(4);
    const frame = editorialFrame(brief.canvas);
    for (const match of brief.mapSvg.matchAll(/data-label-box="([^"]+)"/g)) {
      const [x, y, width, height] = match[1].split(" ").map(Number);
      expect(x).toBeGreaterThanOrEqual(frame.x);
      expect(y).toBeGreaterThanOrEqual(frame.y);
      expect(x + width).toBeLessThanOrEqual(frame.x + frame.width);
      expect(y + height).toBeLessThanOrEqual(frame.y + frame.height);
      for (const road of brief.facts.displayRoads) {
        const half = EDITORIAL_DESIGN.tokens.roads[road.class] / 2;
        road.points.slice(1).forEach((b, i) => {
          const a = road.points[i];
          expect(clipSegment(a.x * brief.canvas.width, a.y * brief.canvas.height,
            b.x * brief.canvas.width, b.y * brief.canvas.height,
            x - half, y - half, x + width + half, y + height + half)).toBeNull();
        });
      }
    }
    expect(brief.mapSvg).not.toMatch(/<image\b|marker-end/);
    expect(brief.mapSvg).toContain('>강남파이낸스센터</tspan>');
  });
  it.each(IMAGE_STYLES)("keeps Yeoksam place labels apart and blueprint paths intact in %s", (style) => {
    const { mapSvg, referenceSvg } = prepareImageBrief(createDiagramDocument(yeoksamMap), style);
    const boxes = [...mapSvg.matchAll(/data-label-box="([^"]+)"/g)].map((match) => {
      const [x, y, width, height] = match[1].split(" ").map(Number);
      return { x, y, width, height };
    });
    expect(boxes.length).toBeGreaterThan(4);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      expect(overlapArea(boxes[i], boxes[j]), `labels ${i} and ${j}`).toBe(0);
    }
    expect(mapSvg.match(/<path data-display-road="[^"]+"[^>]+>/g))
      .toEqual(referenceSvg.match(/<path data-display-road="[^"]+"[^>]+>/g));
  });

  it("exports separate vector roads, place groups, icons and live text without embedded raster content", () => {
    const { mapSvg } = prepareImageBrief(createDiagramDocument(yeoksamMap), "pictorial");
    expect(mapSvg).not.toMatch(/<image\b|<foreignObject\b|data:image/);
    for (const id of ["roads", "road-labels", "places", "place-destination", "icon-destination", "label-destination"]) {
      expect(mapSvg).toContain(`id="${id}"`);
    }
    const ids = [...mapSvg.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(mapSvg).toMatch(/<text id="label-destination"/);
    for (const kind of ["station", "station_exit", "building", "hospital", "cinema", "park"]) {
      expect(mapSvg).toContain(`data-pictogram="${kind}"`);
    }
  });

  it("keeps a renamed cinema's category, vector identity and road paths when regenerating the document", () => {
    const document = createDiagramDocument(yeoksamMap);
    const before = prepareImageBrief(document, "pictorial");
    const updated = applyDiagramDocumentPatch(document, { landmarks: { "368634331": { label: "영화관" } } });
    const after = prepareImageBrief(updated, "pictorial");
    expect(after.mapSvg).toContain('<g id="place-landmark-368634331"');
    expect(after.mapSvg).toContain('<title>영화관</title>');
    expect(after.facts.landmarks.find((p) => p.sourceId === "368634331")?.pictogram).toBe("cinema");
    expect(after.mapSvg.match(/<path data-display-road="[^"]+"[^>]+>/g))
      .toEqual(before.mapSvg.match(/<path data-display-road="[^"]+"[^>]+>/g));
    expect(document.map.landmarks.find((p) => p.id === "368634331")?.name).toBe("메가박스");
  });
});
