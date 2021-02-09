/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module AccuDraw
 */

import { AccuDrawUiAdmin } from "@bentley/ui-abstract";

/** @alpha */
export class FrameworkAccuDrawUiAdmin extends AccuDrawUiAdmin {

  /** Determine if AccuDraw UI has focus */
  public get hasInputFocus() {
    let hasFocus = false;
    const el = document.querySelector("div.uifw-accudraw-field-container");
    if (el)
      hasFocus = el.contains(document.activeElement);
    return hasFocus;
  }
}
