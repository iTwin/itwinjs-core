/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { AbstractWidgetProps, StagePanelLocation, StagePanelSection, StageUsage, UiItemsProvider } from "@itwin/appui-abstract";
import { Localization } from "@itwin/core-common";
import { ConfigurableCreateInfo, WidgetControl } from "@itwin/appui-react";
import { IModelApp } from "@itwin/core-frontend";
import { MapFeatureInfoOptions } from "./Interfaces";
import { MapFeatureInfoWidget } from "./widget/FeatureInfoWidget";

export class  FeatureInfoUiItemsProvider implements UiItemsProvider {
  public readonly id = "FeatureInfoUiItemsProvider";
  public static localization: Localization;

  public constructor(localization: Localization) {
    FeatureInfoUiItemsProvider.localization = localization;
  }

  public provideWidgets(_stageId: string, stageUsage: string, location: StagePanelLocation, section: StagePanelSection | undefined): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];

    if (stageUsage === StageUsage.General && location === StagePanelLocation.Right && section === StagePanelSection.End) {
      widgets.push({
        id: "map-layers:mapFeatureInfoWidget",
        label: IModelApp.localization.getLocalizedString("mapLayers:FeatureInfoWidget.Label"),
        icon: "icon-map",
        getWidgetContent: () => <MapFeatureInfoWidget featureInfoOpts={{showLoadProgressAnimation: true}}/>, // eslint-disable-line react/display-name
      });
    }

    return widgets;
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
