/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  IModelApp,
  Tool,
} from "@bentley/imodeljs-frontend";
import {
  Id64Arg,
} from "@bentley/bentleyjs-core";

/** Replaces the contents of the selection set with the set of element Ids specified.
 * Element Ids are separated by whitespace.
 * @beta
 */
export class SelectElementsByIdTool extends Tool {
  public static toolId = "SelectElementsById";
  public static get minArgs() { return 1; }
  public static get maxArgs() { return undefined; }

  public run(ids?: Id64Arg): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp && undefined !== ids)
      vp.iModel.selectionSet.replace(ids);

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    return this.run(args);
  }
}
