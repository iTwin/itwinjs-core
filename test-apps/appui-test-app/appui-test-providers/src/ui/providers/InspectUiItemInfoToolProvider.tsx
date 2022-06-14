/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  CommonToolbarItem, StageUsage, ToolbarOrientation, ToolbarUsage, UiItemsProvider,
} from "@itwin/appui-abstract";
import { InspectUiItemInfoTool } from "../../tools/InspectUiItemInfoTool";

export interface InspectUiItemInfoToolProviderProps {
  inspectTool?: { itemPriority?: number, groupPriority?: number };
}

/**
 * The InspectUiItemInfoTool provides the inspect tool to any stage that has a usage value of StageUsage.General.
 */
export class InspectUiItemInfoToolProvider implements UiItemsProvider {
  public readonly id = "appui-test-providers:InspectUiItemInfoToolProvider";

  constructor(localizationNamespace: string, public props?: InspectUiItemInfoToolProviderProps) {
    // register tools that will be returned via this provider
    InspectUiItemInfoTool.register(localizationNamespace);
  }

  public provideToolbarButtonItems(_stageId: string, stageUsage: string, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation): CommonToolbarItem[] {
    /** Add a tool that starts inspect tool  */
    if (stageUsage === StageUsage.General && toolbarUsage === ToolbarUsage.ContentManipulation && toolbarOrientation === ToolbarOrientation.Horizontal) {
      return [InspectUiItemInfoTool.getActionButtonDef(this.props?.inspectTool?.itemPriority ?? 2000, this.props?.inspectTool?.groupPriority)];
    }

    return [];
  }

}

