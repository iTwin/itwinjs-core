/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  CommonToolbarItem, StageUsage,
} from "@itwin/appui-abstract";
import { ToolbarOrientation, ToolbarUsage, UiItemsProvider } from "@itwin/appui-react";
import { InspectUiItemInfoTool } from "../../tools/InspectUiItemInfoTool";

export interface InspectUiItemInfoToolProviderProps {
  inspectTool?: { itemPriority?: number, groupPriority?: number };
}

/**
 * The InspectUiItemInfoToolProvider registers and provides the InspectUiItemInfoTool to any stage that has a usage value of StageUsage.General.
 * This tool can be used to display info about dynamically provided toolbuttons, status bar items, and widget by hovering over them
 * with mouse.
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
