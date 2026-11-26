/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MarkupApp
 */

import DOMPurify, { RemovedAttribute, RemovedElement } from "dompurify";
import { Logger } from "@itwin/core-bentley";
import { FrontendLoggerCategory } from "@itwin/core-frontend";

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

const loggerCategory = `${FrontendLoggerCategory.Package}.markup`;

/** Log a warning naming what the sanitizer removed from a markup. Content and attribute values are omitted, as they may hold the payload or user data. */
function logRemoved(items: Array<RemovedElement | RemovedAttribute>): void {
  const elements: string[] = [];
  const attributes: string[] = [];

  for (const item of items) {
    if ("attribute" in item) {
      attributes.push(item.attribute?.name ?? "unknown");
    } else if (item.element instanceof Element) {
      // DOMPurify parses the input into a <body> (which absorbs any <body> tag in the input) and, since the profile forbids it, reports it on every call.
      if (item.element.nodeName !== "BODY")
        elements.push(item.element.localName);
    } else if (item.element.nodeType === Node.TEXT_NODE && item.element.textContent?.trim()) {
      elements.push("#text");
    } // comments (including an `<?xml ... ?>` declaration parsed as HTML) and whitespace are not worth reporting
  }

  if (elements.length > 0 || attributes.length > 0)
    Logger.logWarning(loggerCategory, "Removed unsafe or unsupported content from markup", () => ({ elements, attributes }));
}

/** Sanitize `input`, dropping the top-level nodes rejected by `filter`, and log what was removed. */
function sanitize(input: string, filter: (node: ChildNode, index: number) => boolean): DocumentFragment {
  const instance = getPurifier();
  const fragment = instance.sanitize(input, svgConfig);
  const removed: Array<RemovedElement | RemovedAttribute> = [...instance.removed];
  Array.from(fragment.childNodes).forEach((node, index) => {
    if (!filter(node, index)) {
      removed.push({ element: node });
      node.remove();
    }
  });

  logRemoved(removed);

  return fragment;
}

/** Sanitize an SVG document string into a fragment that can be inserted directly.
 * Only top-level `<svg>` elements are returned; text and HTML elements beside them are dropped.
 * @internal
 */
export function sanitizeSvg(svg: string): DocumentFragment {
  return sanitize(svg, (node) => node instanceof SVGSVGElement);
}

/** Remove script-capable and non-SVG content from a string that will be parsed as the content of an `<svg>` element,
 * as svg.js `Dom.svg(string)` does. Unlike [[sanitizeSvg]], SVG elements without an enclosing `<svg>` element are preserved.
 * @internal
 */
export function sanitizeSvgContent(content: string): string {
  // Content that closes the SVG root early ends up beside it and is dropped.
  const svgRoot = sanitize(`<svg>${content}</svg>`, (_node, index) => index === 0).firstChild;
  return svgRoot instanceof Element ? svgRoot.innerHTML : "";
}
