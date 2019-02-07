/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module SelectionSet */

import { SelectionTool } from "@bentley/imodeljs-frontend";

/** Tool for picking a set of elements of interest, selected by the user. */
export class AppSelectTool extends SelectionTool {
  public static toolId = "AppSelect";
  protected wantToolSettings(): boolean { return true; }
  protected wantSelectionScopeInToolSettings(): boolean { return true; }
}
