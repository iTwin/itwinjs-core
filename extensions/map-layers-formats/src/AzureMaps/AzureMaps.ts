/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MapLayersFormats
 */

import { BackgroundMapType, BaseMapLayerProps, BaseMapLayerSettings, ImageMapLayerProps, ImageMapLayerSettings, MapLayerProviderProperties, MapLayerSettings } from "@itwin/core-common";
import { type DisplayStyleState, IModelApp } from "@itwin/core-frontend";
import { AzureMapsMapLayerFormat } from "./AzureMapsImageryFormat.js";

const streetUrl = "https://atlas.microsoft.com/map/tile?tilesetId=microsoft.base.road";
const aerialUrl = "https://atlas.microsoft.com/map/tile?tilesetId=microsoft.imagery";
const roadLabelsUrl = "https://atlas.microsoft.com/map/tile?tilesetId=microsoft.base.labels.road";
const roadLabelsRole = "roadLabels";

function assertRegistered(): void {
  if (!IModelApp.mapLayerFormatRegistry.isRegistered(AzureMapsMapLayerFormat.formatId))
    throw new Error("AzureMaps format is not registered");
}

function baseLayerProps(type: BackgroundMapType): BaseMapLayerProps {
  switch (type) {
    case BackgroundMapType.Street:
      return { formatId: AzureMapsMapLayerFormat.formatId, name: "Azure Maps: Streets", url: streetUrl };
    case BackgroundMapType.Aerial:
      return { formatId: AzureMapsMapLayerFormat.formatId, name: "Azure Maps: Aerial Imagery", url: aerialUrl };
    case BackgroundMapType.Hybrid:
      return { formatId: AzureMapsMapLayerFormat.formatId, name: "Azure Maps: Hybrid", url: aerialUrl };
  }
}

function roadLabelsLayerProps(): ImageMapLayerProps {
  const properties: MapLayerProviderProperties = { azureMapsRole: roadLabelsRole };
  return {
    formatId: AzureMapsMapLayerFormat.formatId,
    name: "Azure Maps: Road labels",
    url: roadLabelsUrl,
    transparentBackground: true,
    properties,
  };
}

function isOwnedRoadLabelsLayer(layer: MapLayerSettings): layer is ImageMapLayerSettings {
  return layer instanceof ImageMapLayerSettings
    && layer.formatId === AzureMapsMapLayerFormat.formatId
    && layer.url === roadLabelsUrl
    && layer.properties?.azureMapsRole === roadLabelsRole;
}

/**
 * Azure Maps API.
 * @beta
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const AzureMaps = {
  /**
   * Creates Azure Maps base-layer settings for the supplied basemap type.
   * @beta
   */
  createBaseLayerSettings: (type: BackgroundMapType) => {
    assertRegistered();
    return BaseMapLayerSettings.fromJSON(baseLayerProps(type));
  },

  /**
   * Creates any Azure Maps background helper layers required by the supplied basemap type.
   * Hybrid is composed from aerial imagery plus an internal road-labels helper layer.
   * @beta
   */
  createBackgroundLayers: (type: BackgroundMapType) => {
    return type === BackgroundMapType.Hybrid
      ? [ImageMapLayerSettings.fromJSON(roadLabelsLayerProps())]
      : [];
  },

  /**
   * Removes any Azure Maps helper layers owned by this package from the display style.
   * @beta
   */
  clearBackgroundLayers: (displayStyle: DisplayStyleState) => {
    const layers = displayStyle.settings.mapImagery.backgroundLayers;
    for (let index = layers.length - 1; index >= 0; --index) {
      if (isOwnedRoadLabelsLayer(layers[index]))
        displayStyle.detachMapLayerByIndex({ index, isOverlay: false });
    }
  },

  /**
   * Applies the requested Azure Maps basemap to the supplied display style.
   * Preserves the existing base-layer display state, such as visibility and transparency,
   * while replacing the basemap source with the Azure Maps equivalent.
   * @beta
   */
  applyBackgroundMap: (displayStyle: DisplayStyleState, type: BackgroundMapType) => {
    assertRegistered();
    AzureMaps.clearBackgroundLayers(displayStyle);

    const azureBaseProps = baseLayerProps(type);
    const previousBase = displayStyle.backgroundMapBase;
    displayStyle.backgroundMapBase = previousBase instanceof BaseMapLayerSettings
      ? BaseMapLayerSettings.fromJSON({
          ...azureBaseProps,
          visible: previousBase.visible,
          transparency: previousBase.transparency,
          transparentBackground: previousBase.transparentBackground,
        })
      : BaseMapLayerSettings.fromJSON(azureBaseProps);

    for (const layer of AzureMaps.createBackgroundLayers(type))
      displayStyle.attachMapLayer({ mapLayerIndex: { index: -1, isOverlay: false }, settings: layer });
  },

  /**
   * Identifies the active Azure Maps basemap type for the supplied display style, if any.
   * @beta
   */
  getBackgroundMapType: (displayStyle: DisplayStyleState): BackgroundMapType | undefined => {
    const baseLayer = displayStyle.backgroundMapBase;
    if (!(baseLayer instanceof BaseMapLayerSettings) || baseLayer.formatId !== AzureMapsMapLayerFormat.formatId)
      return undefined;

    if (baseLayer.url === streetUrl)
      return BackgroundMapType.Street;

    if (baseLayer.url === aerialUrl) {
      return displayStyle.settings.mapImagery.backgroundLayers.some(isOwnedRoadLabelsLayer)
        ? BackgroundMapType.Hybrid
        : BackgroundMapType.Aerial;
    }

    return undefined;
  },
};
