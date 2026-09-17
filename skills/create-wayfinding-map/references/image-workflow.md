# Grounded image workflow

## Style is information design, theme is appearance

| Style | Use when | Keep / simplify |
|---|---|---|
| `schematic` | Business cards, direction inserts, Korean 약도 | A few essential streets and landmarks; compress distance; preserve road-side relationships and intersection order |
| `neighborhood` | Visitors need surrounding streets and geographic context | More local streets and POIs; keep orientation, angles and relative distances |
| `pictorial` | Venue or event visitors benefit from recognizable symbols | A readable street skeleton with a consistent family of larger landmark pictograms |

Infer style from the request. “약도” defaults to schematic; “surrounding area”
suggests neighborhood; “recognizable icons” suggests pictorial. Do not force
every request into the most simplified style. Generate several only when the
user asks to compare. Colors remain independent: use the document's existing
`paper`, `mono`, `civic`, or `invitation` theme.

## Prepare once from evidence

1. Use an existing `DiagramDocument`, or call `generate_map` with the resolved
   address and an appropriate landmark limit (4 / 8 / 6 are useful starting
   points for the three styles). Retain the document. Resolve ambiguous
   destinations before image generation as in the main workflow.
2. Put truthful label edits and hidden places into the document with
   `render_document`. Shorten a long institution name only when its identity
   remains clear. Do not rely on an image model to abbreviate it.
3. Call `prepare_image_brief` with that document and the chosen `style`. It
   returns `prompt`, a reference PNG content block, `referenceSvg`, source
   `facts`, `checks`, and missing-evidence `warnings`. Reference marker keys
   D/L/R match the facts, not decorative output labels. The reference ignores
   manual marker offsets and fisheye so a visual adjustment cannot masquerade
   as geographic evidence. Hidden objects and edited labels are respected.
   Lane-level vehicle connectors whose endpoints share the same named street
   are omitted using OSM node identity. Links between different streets and
   links with unknown endpoint identities remain eligible for selection.
   `roadContinuities` measures the approach directions at shared source nodes.
   It distinguishes near-straight continuations from bends without moving or
   merging nodes. A missing continuity record does not mean a straight road.

## Generate through the host

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

If the host has no image tool, return the brief/reference and explain that
image rendering requires a capable host. The existing SVG path is a format
alternative, not proof of generating the requested image. The server calls
no model; host tool availability and costs are separate from cairn's
API-key-free data and SVG path.

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
pictorial styles, paired carriageways of one street should form a single solid
band, with no median slit or turning-lane shapes inside it.

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
cairn brief office.json --style schematic -o brief.json --reference reference.png
```

Read `prompt` from the JSON and attach `reference.png` to the host image tool.
`brief` runs offline and defaults to JSON stdout. It does not itself create the
styled image. Change document theme/canvas before preparing the next brief;
SVG `--template` is not an image style.
