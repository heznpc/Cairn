import { describe, expect, it, vi } from "vitest";
import { buildingsFromElements, buildingContains, findBuildings } from "./buildings.js";
import { createDiagramDocument, applyDiagramDocumentPatch, applyDiagramOverrides } from "./diagram-document.js";
import { prepareImageBrief } from "./image-brief.js";
import { renderSVG } from "./render.js";
import { yeoksamMap } from "../test/fixtures/yeoksam-map.js";
import { projectBuildings } from "./render/footprints.js";
import { assessMapDesign } from "./design-review.js";
import { overpassFetch } from "./overpass.js";
vi.mock("./overpass.js", () => ({ overpassFetch: vi.fn(), OVERPASS_TIMEOUT_MS: 30000 }));
const pt = (lon: number, lat: number) => ({ lat, lon });
const outer = [pt(0,0),pt(.01,0),pt(.01,.01),pt(0,.01),pt(0,0)];
const hole = [pt(.003,.003),pt(.007,.003),pt(.007,.007),pt(.003,.007),pt(.003,.003)];
const way = (id: number, geometry = outer, tags = { building: "yes" }) => ({ type: "way", id, tags, geometry });

describe("source building footprints", () => {
  it("preserves exact outlines and typed IDs while rejecting open, degenerate and non-building geometry", () => {
    const parsed = buildingsFromElements([way(1), way(2, outer.slice(0,-1)), way(3,[pt(0,0),pt(1,0),pt(2,0),pt(0,0)]),way(4,outer,{building:"no"}), {type:"way",id:5,tags:{"building:part":"yes"},geometry:outer}]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ id: "way/1", polygons: [{ outer, holes: [] }] });
  });

  it("stitches exact relation endpoints, retains courtyard holes and suppresses member duplicates", () => {
    const relation = {type:"relation",id:9,tags:{type:"multipolygon",building:"yes"},members:[
      {type:"way",ref:1,role:"outer",geometry:outer.slice(0,3)},
      {type:"way",ref:2,role:"outer",geometry:[...outer.slice(2)].reverse()},
      {type:"way",ref:3,role:"inner",geometry:hole},
    ]};
    const parsed = buildingsFromElements([relation,way(1),way(3,hole)]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].polygons).toEqual([{outer,holes:[hole]}]);
    expect(buildingContains(parsed[0],pt(.001,.001))).toBe(true);
    expect(buildingContains(parsed[0],pt(.005,.005))).toBe(false);
    expect(buildingContains(parsed[0],pt(0,.005))).toBe(false);
  });

  it("does not fill an incomplete courtyard by falling back to its outer member", () => {
    expect(buildingsFromElements([way(1),{type:"relation",id:9,tags:{type:"multipolygon",building:"yes"},members:[
      {type:"way",ref:1,role:"outer",geometry:outer}, {type:"way",ref:2,role:"inner",geometry:hole.slice(0,-1)},
    ]}])).toEqual([]);
  });

  it("does not guess the destination building when outlines overlap", () => {
    const buildings=buildingsFromElements([way(1),way(2)]);
    const context=projectBuildings(buildings,pt(.001,.001),(lat,lon)=>[lon*10000,lat*10000],{width:200,height:200});
    expect(context.destinationMatch).toBe("ambiguous");
    expect(context.buildings.every(b=>!b.destination)).toBe(true);
  });

  it("fetches footprint geometry through the shared upstream and clamps radius", async () => {
    vi.mocked(overpassFetch).mockResolvedValue([way(1)]);
    expect(await findBuildings(37.5,127,9000)).toHaveLength(1);
    expect(vi.mocked(overpassFetch).mock.calls.at(-1)?.[0]).toContain("around:5000,37.5,127");
    expect(vi.mocked(overpassFetch).mock.calls.at(-1)?.[0]).toContain("out geom");
  });

  it("keeps real Yeoksam footprints through document edits and renders the destination among neighbors", () => {
    const doc=createDiagramDocument(yeoksamMap);
    const changed=applyDiagramDocumentPatch(doc,{destinationLabel:"방문처"});
    const applied=applyDiagramOverrides(changed.map,changed.overrides);
    expect(applied.buildings).toEqual(yeoksamMap.buildings);
    applied.buildings![0].polygons[0].outer[0].lat=0;
    expect(doc.map.buildings![0].polygons[0].outer[0].lat).not.toBe(0);
    const brief=prepareImageBrief(changed,"editorial");
    expect(brief.facts.buildingContext.destinationBuildingId).toBe("way/117823787");
    expect(brief.facts.buildingContext.visibleCount).toBeGreaterThan(10);
    expect(brief.mapSvg.match(/data-building-footprint=/g)).toHaveLength(brief.facts.buildingContext.visibleCount);
    expect(brief.mapSvg.match(/data-destination-building="true"/g)).toHaveLength(1);
    expect(brief.mapSvg).toContain('fill-rule="evenodd"');
    expect(brief.designReview?.issues).toEqual([]);
    expect(renderSVG(yeoksamMap,{layout:"geographic"})).toContain('data-building-footprint="way/117823787"');
  });

  it("reports missing urban context instead of presenting a road-only draft as complete", () => {
    const doc=createDiagramDocument(yeoksamMap);delete doc.map.buildings;
    const brief=prepareImageBrief(doc,"editorial");
    expect(brief.designReview?.issues.some(i=>i.code==="building-context-unavailable")).toBe(true);
    expect(brief.warnings.join(" ")).toContain("unknown, not open ground");
  });

  it("does not treat an empty successful fetch as evidence of empty land", () => {
    const doc=createDiagramDocument(yeoksamMap);
    doc.map.buildings=[];
    doc.map.buildingContext={source:"OpenStreetMap",status:"fetched",radiusMeters:500};
    const brief=prepareImageBrief(doc,"editorial");
    expect(brief.designReview?.issues.some(i=>i.code==="building-context-unavailable")).toBe(true);
    expect(brief.warnings.join(" ")).not.toContain("The highlighted footprint");
  });

  it("rejects text that erases a destination footprint boundary", () => {
    const brief=prepareImageBrief(createDiagramDocument(yeoksamMap),"editorial");
    const point=brief.facts.buildingContext.buildings.find(b=>b.destination)!.polygons[0].outer[0];
    const x=point.x*brief.canvas.width, y=point.y*brief.canvas.height;
    const obscured=brief.mapSvg.replace(/data-place-label="D" data-label-box="[^"]+"/,
      `data-place-label="D" data-label-box="${x-10} ${y-10} 100 40"`);
    expect(assessMapDesign(obscured,brief.canvas,brief.facts).issues.some(i=>i.code==="label-on-building-boundary")).toBe(true);
  });
});
