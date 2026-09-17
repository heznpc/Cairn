import type { LandmarkCategory, RenderTheme } from "../types.js";
import { landmarkIcon } from "./icons.js";

export type PictogramKind = LandmarkCategory | "cinema";

/** Use source category tags, never a guessed business name or building likeness. */
export function pictogramKind(category: LandmarkCategory, tags: Record<string, string>): PictogramKind {
  return tags.amenity === "cinema" ? "cinema" : category;
}

/** Self-contained editable SVG shapes, centered in an approximately 48 px box. */
export function pictogram(kind: PictogramKind, theme: RenderTheme, destination = false, ink = "#34434d"): string {
  const mono = theme === "mono";
  const white = "#ffffff";
  const accent = mono ? ink : theme === "civic" ? "#286f98" : "#e65038";
  const main = destination ? accent : ink;
  const g = (body: string) => `<g data-pictogram="${kind}" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
  switch (kind) {
    case "building":
      return g(`<path d="M-21,21 V-4 H-12 V21 M12,21 V-8 H21 V21" fill="${main}"/>
        <path d="M-11,21 V-15 L0,-24 L11,-15 V21 Z" fill="${main}"/>
        <path d="M0,-24 L11,-15 V21 H0 Z" fill="${mono ? white : ink}" opacity=".18"/>
        <path d="M-6,-11 V-7 M5,-11 V-7 M-6,-1 V3 M5,-1 V3 M-6,9 V13 M5,9 V13 M-17,2 V6 M-17,12 V16 M16,0 V4 M16,10 V14" stroke="${white}" stroke-width="3"/>
        <path d="M-24,22 H24" stroke="${main}" stroke-width="2.5"/>`);
    case "station":
    case "tram_stop":
      return g(`<rect x="-22" y="-23" width="44" height="46" rx="12" fill="${main}" stroke="${white}" stroke-width="2.5"/>
        <rect x="-11" y="-15" width="22" height="28" rx="6" fill="${white}"/>
        <rect x="-8" y="-10" width="16" height="10" rx="2" fill="${main}"/>
        <circle cx="-6" cy="7" r="2" fill="${main}"/><circle cx="6" cy="7" r="2" fill="${main}"/>
        <path d="M-7,13 L-11,19 M7,13 L11,19" stroke="${white}" stroke-width="2.5"/>
        ${kind === "tram_stop" ? `<path d="M-5,-19 L0,-22 L5,-19" fill="none" stroke="${white}" stroke-width="1.5"/>` : ""}`);
    case "station_exit":
      return g(`<rect x="-20" y="-21" width="40" height="42" rx="11" fill="${mono ? white : "#f4c64c"}" stroke="${ink}" stroke-width="2"/>
        <path d="M-3,-12 H-11 V12 H-3 M-4,0 H12 M6,-6 L12,0 L6,6" fill="none" stroke="${ink}" stroke-width="2.8"/>`);
    case "hospital":
    case "pharmacy": {
      const color = mono ? ink : kind === "pharmacy" ? "#527b57" : "#467e97";
      return g(`<rect x="-20" y="-20" width="40" height="40" rx="9" fill="${color}"/>
        <path d="M-5,-13 H5 V-5 H13 V5 H5 V13 H-5 V5 H-13 V-5 H-5 Z" fill="${white}"/>`);
    }
    case "cinema":
      return g(`<circle r="22" fill="${main}"/>
        <circle cy="-12" r="5" fill="${white}"/><circle cx="12" r="5" fill="${white}"/>
        <circle cy="12" r="5" fill="${white}"/><circle cx="-12" r="5" fill="${white}"/>
        <circle r="2.5" fill="${white}"/>`);
    case "park": {
      const green = mono ? ink : "#527f51", dark = mono ? ink : "#3e6743";
      return g(`<path d="M-8,10 V22 M16,12 V22" stroke="${mono ? ink : "#79533b"}" stroke-width="4"/>
        <path d="M-23,4 C-25,-3 -20,-8 -17,-10 C-17,-22 -3,-26 3,-14 C11,-10 12,0 8,7 C3,14 -20,14 -23,4 Z" fill="${green}"/>
        <path d="M5,10 C3,4 8,0 10,-3 C9,-11 20,-15 23,-5 C29,0 29,10 24,14 C19,18 7,17 5,10 Z" fill="${dark}"/>`);
    }
    default:
      return g(`<circle r="22" fill="${main}"/><g transform="scale(1.5)">${landmarkIcon(kind, 0, 0, white)}</g>`);
  }
}

/** One family of flat symbols. Their center remains the geographic anchor. */
export function editorialPictogram(kind: PictogramKind, color: string, ink: string): string {
  const shapes: Partial<Record<PictogramKind, string>> = {
    building: `<path d="M-15,19 V-20 H9 V19 Z M9,-7 H19 V19 H9 Z" fill="${color}"/><path d="M-9,-13 H-4 M1,-13 H5 M-9,-5 H-4 M1,-5 H5 M-9,3 H-4 M1,3 H5 M-9,11 H-4 M1,11 H5" stroke="white" stroke-width="3"/>`,
    hospital: `<path d="M-6,-18 H6 V-6 H18 V6 H6 V18 H-6 V6 H-18 V-6 H-6 Z" fill="${color}"/>`,
    cinema: `<rect x="-19" y="-12" width="38" height="29" rx="2" fill="${color}"/><path d="M-19,-15 L17,-22 L19,-14 L-17,-7 Z" fill="${color}"/><path d="M-10,-17 L-6,-10 M1,-19 L5,-12 M11,-21 L15,-14" stroke="white" stroke-width="3"/><path d="M-5,-3 L7,3 L-5,10 Z" fill="white"/>`,
    park: `<path d="M-9,6 V20 M12,8 V20" stroke="${color}" stroke-width="3"/><path d="M-9,-21 C-24,-15 -25,7 -9,9 C7,7 6,-15 -9,-21 Z M12,-13 L2,9 H23 Z" fill="${color}"/>`,
    station_exit: `<circle r="19" fill="white" stroke="${ink}" stroke-width="2"/><path d="M-4,-10 H-11 V10 H-4 M-4,0 H11 M6,-5 L11,0 L6,5" fill="none" stroke="${ink}" stroke-width="2.5"/>`,
  };
  return `<g data-pictogram="${kind}" stroke-linejoin="round">${shapes[kind] ?? `<g transform="scale(.8)">${pictogram(kind, "mono", false, ink)}</g>`}</g>`;
}
