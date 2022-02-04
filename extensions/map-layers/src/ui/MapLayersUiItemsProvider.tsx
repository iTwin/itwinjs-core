/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { AbstractWidgetProps, StagePanelLocation, StagePanelSection, StageUsage, UiItemsProvider } from "@itwin/appui-abstract";
import { Localization } from "@itwin/core-common";
import { MapLayersWidget } from "./widget/MapLayersWidget";
import { ConfigurableCreateInfo, WidgetControl } from "@itwin/appui-react";
import { IModelApp } from "@itwin/core-frontend";
import { MapFeatureInfoOptions, MapLayerOptions } from "./Interfaces";
import { MapFeatureInfoWidget } from "./widget/FeatureInfoWidget";

export class MapLayersUiItemsProvider implements UiItemsProvider {
  public readonly id = "MapLayersUiItemsProvider";
  public static localization: Localization;

  public constructor(localization: Localization) {
    MapLayersUiItemsProvider.localization = localization;
  }

  public provideWidgets(_stageId: string, stageUsage: string, location: StagePanelLocation, section: StagePanelSection | undefined): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];
    const mapLayerOptions: MapLayerOptions = {
      hideExternalMapLayers: false,
      mapTypeOptions: { supportTileUrl: false, supportWmsAuthentication: true },
      fetchPublicMapLayerSources: false,
    };

    if (stageUsage === StageUsage.General && location === StagePanelLocation.Right && section === StagePanelSection.Start) {
      widgets.push({
        id: "map-layers:mapLayersWidget",
        label: IModelApp.localization.getLocalizedString("mapLayers:Widget.Label"),
        icon: "icon-map",
        getWidgetContent: () => <MapLayersWidget mapLayerOptions={mapLayerOptions} />, // eslint-disable-line react/display-name
      });
    }

    return widgets;
  }
}

export class  FeatureInfoUiItemsProvider implements UiItemsProvider {
  public readonly id = "FeatureInfoUiItemsProvider";
  public static localization: Localization;

  public constructor(localization: Localization) {
    MapLayersUiItemsProvider.localization = localization;
  }

  public provideWidgets(_stageId: string, stageUsage: string, location: StagePanelLocation, section: StagePanelSection | undefined): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];

    if (stageUsage === StageUsage.General && location === StagePanelLocation.Right && section === StagePanelSection.Start) {
      widgets.push({
        id: "map-layers:mapFeatureInfoWidget",
        label: IModelApp.localization.getLocalizedString("mapLayers:Widget.Label"),
        icon: "icon-map",
        getWidgetContent: () => <MapFeatureInfoWidget />, // eslint-disable-line react/display-name
      });
    }

    return widgets;
  }
}

/** MapLayersWidgetControl provides a widget to attach and remove maps layers from the active view's display style.
 * ``` tsx
 *  <Widget id={MapLayersWidgetControl.id} label={MapLayersWidgetControl.label} control={MapLayersWidgetControl}
 *    iconSpec={MapLayersWidgetControl.iconSpec} />,
 * ```
 */
export class MapLayersWidgetControl extends WidgetControl {
  public static id = "MapLayersWidget";
  public static iconSpec = "icon-map";

  public static get label(): string {
    return IModelApp.localization.getLocalizedString("mapLayers:Widget.Label");
  }

  constructor(info: ConfigurableCreateInfo, mapLayerOptions: MapLayerOptions | undefined) {
    super(info, mapLayerOptions);

    this.reactNode = <MapLayersWidget mapLayerOptions={mapLayerOptions} />;
  }
}

export class FeatureInfoWidgetControl extends WidgetControl {
  public static id = "FeatureInfoWidget";
  public static iconSpec = "icon-map";
  public static label = "FeatureInfoWidgetControl";
  constructor(info: ConfigurableCreateInfo, featureInfoOpts: MapFeatureInfoOptions) {
    super(info, featureInfoOpts);

    super.reactNode = <MapFeatureInfoWidget featureInfoOpts={featureInfoOpts}/>;
  }
}
