/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { AbstractWidgetProps, AbstractZoneLocation, StagePanelLocation, StagePanelSection, StageUsage, UiItemsProvider } from "@itwin/appui-abstract";
import { Localization } from "@itwin/core-common";
import { MapLayersWidget } from "./widget/MapLayersWidget";
import { UiFramework } from "@itwin/appui-react";
import { IModelApp } from "@itwin/core-frontend";
import { MapLayerOptions } from "./Interfaces";

export class MapLayersUiItemsProvider implements UiItemsProvider {
  public readonly id = "MapLayersUiItemsProvider";
  public static localization: Localization;
  private _mapLayerOptions?: MapLayerOptions;

  public constructor(localization: Localization, mapLayerOptions?: MapLayerOptions) {
    MapLayersUiItemsProvider.localization = localization;
    this._mapLayerOptions = mapLayerOptions ?? {
      hideExternalMapLayers: false,
      mapTypeOptions: { supportTileUrl: false, supportWmsAuthentication: true },
      fetchPublicMapLayerSources: false,
    };
  }

  // eslint-disable-next-line deprecation/deprecation
  public provideWidgets(_stageId: string, stageUsage: string, location: StagePanelLocation, section: StagePanelSection | undefined, zoneLocation?: AbstractZoneLocation): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];

    // eslint-disable-next-line deprecation/deprecation
    if ((undefined === section && stageUsage === StageUsage.General && zoneLocation === AbstractZoneLocation.CenterRight) ||
      (stageUsage === StageUsage.General && location === StagePanelLocation.Right && section === StagePanelSection.Start && "1" !== UiFramework.uiVersion)) {
      widgets.push({
        id: "map-layers:mapLayersWidget",
        label: IModelApp.localization.getLocalizedString("mapLayers:Widget.Label"),
        icon: "icon-map",
        getWidgetContent: () => <MapLayersWidget mapLayerOptions={this._mapLayerOptions} />, // eslint-disable-line react/display-name
      });
    }

    return widgets;
  }
}
