/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MapLayersFormats
 */

import { BackgroundMapType, BaseMapLayerSettings, ImageMapLayerSettings } from "@itwin/core-common";
import { type DisplayStyleState } from "@itwin/core-frontend";
import { AzureMapsUtils } from "../internal/AzureMapsUtils.js";

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
    return BaseMapLayerSettings.fromJSON(AzureMapsUtils.createBaseLayerProps(type));
  },

  /**
   * Creates any Azure Maps background helper layers required by the supplied basemap type.
   * Hybrid is composed from aerial imagery plus an internal road-labels helper layer.
   * @beta
   */
  createBackgroundLayers: (type: BackgroundMapType) => {
    if (type !== BackgroundMapType.Hybrid)
      return [];

    return [ImageMapLayerSettings.fromJSON(AzureMapsUtils.createRoadLabelsLayerProps())];
  },

  /**
   * Removes any Azure Maps helper layers owned by this package from the display style.
   * @beta
   */
  clearBackgroundLayers: (displayStyle: DisplayStyleState) => {
    for (let index = displayStyle.settings.mapImagery.backgroundLayers.length - 1; index >= 0; --index) {
      const layer = displayStyle.settings.mapImagery.backgroundLayers[index];
      if (AzureMapsUtils.isOwnedRoadLabelsLayer(layer))
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
    AzureMaps.clearBackgroundLayers(displayStyle);

    const azureBaseProps = AzureMapsUtils.createBaseLayerProps(type);
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
  getBackgroundMapType: (displayStyle: DisplayStyleState) => {
    return AzureMapsUtils.getBackgroundMapType(displayStyle);
  },
};
