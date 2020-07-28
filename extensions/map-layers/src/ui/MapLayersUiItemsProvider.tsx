/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { AbstractWidgetProps, StagePanelLocation, StagePanelSection, StageUsage, UiItemsProvider } from "@bentley/ui-abstract";
import { I18N } from "@bentley/imodeljs-i18n";
import { MapLayersWidget } from "./widget/MapLayersWidget";

export class MapLayersUiItemsProvider implements UiItemsProvider {
  public readonly id = "MapLayersUiItemsProvider";
  public static i18n: I18N;

  public constructor(i18n: I18N) {
    MapLayersUiItemsProvider.i18n = i18n;
  }

  public provideWidgets(_stageId: string, stageUsage: string, location: StagePanelLocation, section: StagePanelSection | undefined): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];
    if (stageUsage === StageUsage.General && location === StagePanelLocation.Right && section === StagePanelSection.Start) {
      widgets.push({
        id: "map-layers:mapLayersWidget",
        label: MapLayersUiItemsProvider.i18n.translate("mapLayers:Widget.Label"),
        icon: "icon-map",
        getWidgetContent: () => <MapLayersWidget />,
      });
    }
    return widgets;
  }
}
