/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { CommsFibersListWidgetComponent } from "../widgets/CommsFibersListWidgetComponent";
import * as React from "react";
import {
  AbstractStatusBarItemUtilities,
  AbstractWidgetProps, AbstractZoneLocation, CommonStatusBarItem, CommonToolbarItem, StagePanelLocation,
  StagePanelSection, StageUsage, StatusBarSection, ToolbarOrientation, ToolbarUsage, UiItemsProvider, WidgetState,
} from "@itwin/appui-abstract";
import { NetworkTracingFrontstage } from "../frontstages/NetworkTracing";
import { PresentationPropertyGridWidget, PresentationPropertyGridWidgetControl } from "../widgets/PresentationPropertyGridWidget";
import { SampleTool } from "../../tools/SampleTool";
import statusBarButtonSvg from "../icons/StatusField.svg?sprite";
import { UnitsPopupUiDataProvider } from "../dialogs/UnitsPopup";
import { IModelApp } from "@itwin/core-frontend";

export class ExtensionUiItemsProvider implements UiItemsProvider {
  public readonly id = "ExtensionUiItemsProvider";

  public provideWidgets(stageId: string, stageUsage: string, location: StagePanelLocation, section?: StagePanelSection, _zoneLocation?: AbstractZoneLocation): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];
    if (stageId === "DefaultFrontstage" && location === StagePanelLocation.Right && section === StagePanelSection.Start) {
      const widget: AbstractWidgetProps = {
        id: "comms:fibersListWidget",
        label: "Fibers",
        defaultState: WidgetState.Hidden,
        isFloatingStateSupported: true,
        // eslint-disable-next-line react/display-name
        getWidgetContent: () => {
          return <CommsFibersListWidgetComponent />;
        },
      };
      widgets.push(widget);
    }

    if ((stageUsage === StageUsage.General || stageId === NetworkTracingFrontstage.stageId) &&
      (location === StagePanelLocation.Right && section === StagePanelSection.End)) {
      {
        widgets.push({
          id: PresentationPropertyGridWidgetControl.id,
          icon: PresentationPropertyGridWidgetControl.iconSpec,  // icon required if uiVersion === "1"
          label: PresentationPropertyGridWidgetControl.label,
          defaultState: WidgetState.Open,
          getWidgetContent: () => <PresentationPropertyGridWidget />, // eslint-disable-line react/display-name
          canPopout: true,  // canPopout ignore if uiVersion === "1"
        });
      }
    }

    return widgets;
  }

  public provideToolbarButtonItems(_stageId: string, stageUsage: string, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation): CommonToolbarItem[] {
    if (stageUsage === StageUsage.General && toolbarUsage === ToolbarUsage.ContentManipulation && toolbarOrientation === ToolbarOrientation.Horizontal) {
      return [SampleTool.getActionButtonDef(1000)];
    }
    return [];
  }

  public provideStatusBarItems(_stageId: string, stageUsage: string): CommonStatusBarItem[] {
    const unitsIcon = `svg:${statusBarButtonSvg}`;
    const statusBarItems: CommonStatusBarItem[] = [];
    if (stageUsage === StageUsage.General) {
      statusBarItems.push(
        AbstractStatusBarItemUtilities.createActionItem("UiTestExtension:UnitsStatusBarItem", StatusBarSection.Center, 100, unitsIcon, IModelApp.localization.getLocalizedString("uiTestExtension:StatusBar.UnitsFlyover"),
          () => {
            IModelApp.uiAdmin.openDialog(new UnitsPopupUiDataProvider(IModelApp.localization), IModelApp.localization.getLocalizedString("uiTestExtension:StatusBar.Units"),
              true, "uiTestExtension:units-popup", { movable: true, width: 280, minWidth: 280 });
          }
        ));
    }
    return statusBarItems;
  }

}
