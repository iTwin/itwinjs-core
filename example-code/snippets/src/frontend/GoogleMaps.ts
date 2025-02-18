/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp } from "@itwin/core-frontend";
import {GoogleMaps} from "@itwin/map-layers-formats";

// __PUBLISH_EXTRACT_START__ GoogleMaps_BaseMapSimple
function setGoogleMapsBaseMap() {
    const vp =  IModelApp.viewManager.selectedView;
    if (vp) {
      const ds = vp.displayStyle;
      ds.backgroundMapBase = GoogleMaps.createBaseLayerSettings();
    }
  }
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ GoogleMaps_BaseMapOpts
function setGoogleMapsBaseMapOpts() {
  const vp =  IModelApp.viewManager.selectedView;
  if (vp) {
    const ds = vp.displayStyle;
    ds.backgroundMapBase = GoogleMaps.createBaseLayerSettings({
      mapType: "satellite",
      layerTypes: ["layerRoadmap"],
      language: "en-US",
      region: "US"
    });
  }
}
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ GoogleMaps_AttachMapLayerSimple
function attachGoogleMapsMapLayerSimple() {
  const vp =  IModelApp.viewManager.selectedView;
  if (vp) {
    const ds = vp.displayStyle;
    ds.attachMapLayer({
      mapLayerIndex: {index: 0, isOverlay: false},
      settings: GoogleMaps.createMapLayerSettings("GoogleMaps")});
  }
}
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ GoogleMaps_AttachMapLayerSimple
function attachGoogleMapsMapLayerOpts() {
  const vp =  IModelApp.viewManager.selectedView;
  if (vp) {
    const ds = vp.displayStyle;
    ds.attachMapLayer({
      mapLayerIndex: {index: 0, isOverlay: false},
      settings: GoogleMaps.createMapLayerSettings("GoogleMaps", {
          mapType: "roadmap",
          layerTypes: ["layerRoadmap"],
          overlay: true,
          language: "en-US",
          region: "US"
        }
      )});
  }
}
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ GoogleMaps_SetGoogleMapsApiKey
async function setGoogleMapsApiKey() {
  await IModelApp.startup({
    applicationId: "myAppId",
    mapLayerOptions: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      GoogleMaps: {
        key: "key", value: "abc123"
      }
    }
  });
}
// __PUBLISH_EXTRACT_END__
setGoogleMapsBaseMap();
setGoogleMapsBaseMapOpts();
attachGoogleMapsMapLayerSimple();
attachGoogleMapsMapLayerOpts();
setGoogleMapsApiKey().catch(() => {});