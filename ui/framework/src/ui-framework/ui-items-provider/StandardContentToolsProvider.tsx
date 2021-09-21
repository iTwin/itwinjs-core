/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StandardUiItemsProvider
 */

import * as React from "react";
import { CommonStatusBarItem, CommonToolbarItem, StageUsage, StatusBarSection, ToolbarOrientation, ToolbarUsage, UiItemsManager, UiItemsProvider } from "@bentley/ui-abstract";
import { SelectionContextToolDefinitions } from "../selection/SelectionContextItemDef";
import { StatusBarItemUtilities } from "../statusbar/StatusBarItemUtilities";
import { withStatusFieldProps } from "../statusbar/withStatusFieldProps";
import { SectionsStatusField } from "../statusfields/SectionsField";
import { ToolbarHelper } from "../toolbar/ToolbarHelper";
import { CoreTools } from "../tools/CoreToolDefinitions";

/**
 * Defines options that may be set in frontstage app data to control what group priorities
 * to use for each tool button that can be added by this extension.
 * @beta
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

/** Defines what tools to include.
 * @beta
 */
export interface DefaultContentTools {
  horizontal?: {
    clearSelection?: boolean;
    clearDisplayOverrides?: boolean;
    /** if group then group button is shown to allow user to hide by element, category, model */
    hide?: "group" | "element";
    /** if group then group button is shown to allow user to isolate by element, category, model */
    isolate?: "group" | "element";
    /** only element is currently support for emphasize */
    emphasize?: "element";
  };
  vertical?: {
    selectElement?: boolean;
    measureGroup?: boolean;
    sectionGroup?: boolean;
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

/** Provide standard tools for the ContentManipulationWidgetComposer
 * @beta
 */
export class StandardContentToolsProvider implements UiItemsProvider {
  public static providerId = "uifw:StandardContentToolsProvider";
  public readonly id = StandardContentToolsProvider.providerId;

  public static register(defaultContextTools?: DefaultContentTools, isSupportedStage?: (stageId: string, stageUsage: string, stageAppData?: any) => boolean) {
    UiItemsManager.register(new StandardContentToolsProvider(defaultContextTools, isSupportedStage));
  }

  public static unregister() {
    UiItemsManager.unregister(StandardContentToolsProvider.providerId);
  }

  constructor(private defaultContextTools?: DefaultContentTools, private isSupportedStage?: (stageId: string, stageUsage: string, stageAppData?: any) => boolean) { }

  public provideToolbarButtonItems(stageId: string, stageUsage: string, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation, stageAppData?: any): CommonToolbarItem[] {
    const items: CommonToolbarItem[] = [];
    let provideToStage = false;

    if (this.isSupportedStage) {
      provideToStage = this.isSupportedStage(stageId, stageUsage, stageAppData);
    } else {
      provideToStage = (stageUsage === StageUsage.General);
    }

    if (provideToStage && toolbarUsage === ToolbarUsage.ContentManipulation && toolbarOrientation === ToolbarOrientation.Horizontal) {
      const clearSelectionGroupPriority = getGroupPriority(stageAppData?.defaultContentTools?.horizontal?.clearSelectionGroupPriority, 10);
      const overridesGroupPriority = getGroupPriority(stageAppData?.defaultContentTools?.horizontal?.overridesGroupPriority, 20);

      if (!this.defaultContextTools || !this.defaultContextTools.horizontal || this.defaultContextTools.horizontal.clearSelection)
        items.push(ToolbarHelper.createToolbarItemFromItemDef(10, CoreTools.clearSelectionItemDef, { groupPriority: clearSelectionGroupPriority }));

      if (!this.defaultContextTools || !this.defaultContextTools.horizontal || this.defaultContextTools.horizontal.clearDisplayOverrides)
        items.push(ToolbarHelper.createToolbarItemFromItemDef(20, SelectionContextToolDefinitions.clearHideIsolateEmphasizeElementsItemDef, { groupPriority: overridesGroupPriority }));

      if (!this.defaultContextTools || !this.defaultContextTools.horizontal || this.defaultContextTools.horizontal.hide) {
        if (this.defaultContextTools?.horizontal?.hide === "group")
          items.push(ToolbarHelper.createToolbarItemFromItemDef(30, SelectionContextToolDefinitions.hideSectionToolGroup, { groupPriority: overridesGroupPriority }));
        else
          items.push(ToolbarHelper.createToolbarItemFromItemDef(30, SelectionContextToolDefinitions.hideElementsItemDef, { groupPriority: overridesGroupPriority }));
      }

      if (!this.defaultContextTools || !this.defaultContextTools.horizontal || this.defaultContextTools.horizontal.isolate) {
        if (this.defaultContextTools?.horizontal?.isolate === "group")
          items.push(ToolbarHelper.createToolbarItemFromItemDef(40, SelectionContextToolDefinitions.isolateSelectionToolGroup, { groupPriority: overridesGroupPriority }));
        else
          items.push(ToolbarHelper.createToolbarItemFromItemDef(40, SelectionContextToolDefinitions.isolateElementsItemDef, { groupPriority: overridesGroupPriority }));
      }

      if (!this.defaultContextTools || !this.defaultContextTools.horizontal || this.defaultContextTools.horizontal.emphasize) {
        items.push(ToolbarHelper.createToolbarItemFromItemDef(50, SelectionContextToolDefinitions.emphasizeElementsItemDef, { groupPriority: overridesGroupPriority }));
      }

    } else /* istanbul ignore else */ if (provideToStage && toolbarUsage === ToolbarUsage.ContentManipulation && toolbarOrientation === ToolbarOrientation.Vertical) {
      const selectElementGroupPriority = getGroupPriority(stageAppData?.defaultContentTools?.vertical?.selectElementGroupPriority, 10);
      const measureGroupPriority = getGroupPriority(stageAppData?.defaultContentTools?.vertical?.measureGroupPriority, 10);
      const selectionGroupPriority = getGroupPriority(stageAppData?.defaultContentTools?.vertical?.selectionGroupPriority, 10);

      if (!this.defaultContextTools || !this.defaultContextTools.vertical || this.defaultContextTools.vertical.selectElement)
        items.push(ToolbarHelper.createToolbarItemFromItemDef(10, CoreTools.selectElementCommand, { groupPriority: selectElementGroupPriority }));

      if (!this.defaultContextTools || !this.defaultContextTools.vertical || this.defaultContextTools.vertical.measureGroup)
        items.push(ToolbarHelper.createToolbarItemFromItemDef(20, CoreTools.measureToolGroup, { groupPriority: measureGroupPriority }));

      if (!this.defaultContextTools || !this.defaultContextTools.vertical || this.defaultContextTools.vertical.sectionGroup)
        items.push(ToolbarHelper.createToolbarItemFromItemDef(30, CoreTools.sectionToolGroup, { groupPriority: selectionGroupPriority }));
    }
    return items;
  }

  public provideStatusBarItems(stageId: string, stageUsage: string, stageAppData?: any): CommonStatusBarItem[] {
    const statusBarItems: CommonStatusBarItem[] = [];
    let provideToStage = false;

    // istanbul ignore else
    if (this.isSupportedStage) {
      provideToStage = this.isSupportedStage(stageId, stageUsage, stageAppData);
    } else {
      provideToStage = (stageUsage === StageUsage.General);
    }

    // istanbul ignore else
    if (provideToStage) {
      // if the sectionGroup tools are to be shown then we want the status field added to allow clearing or manipulation the section
      if (this.defaultContextTools?.vertical?.sectionGroup) {
        const Sections = withStatusFieldProps(SectionsStatusField);
        statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("uifw.Sections", StatusBarSection.Center, 20, <Sections hideWhenUnused />));
      }
    }

    return statusBarItems;
  }

}
