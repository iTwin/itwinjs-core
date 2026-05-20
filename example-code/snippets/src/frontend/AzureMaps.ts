/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BackgroundMapType, ImageMapLayerSettings } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";
import { AzureMaps, MapLayersFormats } from "@itwin/map-layers-formats";

// __PUBLISH_EXTRACT_START__ AzureMaps_SetAzureMapsApiKey
export async function setAzureMapsApiKey() {
  await IModelApp.startup({
    applicationId: "myAppId",
    mapLayerOptions: {
      ["AzureMaps"]: {
        key: "subscription-key",
        value: "abc123",
      },
    },
  });
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ AzureMaps_InitializeMapLayersFormats
export async function initializeMapLayersFormats() {
  await MapLayersFormats.initialize();
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ AzureMaps_BaseMapStreet
export function applyAzureStreetBaseMap() {
  const vp = IModelApp.viewManager.selectedView;
  if (!vp)
    return;

  AzureMaps.applyBackgroundMap(vp.displayStyle, BackgroundMapType.Street);
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ AzureMaps_BaseMapAerial
export function applyAzureAerialBaseMap() {
  const vp = IModelApp.viewManager.selectedView;
  if (!vp)
    return;

  AzureMaps.applyBackgroundMap(vp.displayStyle, BackgroundMapType.Aerial);
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ AzureMaps_BaseMapHybrid
export function applyAzureHybridBaseMap() {
  const vp = IModelApp.viewManager.selectedView;
  if (!vp)
    return;

  AzureMaps.applyBackgroundMap(vp.displayStyle, BackgroundMapType.Hybrid);
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ AzureMaps_BaseMapWithOverlay
export function applyAzureBaseMapAndOverlay() {
  const vp = IModelApp.viewManager.selectedView;
  if (!vp)
    return;

  AzureMaps.applyBackgroundMap(vp.displayStyle, BackgroundMapType.Aerial);
  vp.displayStyle.attachMapLayer({
    mapLayerIndex: { index: 0, isOverlay: true },
    settings: ImageMapLayerSettings.fromJSON({
      formatId: "ArcGIS",
      url: "https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Boundaries_and_Places/MapServer",
      name: "World boundaries",
      transparentBackground: true,
    }),
  });
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ AzureMaps_InspectBaseMapType
export function getAzureBaseMapType() {
  const vp = IModelApp.viewManager.selectedView;
  if (!vp)
    return undefined;

  return AzureMaps.getBackgroundMapType(vp.displayStyle);
}
// __PUBLISH_EXTRACT_END__
