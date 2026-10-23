import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assessMapDesign } from "./design-review.js";
import { prepareImageBrief } from "./image-brief.js";
import { createDiagramDocument } from "./diagram-document.js";
import { yeoksamMap } from "../test/fixtures/yeoksam-map.js";

const rejected = JSON.parse(readFileSync(new URL("../test/fixtures/rejected-editorial.json", import.meta.url), "utf8"));
const rejectedSvg = readFileSync(new URL("../test/fixtures/rejected-editorial.svg", import.meta.url), "utf8");

describe("design rejection checks", () => {
  it("rejects the actual previous submission despite its valid road geometry", () => {
    const review = assessMapDesign(rejectedSvg, rejected.canvas, rejected.facts);
    expect(review.status).toBe("blocked");
    const codes = review.issues.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(["small-type", "weak-hierarchy", "small-street-type", "small-focus-block", "label-crosses-road"]));
    expect(review.issues.find((i) => i.code === "label-crosses-road")?.target).toBe("L4");
  });

  it("leaves actual-size visual judgment pending after the revised geometry and type checks pass", () => {
    const brief = prepareImageBrief(createDiagramDocument(yeoksamMap), "editorial");
    expect(brief.designReview?.issues).toEqual([]);
    expect(brief.designReview?.status).toBe("needs-visual-review");
    expect(brief.designReview?.visualReview.status).toBe("pending");
    expect(brief.designReview?.metrics.destinationTextPx).toBeGreaterThan(brief.designReview!.metrics.secondaryTextPx);
    const hospital = brief.facts.landmarks.find((p) => p.category === "hospital")!;
    expect(brief.mapSvg).not.toContain(`id="leader-landmark-${hospital.sourceId}"`);
  });

  it("does not accept missing destination text as uncluttered design", () => {
    const svg = rejectedSvg.replace(/<text id="label-destination"[\s\S]*?<\/text>/, "");
    expect(assessMapDesign(svg, rejected.canvas, rejected.facts).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "missing-label", target: "D" }),
    ]));
  });

  it("rejects omission of essential street names rather than passing an empty type check", () => {
    const svg = rejectedSvg.replace(/<text id="road-label-[\s\S]*?<\/text>/g, "");
    expect(assessMapDesign(svg, rejected.canvas, rejected.facts).issues.some((i) => i.code === "missing-street-name")).toBe(true);
  });

  it("reports unresolved block context instead of manufacturing an enclosure", () => {
    const { destinationBlock, ...facts } = rejected.facts;
    expect(assessMapDesign(rejectedSvg, rejected.canvas, facts).issues.some((i) => i.code === "unresolved-block")).toBe(true);
  });
});
