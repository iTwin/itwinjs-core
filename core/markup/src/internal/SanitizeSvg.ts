/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MarkupApp
 */

import DOMPurify from "dompurify";

/* eslint-disable @typescript-eslint/naming-convention */
const svgConfig = { USE_PROFILES: { svg: true, svgFilters: true }, ADD_TAGS: ["use"], RETURN_DOM_FRAGMENT: true as const };
/* eslint-enable @typescript-eslint/naming-convention */

// A private instance, so hooks or a global configuration that the application (or another library) installs on the shared
// DOMPurify instance cannot change what is allowed into a markup.
let purifier: typeof DOMPurify | undefined;
const getPurifier = () => purifier ??= createPurifier();

function createPurifier() {
  const instance = DOMPurify(window);

  // A `use` element clones the content it references, which the sanitizer never sees unless it is part of the same (sanitized) document.
  instance.addHook("uponSanitizeAttribute", (node, data) => {
    if (node.localName === "use" && (data.attrName === "href" || data.attrName === "xlink:href") && !data.attrValue.startsWith("#"))
      data.keepAttr = false;
  });

  return instance;
}

/** Remove script-capable and non-SVG content from an SVG document string that will be parsed as HTML (e.g. assigned to `innerHTML`).
 * Only top-level `<svg>` elements are returned; text and HTML elements beside them are dropped.
 * @internal
 */
export function sanitizeSvg(svg: string): string {
  const fragment = getPurifier().sanitize(svg, svgConfig);
  return Array.from(fragment.children).filter((child) => child instanceof SVGSVGElement).map((child) => child.outerHTML).join("");
}

/** Remove script-capable and non-SVG content from a string that will be parsed as the content of an `<svg>` element,
 * as svg.js `Dom.svg(string)` does. Unlike [[sanitizeSvg]], SVG elements without an enclosing `<svg>` element are preserved.
 * @internal
 */
export function sanitizeSvgContent(content: string): string {
  const fragment = getPurifier().sanitize(`<svg>${content}</svg>`, svgConfig);
  const wrapper = fragment.firstChild;
  return wrapper instanceof Element ? wrapper.innerHTML : "";
}
