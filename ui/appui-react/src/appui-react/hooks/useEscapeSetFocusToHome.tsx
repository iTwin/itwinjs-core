/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Hooks
 */

import * as React from "react";
import { SpecialKey } from "@itwin/appui-abstract";
import { KeyboardShortcutManager } from "../keyboardshortcut/KeyboardShortcut";

/** Keyboard Event handler to set focus to Home on Escape key
 * @internal
 */
export function onEscapeSetFocusToHome(e: React.KeyboardEvent): void {
  // istanbul ignore else
  if (e.key === SpecialKey.Escape) {
    KeyboardShortcutManager.setFocusToHome();
  }
}

/** useCallback Hook for Keyboard Event handler to set focus to Home on Escape key
 * @internal
 */
export function useEscapeSetFocusToHome() {
  return React.useCallback(onEscapeSetFocusToHome, []);
}
