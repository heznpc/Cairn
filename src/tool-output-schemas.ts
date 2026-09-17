import {
  diagramDocumentJsonSchema,
  landmarkItemJsonSchema,
  mapLayoutJsonSchema,
  roadItemJsonSchema,
} from "./diagram-json-schema.js";
import { LATITUDE_RANGE, LONGITUDE_RANGE } from "./domain-values.js";
import { RENDER_THEMES } from "./domain-values.js";
import { IMAGE_STYLES } from "./image-styles.js";

export const imageBriefOutputSchema = {
  type: "object",
  required: ["version", "style", "theme", "canvas", "prompt", "referenceSvg", "sourceReferenceSvg", "mapSvg", "facts", "checks", "warnings"],
  additionalProperties: false,
  properties: {
    version: { type: "integer", const: 1 },
    style: { type: "string", enum: IMAGE_STYLES },
    theme: { type: "string", enum: RENDER_THEMES },
    canvas: { type: "object", required: ["width", "height"], additionalProperties: false,
      properties: { width: { type: "integer" }, height: { type: "integer" } } },
    prompt: { type: "string", description: "Directions for the host's image tool. Pass with the reference image; not itself a generated map." },
    referenceSvg: { type: "string", description: "Code-built display road blueprint, also returned as the first PNG." },
    sourceReferenceSvg: { type: "string", description: "Unmodified source road geometry for geographic comparison." },
    mapSvg: { type: "string", description: "Finished deterministic map using the blueprint road paths, pictograms and literal labels. Also returned as the second PNG." },
    facts: { type: "object", required: ["destination", "landmarks", "roads", "sharedNodes", "displayRoads", "displayNodes", "roadContinuities", "roadRelations", "requestedStart"],
      additionalProperties: false, properties: {
        destination: { type: "object" }, landmarks: { type: "array", items: { type: "object" } },
        roads: { type: "array", items: { type: "object" } }, sharedNodes: { type: "array", items: { type: "object" } },
        displayRoads: { type: "array", items: { type: "object" } },
        displayNodes: { type: "array", items: { type: "object" } },
        roadContinuities: { type: "array", items: { type: "object" },
          description: "Measured approach geometry at shared source nodes; near-straight or bent. Distinct junction nodes are never merged." },
        roadRelations: { type: "array", items: { type: "object" } },
        requestedStart: { type: ["string", "null"] },
      } },
    checks: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
  },
} as const;

// MCP 2025-06-18 spec §tools.outputSchema. Host LLMs validate structuredContent
// against these and can read results structurally instead of parsing text.
export {
  diagramDocumentJsonSchema,
  diagramDocumentPatchJsonSchema,
  mapLayoutJsonSchema,
} from "./diagram-json-schema.js";

export const generateMapOutputSchema = {
  type: "object",
  required: ["svg", "layout", "document"],
  additionalProperties: false,
  properties: {
    svg: {
      type: "string",
      description: "Rendered SVG markup, ready to embed or write to a file.",
    },
    layout: mapLayoutJsonSchema,
    document: diagramDocumentJsonSchema,
  },
} as const;

export const renderDocumentOutputSchema = {
  type: "object",
  required: ["svg", "document"],
  additionalProperties: false,
  properties: {
    svg: {
      type: "string",
      description: "Rendered SVG markup after applying the requested patch.",
    },
    document: diagramDocumentJsonSchema,
  },
} as const;

const geocodeCandidateSchema = {
  type: "object",
  required: ["lat", "lon", "displayName"],
  additionalProperties: false,
  properties: {
    lat: { type: "number", ...LATITUDE_RANGE },
    lon: { type: "number", ...LONGITUDE_RANGE },
    displayName: { type: "string" },
    candidateId: { type: "string", minLength: 1 },
    kind: { type: "string" },
    countryCode: { type: "string" },
    // Raw Nominatim payload shape varies across regions.
    raw: { type: "object" },
  },
} as const;

export const geocodeOutputSchema = {
  ...geocodeCandidateSchema,
  properties: {
    ...geocodeCandidateSchema.properties,
    candidates: {
      type: "array", minItems: 1, maxItems: 5,
      items: { ...geocodeCandidateSchema, required: ["candidateId", "lat", "lon", "displayName"] },
    },
    ambiguous: { type: "boolean" },
  },
} as const;

export const findLandmarksOutputSchema = {
  type: "object",
  required: ["landmarks"],
  additionalProperties: false,
  properties: {
    landmarks: { type: "array", items: landmarkItemJsonSchema },
  },
} as const;

export const findRoadsOutputSchema = {
  type: "object",
  required: ["roads"],
  additionalProperties: false,
  properties: {
    roads: { type: "array", items: roadItemJsonSchema },
  },
} as const;
