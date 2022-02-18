/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { AbstractWidgetProps, AbstractZoneLocation, StagePanelLocation, StagePanelSection, StageUsage, UiItemsProvider, WidgetState } from "@itwin/appui-abstract";
import { Localization } from "@itwin/core-common";
import { ConfigurableCreateInfo, WidgetControl } from "@itwin/appui-react";
import { IModelApp } from "@itwin/core-frontend";
import { MapFeatureInfoOptions } from "./Interfaces";
import { MapFeatureInfoWidget } from "./widget/FeatureInfoWidget";

export class FeatureInfoUiItemsProvider implements UiItemsProvider {
  public readonly id = "FeatureInfoUiItemsProvider";
  public static readonly widgetId = "map-layers:mapFeatureInfoWidget";
  public static localization: Localization;

  public constructor(localization: Localization) {
    FeatureInfoUiItemsProvider.localization = localization;
  }

  // eslint-disable-next-line deprecation/deprecation
  public provideWidgets(_stageId: string, stageUsage: string, location: StagePanelLocation, section?: StagePanelSection, zoneLocation?: AbstractZoneLocation): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];

    // eslint-disable-next-line deprecation/deprecation
    if ((!section && stageUsage === StageUsage.General && zoneLocation === AbstractZoneLocation.BottomRight) ||
      (stageUsage === StageUsage.General && location === StagePanelLocation.Right && section === StagePanelSection.End)) {
      widgets.push({
        id: FeatureInfoUiItemsProvider.widgetId,
        label: IModelApp.localization.getLocalizedString("mapLayers:FeatureInfoWidget.Label"),
        icon: "icon-map",
        getWidgetContent: () => <MapFeatureInfoWidget featureInfoOpts={{ showLoadProgressAnimation: true }} />, // eslint-disable-line react/display-name
        defaultState: WidgetState.Closed,
      });
    }

    return widgets;
  }
}

// export class FeatureInfoWidgetControl extends WidgetControl {
//   public static id = "FeatureInfoWidget";
//   public static iconSpec = "icon-map";
//   public static label = "FeatureInfoWidgetControl";
//   constructor(info: ConfigurableCreateInfo, featureInfoOpts: MapFeatureInfoOptions) {
//     super(info, featureInfoOpts);

//     super.reactNode = <MapFeatureInfoWidget featureInfoOpts={featureInfoOpts}/>;
//   }
// }
