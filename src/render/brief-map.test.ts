import { describe, expect, it } from "vitest";
import { createDiagramDocument, applyDiagramDocumentPatch } from "../diagram-document.js";
import { prepareImageBrief } from "../image-brief.js";
import { yeoksamMap } from "../../test/fixtures/yeoksam-map.js";

describe("editable pictorial map", () => {
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
