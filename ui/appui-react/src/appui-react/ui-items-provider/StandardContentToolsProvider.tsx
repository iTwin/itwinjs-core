/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StandardUiItemsProvider
 */

import * as React from "react";
import { ViewClipByPlaneTool } from "@itwin/core-frontend";
import {
  BaseUiItemsProvider, CommonStatusBarItem, CommonToolbarItem,
  StatusBarSection, ToolbarOrientation, ToolbarUsage, UiItemsManager,
} from "@itwin/appui-abstract";
import { SelectionContextToolDefinitions } from "../selection/SelectionContextItemDef";
import { StatusBarItemUtilities } from "../statusbar/StatusBarItemUtilities";
import { withStatusFieldProps } from "../statusbar/withStatusFieldProps";
import { SectionsStatusField } from "../statusfields/SectionsField";
import { ToolbarHelper } from "../toolbar/ToolbarHelper";
import { CoreTools } from "../tools/CoreToolDefinitions";
import { DefaultContentTools } from "./StandardContentToolsUiItemsProvider";

/**
 * Defines options that may be set in frontstage app data to control what group priorities
 * to use for each tool button that can be added by this extension. Defining groupIds is optional
 * and only required if use wants to override the default grouping. This application data is statically
 * set in the FrontstageProvider.
 * @example
 * ```
 * const applicationData = {
 *    defaultContentTools: {
 *      vertical: {
 *        selectElementGroupPriority: 100,
 *        measureGroupPriority: 200,
 *        selectionGroupPriority: 300,
 *      },
 *      horizontal: {
 *        clearSelectionGroupPriority: 100,
 *        overridesGroupPriority: 200,
 *      },
 *    },
 *  }
 *
 * ```
 * @public
 */
export interface DefaultContentToolsAppData {
  defaultContentTools?: {
    vertical?: {
      selectElementGroupPriority?: number;
      measureGroupPriority?: number;
      selectionGroupPriority?: number;
    };
    horizontal?: {
      clearSelectionGroupPriority?: number;
      overridesGroupPriority?: number;
    };
  };
}

function getGroupPriority(potentialId: any, defaultValue: number) {
  if (undefined === potentialId)
    return defaultValue;

  // istanbul ignore else
  if (typeof potentialId === "number") {
    return potentialId;
  }

  // istanbul ignore next
  return defaultValue;
}

/**
 * Provide standard tools for the ContentManipulationWidgetComposer.
 * @public
 */
export class StandardContentToolsProvider extends BaseUiItemsProvider {
  /**
   * static function to register the StandardContentToolsProvider
   * @param providerId - unique identifier for this instance of the provider.  This is required in case separate packages want
   * to set up custom stage with their own subset of standard tools.
   * @param defaultContentTools - if undefined all available tools are provided to stage. If defined only those
   * specific tool buttons are shown.
   * @param isSupportedStage - optional function that will be called to determine if tools should be added to current stage. If not set and
   * the current stage's `usage` is set to `StageUsage.General` then the provider will add items to frontstage.
   */
  public static register(providerId: string, defaultContentTools?: DefaultContentTools, isSupportedStage?: (stageId: string, stageUsage: string, stageAppData?: any) => boolean) {
    const provider = new StandardContentToolsProvider(providerId, defaultContentTools, isSupportedStage);
    UiItemsManager.register(provider);

    // register core commands not automatically registered
    ViewClipByPlaneTool.register();
    return provider;
  }

  constructor(providerId: string, private defaultContentTools?: DefaultContentTools, isSupportedStage?: (stageId: string, stageUsage: string, stageAppData?: any) => boolean) {
    super(providerId, isSupportedStage);
  }

  public override provideToolbarButtonItemsInternal(_stageId: string, _stageUsage: string, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation, stageAppData?: any): CommonToolbarItem[] {
    const items: CommonToolbarItem[] = [];

    if (toolbarUsage === ToolbarUsage.ContentManipulation && toolbarOrientation === ToolbarOrientation.Horizontal) {
      const clearSelectionGroupPriority = getGroupPriority(stageAppData?.defaultContentTools?.horizontal?.clearSelectionGroupPriority, 10);
      const overridesGroupPriority = getGroupPriority(stageAppData?.defaultContentTools?.horizontal?.overridesGroupPriority, 20);

      if (!this.defaultContentTools || !this.defaultContentTools.horizontal || this.defaultContentTools.horizontal.clearSelection)
        items.push(ToolbarHelper.createToolbarItemFromItemDef(10, CoreTools.clearSelectionItemDef, { groupPriority: clearSelectionGroupPriority }));

      if (!this.defaultContentTools || !this.defaultContentTools.horizontal || this.defaultContentTools.horizontal.clearDisplayOverrides)
        items.push(ToolbarHelper.createToolbarItemFromItemDef(20, SelectionContextToolDefinitions.clearHideIsolateEmphasizeElementsItemDef, { groupPriority: overridesGroupPriority }));

      if (!this.defaultContentTools || !this.defaultContentTools.horizontal || this.defaultContentTools.horizontal.hide) {
        if (this.defaultContentTools?.horizontal?.hide === "group")
          items.push(ToolbarHelper.createToolbarItemFromItemDef(30, SelectionContextToolDefinitions.hideSectionToolGroup, { groupPriority: overridesGroupPriority }));
        else
          items.push(ToolbarHelper.createToolbarItemFromItemDef(30, SelectionContextToolDefinitions.hideElementsItemDef, { groupPriority: overridesGroupPriority }));
      }

      if (!this.defaultContentTools || !this.defaultContentTools.horizontal || this.defaultContentTools.horizontal.isolate) {
        if (this.defaultContentTools?.horizontal?.isolate === "group")
          items.push(ToolbarHelper.createToolbarItemFromItemDef(40, SelectionContextToolDefinitions.isolateSelectionToolGroup, { groupPriority: overridesGroupPriority }));
        else
          items.push(ToolbarHelper.createToolbarItemFromItemDef(40, SelectionContextToolDefinitions.isolateElementsItemDef, { groupPriority: overridesGroupPriority }));
      }

      if (!this.defaultContentTools || !this.defaultContentTools.horizontal || this.defaultContentTools.horizontal.emphasize) {
        items.push(ToolbarHelper.createToolbarItemFromItemDef(50, SelectionContextToolDefinitions.emphasizeElementsItemDef, { groupPriority: overridesGroupPriority }));
      }

    } else /* istanbul ignore else */ if (toolbarUsage === ToolbarUsage.ContentManipulation && toolbarOrientation === ToolbarOrientation.Vertical) {
      const selectElementGroupPriority = getGroupPriority(stageAppData?.defaultContentTools?.vertical?.selectElementGroupPriority, 10);
      const measureGroupPriority = getGroupPriority(stageAppData?.defaultContentTools?.vertical?.measureGroupPriority, 10);
      const selectionGroupPriority = getGroupPriority(stageAppData?.defaultContentTools?.vertical?.selectionGroupPriority, 10);

      if (!this.defaultContentTools || !this.defaultContentTools.vertical || this.defaultContentTools.vertical.selectElement)
        items.push(ToolbarHelper.createToolbarItemFromItemDef(10, CoreTools.selectElementCommand, { groupPriority: selectElementGroupPriority }));

      if (!this.defaultContentTools || !this.defaultContentTools.vertical || this.defaultContentTools.vertical.measureGroup)
        items.push(ToolbarHelper.createToolbarItemFromItemDef(20, CoreTools.measureToolGroup, { groupPriority: measureGroupPriority }));

      if (!this.defaultContentTools || !this.defaultContentTools.vertical || this.defaultContentTools.vertical.sectionGroup)
        items.push(ToolbarHelper.createToolbarItemFromItemDef(30, CoreTools.sectionToolGroup, { groupPriority: selectionGroupPriority }));
    }
    return items;
  }

  public override provideStatusBarItemsInternal(_stageId: string, _stageUsage: string, _stageAppData?: any): CommonStatusBarItem[] {
    const statusBarItems: CommonStatusBarItem[] = [];

    // if the sectionGroup tools are to be shown then we want the status field added to allow clearing or manipulation the section
    if (this.defaultContentTools?.vertical?.sectionGroup) {
      // eslint-disable-next-line deprecation/deprecation
      const Sections = withStatusFieldProps(SectionsStatusField);
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("uifw.Sections", StatusBarSection.Center, 20, <Sections hideWhenUnused />));
    }

    return statusBarItems;
  }
}
