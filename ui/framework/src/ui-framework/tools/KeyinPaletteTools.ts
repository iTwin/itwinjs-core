/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tools
 */

import { clearKeyinPaletteHistory } from "../popup/KeyinPalettePanel.js";
import { Tool } from "@bentley/imodeljs-frontend";

/**
 * Immediate tool that will clear the recent history of command/tool keyins shown in
 * the command palette.
 * @alpha
 */
export class ClearKeyinPaletteHistoryTool extends Tool {
  public static toolId = "ClearKeyinPaletteHistory";
  public static iconSpec = "icon-remove";

  // istanbul ignore next
  public static get minArgs() { return 0; }
  // istanbul ignore next
  public static get maxArgs() { return 0; }

  public run(): boolean {
    clearKeyinPaletteHistory();
    return true;
  }

  public parseAndRun(): boolean {
    return this.run();
  }
}
