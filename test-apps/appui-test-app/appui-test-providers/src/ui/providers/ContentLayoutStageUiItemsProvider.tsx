/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable react/display-name */

import {
  CommonToolbarItem, StageUsage,
} from "@itwin/appui-abstract";
import * as React from "react";
import { AnyStatusBarItem, BackstageItem, BackstageItemUtilities, CommonWidgetProps, StagePanelLocation, StagePanelSection, StatusBarItemUtilities, StatusBarSection, ToolbarHelper, ToolbarOrientation, ToolbarUsage, UiItemsManager, UiItemsProvider, WidgetState } from "@itwin/appui-react";
import { getSplitSingleViewportCommandDef, RestoreSavedContentLayoutTool, SaveContentLayoutTool } from "../../tools/ContentLayoutTools";
import { AppUiTestProviders } from "../../AppUiTestProviders";
import { getCustomViewSelectorPopupItem } from "../buttons/ViewSelectorPanel";
import { ContentLayoutStage } from "../frontstages/ContentLayout";
import { DisplayStyleField } from "../statusfields/DisplayStyleField";
import { ViewportWidgetComponent } from "../widgets/ViewportWidget";

/**
 * The ContentLayoutStageUiItemsProvider provides additional items only to the `ContentLayoutStage` frontstage.
 * This provider provides four tool buttons to:
 *  - toggle between a single view and two side-by-side views.
 *  - activate a tool to save the current view layout and viewstate shown in each view.
 *  - activate a tool to restore the previous saved state for the current stage.
 *  - open a popup to change the viewstate of the "active" view to that selected from the popup list.
 * Note: If you want to allow the user to perform an action via the key-in palette, a `Tool` must be created and registered.
 *       The Key-in Palette is open using keystroke Ctrl+F2 and shows the keyins from all the registered Tools.
 * This provider also adds a display style picker to the status bar. This item allows user to apply a display style to the
 * "active" view. If the display style for a view contains a schedule script one of the default view overlay components will
 * display to allow user to play the animation.
 */
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

  public provideWidgets(_stageId: string, stageUsage: string, location: StagePanelLocation,
    section?: StagePanelSection): ReadonlyArray<CommonWidgetProps> {
    const widgets: CommonWidgetProps[] = [];
    if (stageUsage === StageUsage.General && location === StagePanelLocation.Bottom && section === StagePanelSection.Start) {
      const widget: CommonWidgetProps = {
        id: "appui-test-providers:viewport-widget",
        label: "Viewport",
        icon: "icon-bentley-systems",
        defaultState: WidgetState.Floating,
        isFloatingStateSupported: true,
        floatingContainerId: "appui-test-providers:viewport-widget",
        // eslint-disable-next-line react/display-name
        getWidgetContent: () => <ViewportWidgetComponent />,
      };

      widgets.push(widget);
    }
    return widgets;
  }

  public provideStatusBarItems(_stageId: string, stageUsage: string): AnyStatusBarItem[] {
    const statusBarItems: AnyStatusBarItem[] = [];
    if (stageUsage === StageUsage.General) {

      statusBarItems.push(
        StatusBarItemUtilities.createCustomItem("DisplayStyle", StatusBarSection.Center, 400, <DisplayStyleField />),
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
