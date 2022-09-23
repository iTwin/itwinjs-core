/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable react/display-name */

import * as React from "react";
import {
  AbstractWidgetProps, BackstageItem, BackstageItemUtilities, CommonToolbarItem, StagePanelLocation, StagePanelSection,
  ToolbarOrientation, ToolbarUsage, UiItemsManager, UiItemsProvider, WidgetState,
} from "@itwin/appui-abstract";
import { ToolbarHelper } from "@itwin/appui-react";
import { getToggleCustomOverlayCommandItemDef, WidgetApiStage } from "../frontstages/WidgetApiStage";
import { FloatingLayoutInfo, LayoutControls, LayoutInfo } from "../widgets/LayoutWidget";
import { AppUiTestProviders } from "../../AppUiTestProviders";
import { SetWidgetStateTool } from "../../tools/UiLayoutTools";
import { }

/**
 * WidgetApiStageUiItemsProvider provides widget in the bottom panel that can exercise the Widget API on Widgets in the other panels.
 * Widgets may be hidden, shown, floated, popped out etc. using the controls in the bottom panel.
 */
export class WidgetApiStageUiItemsProvider implements UiItemsProvider {
  public static providerId = "appui-test-providers:widget-api-stage";
  public readonly id = WidgetApiStageUiItemsProvider.providerId;

  public static register(localizationNamespace: string) {
    UiItemsManager.register(new WidgetApiStageUiItemsProvider(localizationNamespace), { stageIds: [WidgetApiStage.stageId] });
    SetWidgetStateTool.register(localizationNamespace);
  }

  constructor(_localizationNamespace: string) {
    // register any tools here
  }

  public static unregister() {
    UiItemsManager.unregister(WidgetApiStageUiItemsProvider.providerId);
  }

  private getLeftPanelWidgets(section?: StagePanelSection | undefined) {
    const widgets: AbstractWidgetProps[] = [];

    if (section === StagePanelSection.Start) {
      widgets.push({
        id: "WL-A",
        label: "WL-A",
        icon: "icon-app-1",
        canPopout: true,
        defaultState: WidgetState.Open,
        getWidgetContent: () => <h2>Left WL-A</h2>,
        hideWithUiWhenFloating: true,
      });
    } else if (section === StagePanelSection.End) {
      widgets.push({
        id: "WL-1",
        label: "WL-1",
        icon: "icon-smiley-happy",
        canPopout: false,
        getWidgetContent: () => <h2>Left WL-1</h2>,
      });
      widgets.push({
        id: "WL-2",
        label: "WL-2",
        icon: "icon-smiley-sad",
        defaultState: WidgetState.Open,
        canPopout: true,
        getWidgetContent: () => <h2>Left WL-2</h2>,
      });
      widgets.push({
        id: "WL-3",
        label: "WL-3",
        icon: "icon-smiley-happy-very",
        canPopout: true,
        getWidgetContent: () => <h2>Left WL-3</h2>,
      });
    }
    return widgets;
  }

  private getRightPanelWidgets(section?: StagePanelSection | undefined) {
    const widgets: AbstractWidgetProps[] = [];

    if (section === StagePanelSection.Start) {
      widgets.push({
        id: "WR-A",
        label: "WR-A",
        icon: "icon-text-align-text-align-left",
        canPopout: true,
        defaultState: WidgetState.Open,
        getWidgetContent: () => <h2>Right WR-A</h2>,
      });
      widgets.push({
        id: "WR-B",
        label: "WR-B",
        icon: "icon-text-align-text-align-right",
        canPopout: true,
        defaultState: WidgetState.Hidden,
        getWidgetContent: () => <h2>Right WR-B</h2>,
      });
    } else if (section === StagePanelSection.End) {
      widgets.push({
        id: "WR-1",
        label: "WR-1",
        icon: "icon-text-align-text-align-center",
        canPopout: false,
        getWidgetContent: () => <h2>Right WR-1</h2>,
      });
      widgets.push({
        id: "WR-2",
        label: "WR-2",
        icon: "icon-text-align-text-align-justify",
        defaultState: WidgetState.Open,
        canPopout: true,
        getWidgetContent: () => <h2>Right WR-2</h2>,
      });
      widgets.push({
        id: "WR-3",
        label: "WR-3",
        icon: "icon-user",
        canPopout: true,
        getWidgetContent: () => <h2>Right WR-3</h2>,
      });
      widgets.push({
        id: "WR-4",
        label: "WR-4",
        icon: "icon-users",
        canPopout: true,
        defaultState: WidgetState.Open,
        getWidgetContent: () => <h2>Right WR-4</h2>,
      });
    }
    return widgets;
  }

  private getTopPanelWidgets(section?: StagePanelSection | undefined) {
    const widgets: AbstractWidgetProps[] = [];

    if (section === StagePanelSection.Start) {
      widgets.push({
        id: "WT-A",
        label: "WT-A",
        canPopout: true,
        defaultState: WidgetState.Open,
        getWidgetContent: () => <h2>Top WT-A</h2>,
        defaultFloatingSize: { width: 400, height: 600 },
        isFloatingStateWindowResizable: true,
      });
      widgets.push({
        id: "WT-B",
        label: "WT-B",
        canPopout: true,
        getWidgetContent: () => <h2>Top WT-B</h2>,
      });
    } else if (section === StagePanelSection.End) {
      widgets.push({
        id: "WT-1",
        label: "WT-1",
        canPopout: true,
        getWidgetContent: () => <h2>Top WT-1</h2>,
      });
      widgets.push({
        id: "WT-2",
        label: "WT-2",
        canPopout: true,
        defaultState: WidgetState.Open,
        getWidgetContent: () => <h2>Top WT-2</h2>,
      });
    }
    return widgets;
  }

  private getBottomPanelWidgets(section?: StagePanelSection | undefined) {
    const widgets: AbstractWidgetProps[] = [];

    if (section === StagePanelSection.Start) {
      widgets.push({
        id: "widget-info-Floating",
        label: "Floating Info",
        canPopout: true,
        defaultState: WidgetState.Open,
        getWidgetContent: () => <FloatingLayoutInfo />,
      });
      widgets.push({
        id: "widget-layout-info",
        label: "Layout Info",
        canPopout: true,
        getWidgetContent: () => <LayoutInfo />,
      });
    } else if (section === StagePanelSection.End) {
      widgets.push({
        id: "widget-layout-controls",
        label: "Layout Controls",
        defaultState: WidgetState.Open,
        getWidgetContent: () => <LayoutControls />,
      });
    }
    return widgets;
  }

  public provideWidgets(stageId: string, _stageUsage: string, location: StagePanelLocation, section?: StagePanelSection | undefined): ReadonlyArray<AbstractWidgetProps> {
    const allowedStages = [WidgetApiStage.stageId];
    if (allowedStages.includes(stageId)) {
      switch (location) {
        case StagePanelLocation.Left:
          return this.getLeftPanelWidgets(section);
        case StagePanelLocation.Right:
          return this.getRightPanelWidgets(section);
        case StagePanelLocation.Top:
          return this.getTopPanelWidgets(section);
        case StagePanelLocation.Bottom:
          return this.getBottomPanelWidgets(section);
      }
    }

    return [];
  }

  /** provide a toolbar button to set a value in redux store that toggles the display of the custom overlay */
  public provideToolbarButtonItems(stageId: string, _stageUsage: string, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation): CommonToolbarItem[] {
    const allowedStages = [WidgetApiStage.stageId];
    if (allowedStages.includes(stageId)) {
      if (toolbarUsage === ToolbarUsage.ContentManipulation && toolbarOrientation === ToolbarOrientation.Horizontal) {
        const items: CommonToolbarItem[] = [];
        items.push(ToolbarHelper.createToolbarItemFromItemDef(17, getToggleCustomOverlayCommandItemDef(), { groupPriority: 3000 }));
        return items;
      }
    }
    return [];
  }

  /** Add entry to activate this stage in the backstage. */
  public provideBackstageItems(): BackstageItem[] {
    const label = AppUiTestProviders.translate("backstage.widgetApiTestFrontstageLabel");
    return [
      BackstageItemUtilities.createStageLauncher(WidgetApiStage.stageId, 300, 2, label, undefined, undefined),
    ];
  }

}
