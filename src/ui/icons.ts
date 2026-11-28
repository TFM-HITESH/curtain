/**
 * Icons used inside the sites. They draw with `currentColor`, so they take the
 * colour of the site's own text and icons around them.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/** The Guest mode mark in outline: a hat over a visor, as in the toolbar icon. */
const GUEST_PATHS = [
  "M6.2 10 7.6 4.8a1.6 1.6 0 0 1 2-1.1l2.4.7 2.4-.7a1.6 1.6 0 0 1 2 1.1L17.8 10",
  "M2.5 10.6h19",
  "M6.5 14.4h11a2.3 2.3 0 0 1 0 4.6h-11a2.3 2.3 0 0 1 0-4.6z",
];

export function guestIcon(doc: Document = document): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  for (const d of GUEST_PATHS) {
    const path = doc.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}
