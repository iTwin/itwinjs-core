/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tools
 */

import { GpuMemoryLimit, IModelApp, Tool } from "@bentley/imodeljs-frontend";

/** Adjust the value of [TileAdmin.gpuMemoryLimit]($frontend). This controls how much GPU memory is allowed to be consumed
 * by tile graphics before the system starts discarding the graphics for the least recently drawn tiles.
 * @beta
 */
export class SetGpuMemoryLimitTool extends Tool {
  public static toolId = "SetGpuMemoryLimit";
  public static get minArgs() { return 1; }
  public static get maxArgs() { return 1; }

  public run(limit?: GpuMemoryLimit): boolean {
    if (undefined !== limit) {
      IModelApp.tileAdmin.gpuMemoryLimit = limit;
      IModelApp.requestNextAnimation();
    }

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const maxBytes = Number.parseInt(args[0], 10);
    const limit = Number.isNaN(maxBytes) ? args[0] as GpuMemoryLimit : maxBytes;
    return this.run(limit);
  }
}
