/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// istanbul ignore file
// IconWebComponent requires in-browser testing
/** @packageDocumentation
 * @module Utilities
 */

import { UiError } from "@itwin/appui-abstract";
import { Logger } from "@itwin/core-bentley";
import { UiCore } from "../UiCore";
import DOMPurify, * as DOMPurifyNS from "dompurify";

/**
 * IconWebComponent loads icon from an svg path
 */
export class IconWebComponent extends HTMLElement {
  private async connectedCallback() {
    await this.loadSvg();
    this.dispatchEvent(new CustomEvent("load"));
  }

  private async loadSvg() {
    // if svg was already appended don't request it again
    if (this.childNodes.length)
      return;

    const src = this.getAttribute("src") || "";

    if (src.startsWith("data:")) {
      const dataUriParts = src.split(",");

      if (dataUriParts.length !== 2 || "data:image/svg+xml;base64" !== dataUriParts[0]) {
        Logger.logError(UiCore.loggerCategory(this), "Unable to load icon.");
      }

      // the esm build of dompurify has a default import but the cjs build does not
      // if there is a default export, use it (likely esm), otherwise use the namespace
      // istanbul ignore next
      const sanitizer = DOMPurify ?? DOMPurifyNS;
      // eslint-disable-next-line deprecation/deprecation
      const sanitizedSvg = sanitizer.sanitize(atob(dataUriParts[1]));

      const parsedSvg = new window.DOMParser().parseFromString(sanitizedSvg, "text/xml");
      const errorNode = parsedSvg.querySelector("parsererror");
      if (errorNode) {
        throw new UiError (UiCore.loggerCategory(this), "Unable to load icon.");
      } else {
        !this.childNodes.length && this.append(parsedSvg.documentElement);
      }
      return;
    }

    await fetch(src)
      .catch((_error) => {
        Logger.logError(UiCore.loggerCategory(this), "Unable to load icon.");
      })
      .then(async (response) => {
        if (response && response.ok) {
          return response.text();
        } else {
          throw new UiError (UiCore.loggerCategory(this), "Unable to load icon.");
        }
      })
      .then((str) => {
        if (str !== undefined) {
          return (new window.DOMParser()).parseFromString(str, "text/xml");
        } else {
          throw new UiError (UiCore.loggerCategory(this), "Unable to load icon.");
        }
      })
      .then((data) => !this.childNodes.length && this.append(data.documentElement));
  }
}
