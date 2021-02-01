/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tools
 */

import { IModelApp, Tool } from "@bentley/imodeljs-frontend";

/** Adjust the value of [TileAdmin.maxTotalTileContentBytes]($frontend). This controls how much GPU memory is allowed to be consumed
 * by tile graphics before the system starts discarding the graphics for the least recently drawn tiles.
 * @beta
 */
export class SetMaxTileMemoryTool extends Tool {
  public static toolId = "SetMaxTileMemory";
  public static get minArgs() { return 1; }
  public static get maxArgs() { return 1; }

  public run(maxBytes?: number): boolean {
    if (typeof maxBytes === "number" && maxBytes >= 0) {
      IModelApp.tileAdmin.maxTotalTileContentBytes = maxBytes;
      IModelApp.requestNextAnimation();
    }

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    return this.run(Number.parseInt(args[0], 10));
  }
}
