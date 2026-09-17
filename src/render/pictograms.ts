import type { LandmarkCategory, RenderTheme } from "../types.js";
import { landmarkIcon } from "./icons.js";
import { escapeXml } from "./xml.js";

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
export function editorialPictogram(kind: PictogramKind, accent: string, ink: string, exitRef?: string, theme: RenderTheme = "paper"): string {
  const color = theme === "mono" ? ink : accent;
  const shapes: Partial<Record<PictogramKind, string>> = {
    building: `<ellipse cy="27" rx="32" ry="5" fill="${color}" opacity=".13"/>
      <path d="M-29,25 V-5 H-16 V25 M15,25 V-7 H28 V25" fill="${color}"/>
      <path d="M-15,25 V-21 L0,-31 L15,-21 V25 Z" fill="${color}"/>
      <path d="M0,-31 L15,-21 V25 H0 Z" fill="${ink}" opacity=".13"/>
      <path d="M-10,-16 L-4,-20 V-11 L-10,-8 Z M5,-20 L11,-16 V-8 L5,-11 Z M-10,-3 L-4,-6 V3 L-10,5 Z M5,-6 L11,-3 V5 L5,3 Z M-10,10 L-4,8 V18 L-10,19 Z M5,8 L11,10 V19 L5,18 Z" fill="white"/>
      <path d="M-23,1 V7 M-23,13 V19 M21,0 V7 M21,13 V19" stroke="white" stroke-width="3"/>
      <path d="M-32,26 H31" stroke="${color}" stroke-width="2.5"/>`,
    hospital: `<circle r="20" fill="white" stroke="${ink}" stroke-width="1.5"/><path d="M-5,-13 H5 V-5 H13 V5 H5 V13 H-5 V5 H-13 V-5 H-5 Z" fill="${theme === 'mono' ? ink : '#d35c4d'}"/>`,
    cinema: `<circle r="23" fill="${ink}"/><circle cy="-12" r="4.7" fill="white"/><circle cx="11.4" cy="-3.7" r="4.7" fill="white"/><circle cx="7" cy="9.7" r="4.7" fill="white"/><circle cx="-7" cy="9.7" r="4.7" fill="white"/><circle cx="-11.4" cy="-3.7" r="4.7" fill="white"/>`,
    station: `<circle r="24" fill="${ink}" stroke="white" stroke-width="3"/><rect x="-11" y="-16" width="22" height="28" rx="5" fill="white"/><rect x="-8" y="-11" width="16" height="10" rx="2" fill="${ink}"/><circle cx="-6" cy="6" r="2" fill="${ink}"/><circle cx="6" cy="6" r="2" fill="${ink}"/><path d="M-6,12 L-10,18 M6,12 L10,18" stroke="white" stroke-width="2.5"/>`,
    station_exit: exitRef && /^[\p{L}\p{N}-]{1,4}$/u.test(exitRef)
      ? `<circle r="21" fill="${theme === 'mono' ? 'white' : '#f2cd61'}" stroke="${ink}" stroke-width="2"/><text y="1" dominant-baseline="middle" text-anchor="middle" font-size="${exitRef.length > 2 ? 16 : 25}" font-weight="700" fill="${ink}">${escapeXml(exitRef)}</text>`
      : pictogram("station_exit", theme),
  };
  return `<g data-pictogram="${kind}" stroke-linejoin="round">${shapes[kind] ?? pictogram(kind, theme, false, ink)}</g>`;
}
