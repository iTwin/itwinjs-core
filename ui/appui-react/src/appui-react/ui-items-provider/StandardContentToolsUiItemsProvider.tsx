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
  CommonStatusBarItem, CommonToolbarItem,
  StatusBarSection, ToolbarOrientation, ToolbarUsage, UiItemProviderOverrides,
  UiItemsManager, UiItemsProvider,
} from "@itwin/appui-abstract";
import { SelectionContextToolDefinitions } from "../selection/SelectionContextItemDef";
import { StatusBarItemUtilities } from "../statusbar/StatusBarItemUtilities";
import { withStatusFieldProps } from "../statusbar/withStatusFieldProps";
import { SectionsStatusField } from "../statusfields/SectionsField";
import { ToolbarHelper } from "../toolbar/ToolbarHelper";
import { CoreTools } from "../tools/CoreToolDefinitions";
import { DefaultContentTools, getGroupPriority } from "./StandardContentToolsProvider";

/**
 * @beta
 */
export class StandardContentToolsUiItemsProvider implements UiItemsProvider {
  public get id(): string { return "appui-react:StandardContentToolsUiItemsProvider"; }

  public static register(defaultContentTools?: DefaultContentTools, overrides?: UiItemProviderOverrides) {
    const provider = new StandardContentToolsUiItemsProvider(defaultContentTools);
    UiItemsManager.register(provider, overrides);

    // register core commands not automatically registered
    ViewClipByPlaneTool.register();
    return provider;
  }

  constructor(private defaultContextTools?: DefaultContentTools) { }

  public provideToolbarButtonItems(_stageId: string, _stageUsage: string, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation, stageAppData?: any): CommonToolbarItem[] {
    const items: CommonToolbarItem[] = [];

    if (toolbarUsage === ToolbarUsage.ContentManipulation && toolbarOrientation === ToolbarOrientation.Horizontal) {
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

    } else /* istanbul ignore else */ if (toolbarUsage === ToolbarUsage.ContentManipulation && toolbarOrientation === ToolbarOrientation.Vertical) {
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

  public provideStatusBarItems(_stageId: string, _stageUsage: string, _stageAppData?: any): CommonStatusBarItem[] {
    const statusBarItems: CommonStatusBarItem[] = [];

    // if the sectionGroup tools are to be shown then we want the status field added to allow clearing or manipulation the section
    if (this.defaultContextTools?.vertical?.sectionGroup) {
      const Sections = withStatusFieldProps(SectionsStatusField);
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("uifw.Sections", StatusBarSection.Center, 20, <Sections hideWhenUnused />));
    }

    return statusBarItems;
  }
}
