/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  AbstractStatusBarItemUtilities, AbstractWidgetProps, AbstractZoneLocation, BackstageItem, BackstageItemUtilities,
  CommonStatusBarItem, CommonToolbarItem, StagePanelLocation, StagePanelSection,
  StageUsage, StatusBarSection, ToolbarOrientation, ToolbarUsage, UiItemsProvider, WidgetState,
} from "@bentley/ui-abstract";
import { I18N } from "@bentley/imodeljs-i18n";
import { UiFramework } from "@bentley/ui-framework";
import { IModelApp } from "@bentley/imodeljs-frontend";
import statusBarButtonSvg from "./StatusField.svg?sprite"; // use once svg are working again.
import { UnitsPopupUiDataProvider } from "./UnitsPopup";
import { SampleTool } from "./tools/SampleTool";
import { ExtensionFrontstage } from "./Frontstage";
import { PresentationPropertyGridWidget, PresentationPropertyGridWidgetControl } from "./widgets/PresentationPropertyGridWidget";
export class ExtensionUiItemsProvider implements UiItemsProvider {
  public readonly id = "ExtensionUiItemsProvider";
  public static i18n: I18N;
  private _backstageItems?: BackstageItem[];

  public constructor(i18n: I18N) {
    ExtensionUiItemsProvider.i18n = i18n;
  }

  /** provideToolbarButtonItems() is called for each registered UI provider as the Frontstage is building toolbars. We are adding
   *  an action button to the ContentManipulation Horizontal toolbar in General use Frontstages. For more information, refer to
   *  the UiItemsProvider and Frontstage documentation on itwinjs.org.
   */
  public provideToolbarButtonItems(_stageId: string, stageUsage: string, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation): CommonToolbarItem[] {
    if (stageUsage === StageUsage.General && toolbarUsage === ToolbarUsage.ContentManipulation && toolbarOrientation === ToolbarOrientation.Horizontal) {
      return [SampleTool.getActionButtonDef(1000)];
    }
    return [];
  }

  /** provide backstage item to the host application */
  public provideBackstageItems(): BackstageItem[] {
    const label = ExtensionUiItemsProvider.i18n.translate("uiTestExtension:backstage.stageName");
    if (!this._backstageItems) {
      this._backstageItems = [
        BackstageItemUtilities.createStageLauncher(ExtensionFrontstage.id, 100, 10, label, undefined, undefined),
      ];
    }
    return this._backstageItems;
  }

  /** provideStatusBarItems() is called for each registered UI provider to allow the provider to add items to the StatusBar. For more information, see the UiItemsProvider and StatusBar
   * documentation on itwinjs.org.
   */
  public provideStatusBarItems(_stageId: string, stageUsage: string): CommonStatusBarItem[] {
    const unitsIcon = `svg:${statusBarButtonSvg}`;
    const statusBarItems: CommonStatusBarItem[] = [];
    if (stageUsage === StageUsage.General) {
      statusBarItems.push(
        AbstractStatusBarItemUtilities.createActionItem("UiTestExtension:UnitsStatusBarItem", StatusBarSection.Center, 100, unitsIcon, ExtensionUiItemsProvider.i18n.translate("uiTestExtension:StatusBar.UnitsFlyover"),
          () => {
            IModelApp.uiAdmin.openDialog(new UnitsPopupUiDataProvider(ExtensionUiItemsProvider.i18n), ExtensionUiItemsProvider.i18n.translate("uiTestExtension:StatusBar.Units"),
              true, "uiTestExtension:units-popup", { movable: true, width: 280, minWidth: 280 });
          }
        ));
    }
    return statusBarItems;
  }

  /** provideWidgets() is called for each registered UI provider to allow the provider to add widgets to a specific section of a stage panel.
   *  items to the StatusBar.
   */
  public provideWidgets(_stageId: string, stageUsage: string, location: StagePanelLocation, section: StagePanelSection | undefined, zoneLocation?: AbstractZoneLocation): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];
    // section will be undefined if uiVersion === "1" and in that case we can add widgets to the specified zoneLocation
    if ((undefined === section && stageUsage === StageUsage.General && zoneLocation === AbstractZoneLocation.BottomRight) ||
      (stageUsage === StageUsage.General && location === StagePanelLocation.Right && section === StagePanelSection.End && "1" !== UiFramework.uiVersion)) {
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
}
