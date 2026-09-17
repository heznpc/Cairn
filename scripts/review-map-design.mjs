#!/usr/bin/env node
// Validate evidence for this exact render; never manufacture a visual verdict.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
import { prepareImageBrief } from "../dist/image-brief.js";
import { encodeMapArtifact } from "../dist/export.js";

const [input] = process.argv.slice(2);
if (!input) throw new Error("Usage: node scripts/review-map-design.mjs review.json");
const directory = dirname(resolve(input));
const review = JSON.parse(readFileSync(input, "utf8"));
const document = JSON.parse(readFileSync(resolve(directory, review.source), "utf8"));
const brief = prepareImageBrief(document, "editorial");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const actual = hash(readFileSync(resolve(directory, review.artifact.file)));
const current = hash(encodeMapArtifact(brief.mapSvg, brief.canvas, "png"));
const failures = [];
if (actual !== review.artifact.sha256 || actual !== current) failures.push("Artifact or renderer changed; inspect the new pixels and renew the review.");
if (review.contractId !== brief.designContract.id) failures.push("Review uses a different design contract.");
failures.push(...brief.designReview.issues.map((issue) => `${issue.code}: ${issue.message}`));
for (const criterion of brief.designContract.criteria) {
  const entries = review.criteria.filter((entry) => entry.id === criterion.id);
  const entry = entries[0];
  if (entries.length !== 1 || entry.status !== "pass" || !entry.observation?.trim() || !entry.visibleEvidence?.trim()) {
    failures.push(`${criterion.id}: requires a passing visual finding with concrete visible evidence.`);
  }
}
if (failures.length) {
  console.error(`Design review rejected:\n${failures.map((f) => `- ${f}`).join("\n")}`);
  process.exitCode = 1;
} else {
  console.log("Review record complete for the exact rendered artifact. Visual judgments remain the reviewer's responsibility; this is not audience validation.");
}
