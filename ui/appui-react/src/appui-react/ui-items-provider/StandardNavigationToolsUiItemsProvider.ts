/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StandardUiItemsProvider
 */

import {
  CommonToolbarItem, ToolbarOrientation, ToolbarUsage, UiItemsProvider,
} from "@itwin/appui-abstract";
import { ToolbarHelper } from "../toolbar/ToolbarHelper";
import { CoreTools } from "../tools/CoreToolDefinitions";

/**
 * Defines what tools to include from the provider. If any tools in the horizontal or vertical group are
 * specified then only those tools will be provided to stage.
 * @public
 */
export interface DefaultNavigationTools {
  horizontal?: {
    rotateView?: boolean;
    panView?: boolean;
    fitView?: boolean;
    windowArea?: boolean;
    viewUndoRedo?: boolean;
  };
  vertical?: {
    walk?: boolean;
    toggleCamera?: boolean;
    setupWalkCamera?: boolean;
  };
}

/**
 * Provide standard tools for the ViewNavigationWidgetComposer.
 * @beta
 */
export class StandardNavigationToolsUiItemsProvider implements UiItemsProvider {
  public get id(): string { return "appui-react:StandardNavigationToolsUiItemsProvider"; }

  constructor(private defaultNavigationTools?: DefaultNavigationTools) { }

  public provideToolbarButtonItems(_stageId: string, _stageUsage: string, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation, _stageAppData?: any): CommonToolbarItem[] {
    const items: CommonToolbarItem[] = [];
    if (toolbarUsage === ToolbarUsage.ViewNavigation && toolbarOrientation === ToolbarOrientation.Horizontal) {

      if (!this.defaultNavigationTools || !this.defaultNavigationTools.horizontal || this.defaultNavigationTools.horizontal.rotateView)
        items.push(ToolbarHelper.createToolbarItemFromItemDef(10, CoreTools.rotateViewCommand));

      if (!this.defaultNavigationTools || !this.defaultNavigationTools.horizontal || this.defaultNavigationTools.horizontal.panView)
        items.push(ToolbarHelper.createToolbarItemFromItemDef(20, CoreTools.panViewCommand));

      if (!this.defaultNavigationTools || !this.defaultNavigationTools.horizontal || this.defaultNavigationTools.horizontal.fitView) {
        items.push(ToolbarHelper.createToolbarItemFromItemDef(30, CoreTools.fitViewCommand));
      }

      if (!this.defaultNavigationTools || !this.defaultNavigationTools.horizontal || this.defaultNavigationTools.horizontal.windowArea) {
        items.push(ToolbarHelper.createToolbarItemFromItemDef(40, CoreTools.windowAreaCommand));
      }

      if (!this.defaultNavigationTools || !this.defaultNavigationTools.horizontal || this.defaultNavigationTools.horizontal.viewUndoRedo) {
        items.push(ToolbarHelper.createToolbarItemFromItemDef(50, CoreTools.viewUndoCommand));
        items.push(ToolbarHelper.createToolbarItemFromItemDef(60, CoreTools.viewRedoCommand));
      }

    } else /* istanbul ignore else */if (toolbarUsage === ToolbarUsage.ViewNavigation && toolbarOrientation === ToolbarOrientation.Vertical) {

      if (!this.defaultNavigationTools || !this.defaultNavigationTools.vertical || this.defaultNavigationTools.vertical.setupWalkCamera)
        items.push(ToolbarHelper.createToolbarItemFromItemDef(5, CoreTools.setupCameraWalkTool));

      if (!this.defaultNavigationTools || !this.defaultNavigationTools.vertical || this.defaultNavigationTools.vertical.walk)
        items.push(ToolbarHelper.createToolbarItemFromItemDef(10, CoreTools.walkViewCommand));

      if (!this.defaultNavigationTools || !this.defaultNavigationTools.vertical || this.defaultNavigationTools.vertical.toggleCamera)
        items.push(ToolbarHelper.createToolbarItemFromItemDef(20, CoreTools.toggleCameraViewCommand));
    }
    return items;
  }
}
