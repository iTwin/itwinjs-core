/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { AbstractWidgetProps, AbstractZoneLocation, CommonToolbarItem, StagePanelLocation, StagePanelSection, StageUsage, ToolbarOrientation, ToolbarUsage, UiItemsProvider, WidgetState } from "@itwin/appui-abstract";
import { ToolbarHelper, UiFramework } from "@itwin/appui-react";
import { MapFeatureInfoWidget } from "./widget/FeatureInfoWidget";
import { MapFeatureInfoOptions } from "./Interfaces";
import { MapLayersUI } from "../mapLayers";
import { DefaultMapFeatureInfoTool, getDefaultMapFeatureInfoToolItemDef } from "./MapFeatureInfoTool";

export class FeatureInfoUiItemsProvider implements UiItemsProvider {
  public readonly id = "FeatureInfoUiItemsProvider";
  public static readonly widgetId = "map-layers:mapFeatureInfoWidget";

  public constructor(private _featureInfoOpts: MapFeatureInfoOptions) { }

  public provideToolbarButtonItems(
    _stageId: string,
    stageUsage: string,
    toolbarUsage: ToolbarUsage,
    toolbarOrientation: ToolbarOrientation,
  ): CommonToolbarItem[] {
    if (
      !this._featureInfoOpts?.disableDefaultFeatureInfoTool &&
      stageUsage === StageUsage.General &&
      toolbarUsage === ToolbarUsage.ContentManipulation &&
      toolbarOrientation === ToolbarOrientation.Vertical
    ) {
      DefaultMapFeatureInfoTool.register(MapLayersUI.localizationNamespace);
      return [
        ToolbarHelper.createToolbarItemFromItemDef(60, getDefaultMapFeatureInfoToolItemDef()),
      ];
    }

    return [];
  }

  // eslint-disable-next-line deprecation/deprecation
  public provideWidgets(_stageId: string, stageUsage: string, location: StagePanelLocation, section?: StagePanelSection, zoneLocation?: AbstractZoneLocation): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];

    // eslint-disable-next-line deprecation/deprecation
    if ((undefined === section && stageUsage === StageUsage.General && zoneLocation === AbstractZoneLocation.BottomRight) ||
      (stageUsage === StageUsage.General && location === StagePanelLocation.Right && section === StagePanelSection.End && "1" !== UiFramework.uiVersion)) { // eslint-disable-line deprecation/deprecation
      widgets.push({
        id: FeatureInfoUiItemsProvider.widgetId,
        label: MapLayersUI.localization.getLocalizedString("mapLayers:FeatureInfoWidget.Label"),
        icon: "icon-map",
        getWidgetContent: () => <MapFeatureInfoWidget featureInfoOpts={this._featureInfoOpts} />, // eslint-disable-line react/display-name
        defaultState: WidgetState.Closed,
      });
    }

    return widgets;
  }
}
