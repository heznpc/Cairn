---
name: create-wayfinding-map
description: Create and refine wayfinding maps with cairn using editable SVG diagrams, recorded visual design criteria and optional grounded host-generated images. Use for address-based yakdo, venue directions, style comparisons, or revisions to an existing map.
---

# Create Wayfinding Map

Use cairn for geographic evidence, reproducible image briefs and SVG rendering;
use the host model for intent, curation, image generation and visual critique.
Treat the `DiagramDocument` as the geographic source across edit turns. Generated
pixels never become new evidence for street connectivity or place positions.

## Choose the output path

Before changing visual direction, record the intended output size, reference
observations, explicit user preferences and untested design choices using the
design-brief section of [references/image-workflow.md](references/image-workflow.md).
Carry accepted choices across revisions. Render and compare against the previous
artifact; successful generation and geometry checks do not establish visual quality.
Read the visual rejection rubric in the image workflow before accepting a revised
map. Critique it as a first-time visitor, without citing the implementation or
tests as a defense. An automated pass only permits image review; it never ends it.

- For image styling, pictogram illustration, or comparisons of visual styles,
  use `prepare_image_brief` after resolving the document. Read
  [references/image-workflow.md](references/image-workflow.md) for style choice,
  deterministic map output, optional host image-tool handoff and correction.
  `mapSvg` and the second PNG are code-rendered maps; they are not evidence of
  a successful image-model run.
- For editable vectors, deterministic output or a host without an image tool,
  follow the SVG workflow below. Preserve an explicit format/style request;
  do not silently substitute SVG for a requested generated image.
- For a building destination in a dense city, use an image brief (usually
  `editorial`) or the geographic SVG layout to retain building context. The
  older diagram templates distort streets and do not overlay source footprints;
  do not present them as a building-level urban locator.

## SVG Workflow

1. Resolve only information that changes the result.
   - Require a destination address or an existing `DiagramDocument`.
   - Infer a sensible destination label, canvas, template, and theme when the
     user does not care. Do not turn routine defaults into a questionnaire.
   - Read [references/examples.md](references/examples.md) when the requested
     domain is ambiguous or when selecting the first composition.
   - Ask for a start point only when the user explicitly needs a route from a
     particular gate, exit, or landmark.

2. Generate the first document.
   - Call `generate_map` for an address. Retain `document` from
     `structuredContent`; do not reconstruct it from SVG.
   - If several locations match, use the candidate addresses and the user's
     stated location to choose a returned `candidateId`, then retry. Request a
     location clarification when the supplied context cannot distinguish them.
     Never substitute the first-ranked result or invent a candidate ID.
   - Start with `standard/paper` for general print use, then use the selection
     guidance in [references/quality.md](references/quality.md).
   - Keep the default building lookup on for urban destinations. Retain
     `map.buildings` and `map.buildingContext` through edits: enclosing streets
     alone do not identify a building among its neighbors.
   - Use `geocode`, `find_landmarks`, `find_roads`, and `find_buildings` when host-side
     curation is materially better than the one-shot path.

3. Inspect the rendered result.
   - Review the rendered image, not only the SVG source.
   - Apply every hard check in [references/quality.md](references/quality.md).
   - Check that the destination sits among source-backed neighboring buildings,
     with visible gaps and an unambiguous highlighted footprint. Missing OSM
     coverage means unknown context, never vacant land; do not invent filler.
   - Treat a successful tool call as a draft, not proof of a usable map.

4. Revise through the document.
   - Read [references/patches.md](references/patches.md) before the first edit.
   - Call `render_document` with the latest complete `document` and the
     smallest possible `patch`.
   - Copy landmark and road IDs exactly from the document. Never invent an ID.
   - When the user names a start point, match it to an exact landmark ID and
     set `patch.render.approachLandmarkId`. Do not rely on automatic selection.
   - Preserve the returned updated document for the next turn.
   - Prefer hiding a low-value element over shrinking all labels or obscuring
     the route. Keep automatic marker placement unless manual movement solves
     a specific visible problem.

5. Reinspect after every structural edit.
   - Recheck route continuity, marker-road clearance, label collisions,
     destination hierarchy, and attribution.
   - Stop when both technical checks and actual-size visual review pass. A
     technical pass cannot override a visible composition failure. Fix the
     relevant rule and render again; do not ask the user to perform routine QA.

6. Deliver both surfaces when future edits are plausible.
   - Return or write SVG for future editing, PNG for bitmap use, or PDF for
     print delivery. Keep SVG as the canonical visual source.
   - Keep the final `DiagramDocument` alongside it for later chat edits.
   - State any unresolved map-data ambiguity instead of presenting inferred
     access routes as surveyed navigation truth.

## Tool Fallback

When cairn MCP tools are unavailable but local commands are allowed, use:

```bash
npx -p cairn-sketch cairn "<address>" -o map.svg --save-document map.json
npx -p cairn-sketch cairn render map.json -o map-revised.svg
```

Edit `map.json` only through the documented `DiagramDocument` fields. Validate
it by running `cairn render` before delivery.

## Boundaries

- Do not hand-author a replacement SVG during the normal workflow. Fix the
  document or renderer inputs so the result remains reproducible.
- Do not add paid map APIs or request API keys for the default path.
- Do not claim turn-by-turn navigation, accessibility compliance, or entrance
  accuracy that the OSM-derived document does not establish.
- Address generation covers OSM geography. Campus floor plans, indoor maps,
  and game worlds require a supplied or adapted `MapLayout`; do not pretend an
  address lookup can discover private topology.
- Keep OSM attribution visible in every exported map that uses OSM data.
