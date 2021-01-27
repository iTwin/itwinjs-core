/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { AbstractWidgetProps, StagePanelLocation, StagePanelSection, StageUsage, UiItemsProvider } from "@bentley/ui-abstract";
import { I18N } from "@bentley/imodeljs-i18n";
import { MapLayersWidget } from "./widget/MapLayersWidget";
import { ConfigurableCreateInfo, WidgetControl } from "@bentley/ui-framework";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { MapLayerOptions } from "./Interfaces";

export class MapLayersUiItemsProvider implements UiItemsProvider {
  public readonly id = "MapLayersUiItemsProvider";
  public static i18n: I18N;

  public constructor(i18n: I18N) {
    MapLayersUiItemsProvider.i18n = i18n;
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
        label: MapLayersUiItemsProvider.i18n.translate("mapLayers:Widget.Label"),
        icon: "icon-map",
        getWidgetContent: () => <MapLayersWidget mapLayerOptions={mapLayerOptions} />, // eslint-disable-line react/display-name
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
    return IModelApp.i18n.translate("mapLayers:Widget.Label");
  }

  constructor(info: ConfigurableCreateInfo, mapLayerOptions: MapLayerOptions | undefined) {
    super(info, mapLayerOptions);

    this.reactNode = <MapLayersWidget mapLayerOptions={mapLayerOptions} />;
  }
}
