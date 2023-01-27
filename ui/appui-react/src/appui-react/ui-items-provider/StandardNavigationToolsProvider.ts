/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StandardUiItemsProvider
 */

import { BaseUiItemsProvider, CommonToolbarItem, ToolbarOrientation, ToolbarUsage, UiItemsManager } from "@itwin/appui-abstract";
import { ToolbarHelper } from "../toolbar/ToolbarHelper";
import { CoreTools } from "../tools/CoreToolDefinitions";
import { DefaultNavigationTools } from "./StandardNavigationToolsUiItemsProvider";

/* eslint-disable deprecation/deprecation */

/**
 * Provide standard tools for the ViewNavigationWidgetComposer.
 * @public
 */
export class StandardNavigationToolsProvider extends BaseUiItemsProvider {
  /**
   * static function to register the StandardContentToolsProvider
   * @param providerId - unique identifier for this instance of the provider. This is required in case separate packages want
   * to set up custom stage with their own subset of standard tools
   * @param defaultNavigationTools - if undefined all available tools are provided to stage. If defined only those
   * specific tool buttons are shown.
   * @param isSupportedStage - optional function that will be called to determine if tools should be added to current stage. If not set and
   * the current stage's `usage` is set to `StageUsage.General` then the provider will add items to frontstage.
   */
  public static register(providerId: string, defaultNavigationTools?: DefaultNavigationTools, isSupportedStage?: (stageId: string, stageUsage: string, stageAppData?: any) => boolean) {
    const provider = new StandardNavigationToolsProvider(providerId, defaultNavigationTools, isSupportedStage);
    UiItemsManager.register(provider);
    return provider;
  }

  constructor(providerId: string, private defaultNavigationTools?: DefaultNavigationTools, isSupportedStage?: (stageId: string, stageUsage: string, stageAppData?: any) => boolean) {
    super(providerId, isSupportedStage);
  }

  public override provideToolbarButtonItemsInternal(_stageId: string, _stageUsage: string, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation, _stageAppData?: any): CommonToolbarItem[] {
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

    } else if (toolbarUsage === ToolbarUsage.ViewNavigation && toolbarOrientation === ToolbarOrientation.Vertical) {

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
