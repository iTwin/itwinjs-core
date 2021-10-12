/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tools
 */

import { Id64Arg } from "@itwin/core-bentley";
import { IModelApp, Tool } from "@itwin/core-frontend";

/** Replaces the contents of the selection set with the set of element Ids specified.
 * Element Ids are separated by whitespace.
 * @beta
 */
export class SelectElementsByIdTool extends Tool {
  public static override toolId = "SelectElementsById";
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return undefined; }

  public override async run(ids?: Id64Arg): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp && undefined !== ids)
      vp.iModel.selectionSet.replace(ids);

    return true;
  }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    return this.run(args);
  }
}
