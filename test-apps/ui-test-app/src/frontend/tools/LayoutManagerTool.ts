/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tools
 */
import { Tool } from "@bentley/imodeljs-frontend";
import { FrontstageManager, UiFramework } from "@bentley/ui-framework";

export class LayoutManagerRestoreLayoutTool extends Tool {
  public static toolId = "TestLayoutManager.RestoreLayout";

  public static get maxArgs() { return 1; }

  public parseAndRun(frontstageId: string): boolean {
    UiFramework.layoutManager.restoreLayout(frontstageId);
    return true;
  }

  public run(): boolean {
    return this.parseAndRun(FrontstageManager.activeFrontstageId);
  }
}
