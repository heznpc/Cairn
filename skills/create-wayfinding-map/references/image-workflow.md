# Grounded image workflow

## Record a visual brief before changing the design

Separate reference observations, explicit user preferences, and design
hypotheses. A search-results screenshot or a commercial portfolio is evidence
of available formats, not population preference. Record the intended delivery
size and what information the reader must locate. Do not turn one user's choice
into a universal aesthetic rule.

`editorial` preserves the destination's enclosing streets before simplifying
context. Six street groups and four landmarks are a starting budget; the
source-node enclosure is protected. The whole scene can rotate up to 30 degrees
to organize a nearby main street, with one uniform scale and a matching north
arrow. Real bends and all road/place relationships remain intact.

The `designContract` records evidence, feedback and hypotheses. The current
600 px visitor-map preset uses a flat symbol family, destination-only accent,
stronger destination type, horizontal street names and adjacent same-side place
labels. These choices are preset-specific, not universal rules for all maps.

## Reject a bad composition before delivery

Review the exported PNG without reading the implementation or the test results.
Write what a first-time visitor sees, including the region or object supporting
each finding. Use the actual earlier artifact; a rejected draft is not an
approved reference. Earlier drafts failed even though topology tests passed.

| Reject when | Change the cause |
|---|---|
| Road bands or exit badges attract attention before the destination | Adjust road weight, type hierarchy and accent allocation |
| The useful cluster is crowded while large parts of the canvas are unused | Reframe the block and arrival context together; preserve one scale/rotation |
| A closed block exists in data but its boundary is visually weak | Retain enclosing streets and give them readable weight |
| Icon containers, perspective, silhouette weight and colors look unrelated | Apply one coherent symbol family; do not just add decorative detail |
| Names need zooming, head-tilting, or compete at the same size | Revise type hierarchy and horizontal label placement at actual output size |
| A name sits across a street or needs a long leader to find its icon | Recompose its same-side label space; do not move its geographic anchor |

`designReview` reports measured failures in the actual SVG. `blocked` means
revise the draft; `needs-visual-review` means only that automated failures were
not found. It never reports aesthetic success. Missing geographic evidence
stays explicit rather than being repaired with invented streets. All output
styles still need this visual critique even when they lack automated metrics.

For each criterion record `pass` or `fail`, an observation, and `visibleEvidence`
identifying the relevant objects/region in the rendered image. A failed criterion
requires revision of the responsible selection/composition/type/icon rule and
rerendering. If the artifact changes, its earlier review expires. Do not hide a
failed criterion behind test counts or ask the user to accept a technically
valid draft as finished design. No extra user approval step is implied.

This direction draws on the user-supplied Korean commercial-map examples and
the user's request for pictograms and editable vectors. Commercial services
also distinguish simple line/text maps from image-rich maps and request style,
color and font samples ([example](https://kmong.com/gig/641729)). This supports
keeping separate visual briefs; it does not prove which style people prefer.

Review the actual PNG at delivery size against the previous output: destination
recognition, useful station/exit context, cohesive symbols, correct geography,
and readable labels. A revision must preserve previously accepted properties.
Record any visual failure with the artifact and criterion it violates, then
change the relevant composition/token/layout rule and rerender. Do not report
test counts as evidence of aesthetic success. In a repository checkout:

```bash
npm run build
node scripts/compare-map-design.mjs office.json tmp/comparison prior-image.png
```

This produces the revised editable SVG, PNG, brief, source document, a
600-pixel review image, a side-by-side comparison and a pending `review.json`.
Inspect the artifacts and fill the observations and visible evidence. The
manifest records automated failures and the exact PNG hash. Check the completed
record with `node scripts/review-map-design.mjs tmp/comparison/review.json`;
missing reviews, failed criteria, measured failures or changed pixels reject it.
This checks the review record, not whether its visual judgment is correct.
The supplied prior PNG is preserved and its hash recorded. A previously
liked generated image guides appearance only; road facts still come from the
document. Without a prior PNG, the left panel is labeled as a current code sample,
never the original. Preserve past outputs in separate revision directories.
No image model is called.

## Style is information design, theme is appearance

| Style | Use when | Keep / simplify |
|---|---|---|
| `editorial` | A pictogram guide where readers must recognize the destination’s block | Protect the enclosing streets and useful local context, use a coherent symbol family and a clear destination hierarchy, and compare with the actual earlier image |
| `schematic` | Business cards, direction inserts, Korean 약도 | A few essential streets and landmarks; compact line icons; preserve display paths, road-side relationships and intersection order |
| `neighborhood` | Visitors need surrounding streets and geographic context | More local streets and POIs; keep orientation, angles and relative distances |
| `pictorial` | Venue or event visitors benefit from recognizable symbols | A readable street skeleton with a consistent family of larger landmark pictograms |

Infer style from the request. Pictogram-led “약도” defaults to pictorial; “surrounding area”
suggests neighborhood; “recognizable icons” suggests pictorial. Do not force
every request into the most simplified style. Generate several only when the
user asks to compare. Colors remain independent: use the document's existing
`paper`, `mono`, `civic`, or `invitation` theme.

## Prepare once from evidence

1. Use an existing `DiagramDocument`, or call `generate_map` with the resolved
   address and an appropriate landmark limit (4 / 8 / 6 are useful starting
   points for the legacy styles; editorial retains 4 landmarks). Retain the document. Resolve ambiguous
   destinations before image generation as in the main workflow.
2. Put truthful label edits and hidden places into the document with
   `render_document`. Shorten a long institution name only when its identity
   remains clear. Do not rely on an image model to abbreviate it.
3. Call `prepare_image_brief` with that document and the chosen `style`. It
   returns `prompt`, two PNG content blocks (road blueprint, then code-rendered
   map), `referenceSvg`, `sourceReferenceSvg`, `mapSvg`, source `facts`, `checks`,
   and missing-evidence `warnings`. Blueprint marker keys D/L/S match the facts;
   R keys identify source roads. These are not decorative output labels. The reference ignores
   manual marker offsets and fisheye so a visual adjustment cannot masquerade
   as geographic evidence. Hidden objects and edited labels are respected.
   Lane-level vehicle connectors whose endpoints share the same named street
   are omitted using OSM node identity. Links between different streets and
   links with unknown endpoint identities remain eligible for selection.
   `roadContinuities` measures the approach directions at shared source nodes.
   It distinguishes near-straight continuations from bends without moving or
   merging nodes. A missing continuity record does not mean a straight road.
   `displayRoads` contains the actual rendered paths. Connected ways join only
   at shared source nodes. Schematic/pictorial styles collapse mutually
   unambiguous, straight, overlapping opposite one-way carriageways into one
   centerline; bends, staggered junctions and unrelated parallel roads remain.
   `displayNodes` records the resulting source-node positions. Raw source roads
   and node identities remain available in `facts` and `sourceReferenceSvg`.

## Review the code-rendered draft

Inspect `mapSvg` or the second PNG. It uses exactly the blueprint's road paths,
with geographic pictograms and literal labels rendered in code. Use this output
when continuous street geometry must survive into the delivered SVG/PNG/PDF.
Apply the rejection rubric above at actual delivery size before delivery. This render is
reproducible; it does not call an image model. It does not verify pedestrian
access or entrance usability.

## Optionally restyle through the host

Use the host's available image-generation/editing tool and its normal attachment
instructions. Pass the returned prompt and the reference image together; never
send only the style name. Inspect a local reference before attaching it if the
host tool requires that. Keep the generated brief unchanged for the first run,
so its actual behavior can be assessed without undocumented manual layout work.

The reference establishes coordinates and selected road geometry, not building
footprints, entrance accessibility, or a walking route. A supplied real map or
photo may supplement it, but a previous generated image is not geographic
evidence. Do not invent extra roads or buildings just to fill space. Do not
impose a fixed two-road cross on unrelated places.

If the host has no image tool, the code-rendered map remains available. Do not
describe it as an image-model result or silently substitute it for an explicitly
requested generated illustration. Host tool availability and costs are separate
from cairn's API-key-free data and SVG/PNG/PDF path.

## Inspect and revise

Review the actual image against `facts`, the reference and every returned
`checks` item. A coherent-looking image can still put an exit on the wrong side
of a road or silently change Korean letters. Style similarity is not proof of
geographic correctness. Do not call a route verified from shared OSM nodes.

Use the place icon itself as the location marker. Check for redundant black
anchor dots or short leader stubs beside icons; remove them rather than moving
the icon away from its true position. Adjacent labels need no leader. A distant
label can connect directly to the icon edge with a thin line and no endpoint dots.

Check roads for diagonal cuts or extra branches caused by lane-level crossover
details. Do not restore omitted intra-street connectors. In schematic and
pictorial styles, only pairs explicitly marked in `displayRoads` share a single
solid band, with no median slit or turning-lane shapes inside it. A shared street
name is not sufficient to merge roads.

Compare the junction's actual approach axes with `roadContinuities` and the
original reference. An aligned source street must not become independently
offset or rotated arms in the image. Preserve source bends and distinct nodes
in real staggered intersections; do not apply a universal straight-cross rule.
Keep POI label backgrounds off the roads so a text backplate cannot erase a
road section and make an otherwise continuous street appear disconnected.

For a spelling-only defect, edit only that label while preserving geometry.
For a structural/style defect, rebuild from the original geographic reference
with the same source facts and a concise correction. Do not keep editing a
distorted generated image as if it were ground truth. If the user changes a
place, visibility, name or theme, patch the document first and rebuild the
brief. Record any corrective prompt alongside the original brief.

After two targeted repair attempts, report the remaining concrete defect with
the draft. User feedback can start a new revision. Never claim that reference
coordinates mechanically lock generated pixels, or that text is code-composited
when it is still generated by the model.

Deliver the image and retain the document, brief, reference and any repair
prompts for further edits. Brief generation is deterministic; image generation
is not. A style comparison uses the same source document and theme for each
brief so it is not confounded by a different destination or label set.

## CLI fallback

```bash
cairn "서울 강남구 테헤란로 152" --label "강남파이낸스센터" --save-document office.json -o office.svg
cairn brief office.json --style schematic -o brief.json --reference reference.png --map map.png
```

`map.png` is the deterministic map; `--map` also supports SVG and PDF. For an
optional restyle, read `prompt` from the JSON and attach `reference.png` to the
host image tool. `brief` runs offline and defaults to JSON stdout. Change
document theme/canvas before preparing the next brief; SVG `--template` is not
an image style.
