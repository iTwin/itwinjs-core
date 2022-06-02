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
    await fetch(this.getAttribute("src") || "")
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
