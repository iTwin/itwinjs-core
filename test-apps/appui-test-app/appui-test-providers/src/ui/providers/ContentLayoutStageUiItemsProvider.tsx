/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable react/display-name */

import {
  BackstageItem, BackstageItemUtilities, CommonStatusBarItem, CommonToolbarItem,
  StageUsage,
  StatusBarSection,
  ToolbarOrientation, ToolbarUsage, UiItemsManager, UiItemsProvider,
} from "@itwin/appui-abstract";
import * as React from "react";
import { StatusBarItemUtilities, ToolbarHelper } from "@itwin/appui-react";
import { getSplitSingleViewportCommandDef, RestoreSavedContentLayoutTool, SaveContentLayoutTool } from "../../tools/ContentLayoutTools";
import { AppUiTestProviders } from "../../AppUiTestProviders";
import { getCustomViewSelectorPopupItem } from "../buttons/ViewSelectorPanel";
import { ContentLayoutStage } from "../frontstages/ContentLayout";
import { DisplayStyleField } from "../statusfields/DisplayStyleField";

export class ContentLayoutStageUiItemsProvider implements UiItemsProvider {
  public static providerId = "appui-test-providers:content-layout-stage-items-provider";
  public readonly id = ContentLayoutStageUiItemsProvider.providerId;

  constructor(localizationNamespace: string) {
    RestoreSavedContentLayoutTool.register(localizationNamespace);
    SaveContentLayoutTool.register(localizationNamespace);
  }

  public static register(localizationNamespace: string) {
    UiItemsManager.register(new ContentLayoutStageUiItemsProvider(localizationNamespace), { stageIds: [ContentLayoutStage.stageId] });
  }

  public static unregister() {
    UiItemsManager.unregister(ContentLayoutStageUiItemsProvider.providerId);
  }

  public provideToolbarButtonItems(stageId: string, _stageUsage: string, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation): CommonToolbarItem[] {
    const allowedStages = [ContentLayoutStage.stageId];
    if (allowedStages.includes(stageId)) {
      if (toolbarUsage === ToolbarUsage.ContentManipulation && toolbarOrientation === ToolbarOrientation.Horizontal) {
        const items: CommonToolbarItem[] = [];
        items.push(ToolbarHelper.createToolbarItemFromItemDef(15, getSplitSingleViewportCommandDef(), { groupPriority: 3000 }));
        return items;
      } else if (toolbarUsage === ToolbarUsage.ViewNavigation && toolbarOrientation === ToolbarOrientation.Vertical) {
        const items: CommonToolbarItem[] = [];
        items.push(ToolbarHelper.createToolbarItemFromItemDef(10, SaveContentLayoutTool.toolItemDef, { groupPriority: 3000 }));
        items.push(ToolbarHelper.createToolbarItemFromItemDef(15, RestoreSavedContentLayoutTool.toolItemDef, { groupPriority: 3000 }));
        items.push(getCustomViewSelectorPopupItem(20, 3000));
        return items;
      }
    }
    return [];
  }

  public provideStatusBarItems(_stageId: string, stageUsage: string): CommonStatusBarItem[] {
    const statusBarItems: CommonStatusBarItem[] = [];
    if (stageUsage === StageUsage.General) {

      statusBarItems.push(
        StatusBarItemUtilities.createStatusBarItem("DisplayStyle", StatusBarSection.Center, 400, <DisplayStyleField />),
      );
    }
    return statusBarItems;
  }
  public provideBackstageItems(): BackstageItem[] {
    const label = AppUiTestProviders.translate("backstage.contentLayoutFrontstageLabel");
    return [
      BackstageItemUtilities.createStageLauncher(ContentLayoutStage.stageId, 300, 2, label, undefined, undefined),
    ];
  }

}
