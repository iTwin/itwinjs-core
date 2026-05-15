/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BackgroundMapType, BaseMapLayerProps, BaseMapLayerSettings, ImageMapLayerProps, ImageMapLayerSettings, MapLayerProviderProperties } from "@itwin/core-common";
import { type DisplayStyleState, IModelApp } from "@itwin/core-frontend";
import { AzureMapsMapLayerFormat } from "../AzureMaps/AzureMapsImageryFormat.js";

const streetUrl = "https://atlas.microsoft.com/map/tile?tilesetId=microsoft.base.road";
const aerialUrl = "https://atlas.microsoft.com/map/tile?tilesetId=microsoft.imagery";
const roadLabelsUrl = "https://atlas.microsoft.com/map/tile?tilesetId=microsoft.base.labels.road";
const roadLabelsRole = "roadLabels";

/** @internal */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const AzureMapsUtils = {
  streetUrl,
  aerialUrl,
  roadLabelsUrl,

  checkFormatRegistered: () => {
    if (!IModelApp.mapLayerFormatRegistry.isRegistered(AzureMapsMapLayerFormat.formatId))
      throw new Error("AzureMaps format is not registered");
  },

  createBaseLayerProps: (type: BackgroundMapType): BaseMapLayerProps => {
    AzureMapsUtils.checkFormatRegistered();

    switch (type) {
      case BackgroundMapType.Street:
        return {
          formatId: AzureMapsMapLayerFormat.formatId,
          name: "Azure Maps: Streets",
          url: streetUrl,
        };
      case BackgroundMapType.Aerial:
        return {
          formatId: AzureMapsMapLayerFormat.formatId,
          name: "Azure Maps: Aerial Imagery",
          url: aerialUrl,
        };
      case BackgroundMapType.Hybrid:
        return {
          formatId: AzureMapsMapLayerFormat.formatId,
          name: "Azure Maps: Hybrid",
          url: aerialUrl,
        };
    }
  },

  createRoadLabelsLayerProps: (): ImageMapLayerProps => {
    AzureMapsUtils.checkFormatRegistered();

    const properties: MapLayerProviderProperties = {
      azureMapsRole: roadLabelsRole,
    };

    return {
      formatId: AzureMapsMapLayerFormat.formatId,
      name: "Azure Maps: Road labels",
      url: roadLabelsUrl,
      transparentBackground: true,
      properties,
    };
  },

  isOwnedRoadLabelsLayer: (layer: unknown): layer is ImageMapLayerSettings => {
    return layer instanceof ImageMapLayerSettings
      && layer.formatId === AzureMapsMapLayerFormat.formatId
      && layer.url === roadLabelsUrl
      && layer.properties?.azureMapsRole === roadLabelsRole;
  },

  getBackgroundMapType: (displayStyle: DisplayStyleState): BackgroundMapType | undefined => {
    const baseLayer = displayStyle.backgroundMapBase;
    if (!(baseLayer instanceof BaseMapLayerSettings) || baseLayer.formatId !== AzureMapsMapLayerFormat.formatId)
      return undefined;

    if (baseLayer.url === streetUrl)
      return BackgroundMapType.Street;

    if (baseLayer.url === aerialUrl) {
      return displayStyle.settings.mapImagery.backgroundLayers.some((layer) => AzureMapsUtils.isOwnedRoadLabelsLayer(layer))
        ? BackgroundMapType.Hybrid
        : BackgroundMapType.Aerial;
    }

    return undefined;
  },
};
