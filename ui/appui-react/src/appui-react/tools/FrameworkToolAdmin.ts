/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tools
 */

import { ToolAdmin } from "@itwin/core-frontend";
import { SpecialKey } from "@itwin/appui-abstract";
import { KeyboardShortcutManager } from "../keyboardshortcut/KeyboardShortcut";
import { UiFramework } from "../UiFramework";

/** UiFramework implementation of ToolAdmin
  * @alpha
  */
export class FrameworkToolAdmin extends ToolAdmin {

  /** Process shortcut key events */
  public override async processShortcutKey(e: KeyboardEvent, wentDown: boolean): Promise<boolean> {
    let handled = false;

    if (wentDown && !UiFramework.isContextMenuOpen) {
      if (KeyboardShortcutManager.isFocusOnHome && e.key !== SpecialKey.Escape) {
        KeyboardShortcutManager.processKey(e.key, e.altKey, e.ctrlKey, e.shiftKey);
        handled = true;
      }
    }

    return handled;
  }
}
