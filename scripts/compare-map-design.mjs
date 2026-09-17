#!/usr/bin/env node
// Reproducible visual comparison from one document; no image model or network.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { prepareImageBrief } from "../dist/image-brief.js";
import { encodeMapArtifact } from "../dist/export.js";

const [input, directory = "tmp/design-comparison"] = process.argv.slice(2);
if (!input) throw new Error("Usage: node scripts/compare-map-design.mjs document.json [output-directory]");
const document = JSON.parse(readFileSync(input, "utf8"));
const output = resolve(directory);
mkdirSync(output, { recursive: true });
writeFileSync(`${output}/document.json`, `${JSON.stringify(document, null, 2)}\n`);
const images = ["pictorial", "editorial"].map((style) => {
  const brief = prepareImageBrief(document, style);
  const png = encodeMapArtifact(brief.mapSvg, brief.canvas, "png");
  writeFileSync(`${output}/${style}.svg`, brief.mapSvg);
  writeFileSync(`${output}/${style}.png`, png);
  writeFileSync(`${output}/${style}.json`, `${JSON.stringify(brief, null, 2)}\n`);
  if (style === "editorial") {
    writeFileSync(`${output}/blueprint.png`, encodeMapArtifact(brief.referenceSvg, brief.canvas, "png"));
    writeFileSync(`${output}/delivery-600.png`, encodeMapArtifact(brief.mapSvg, { width: 600, height: 600 * brief.canvas.height / brief.canvas.width }, "png"));
    writeFileSync(`${output}/review.json`, `${JSON.stringify({
      contractId: brief.designContract.id, status: "needs-visual-review",
      comparison: "comparison.png", deliverySize: "delivery-600.png", source: "document.json",
      criteria: brief.designContract.criteria.map((criterion) => ({ ...criterion, status: "pending", observation: "" })),
      audiencePreference: "unvalidated",
    }, null, 2)}\n`);
  }
  return { png, canvas: brief.canvas };
});
const width = 1600, tileWidth = 752;
const tileHeight = Math.max(...images.map(({ canvas }) => tileWidth * canvas.height / canvas.width));
const height = Math.ceil(tileHeight + 110);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="100%" height="100%" fill="#f4f4f2"/>
${images.map(({ png, canvas }, i) => `<g transform="translate(${32 + i * 784} 0)">
<text x="0" y="40" font-family="'Apple SD Gothic Neo',sans-serif" font-size="21" font-weight="700" fill="#343633">${i ? "새 디자인 기준 적용 · editorial" : "기존 · pictorial"}</text>
<image x="0" y="65" width="${tileWidth}" height="${tileWidth * canvas.height / canvas.width}" href="data:image/png;base64,${png.toString("base64")}"/></g>`).join("")}</svg>`;
writeFileSync(`${output}/comparison.png`, encodeMapArtifact(svg, { width, height }, "png"));
console.log(output);
