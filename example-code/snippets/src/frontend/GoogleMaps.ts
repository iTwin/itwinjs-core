/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp } from "@itwin/core-frontend";
import { MapCartoRectangle, QuadIdProps } from "@itwin/core-frontend/lib/cjs/tile/internal";
import {GoogleMaps, GoogleMapsCreateSessionOptions, MapLayersFormats} from "@itwin/map-layers-formats";

// __PUBLISH_EXTRACT_START__GoogleMaps_BaseMapSimple
function setGoogleMapsBaseMap() {
    const vp =  IModelApp.viewManager.selectedView;
    if (vp) {
      const ds = vp.displayStyle;
      ds.backgroundMapBase = GoogleMaps.createBaseLayerSettings();
    }
  }
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__GoogleMaps_BaseMapOpts
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
// __PUBLISH_EXTRACT_START__GoogleMaps_AttachMapLayerSimple
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
// __PUBLISH_EXTRACT_START__GoogleMaps_AttachMapLayerOpts
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
// __PUBLISH_EXTRACT_START__GoogleMaps_SetGoogleMapsApiKey
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
// __PUBLISH_EXTRACT_START__GoogleMaps_SetGoogleMapsSessionManager
async function setGoogleMapsSessionManager() {
  await MapLayersFormats.initialize(
    {
      googleMapsOpts: {
        sessionManager: {
          type: "GoogleMapsSessionManager",
          createSession: async (_sessionOptions: GoogleMapsCreateSessionOptions) => {
            return {
              getTileSize: () => {
                return 256;
              } ,
              getTileRequest: (position: QuadIdProps) => {
                return {
                  url: new URL(`https://tile.googleapis.com/v1/2dtiles/zoom=${position.level}/${position.row}/${position.column}&session=abc123`),
                  authorization: "abc123"
                };
              },
              getViewportInfoRequest: (rectangle: MapCartoRectangle, zoomLevel: number) => {
                const degrees = rectangle.toDegrees();
                return {
                  url: new URL(`https://tile.googleapis.com/tile/v1/viewport?zoom=${zoomLevel}?north=${degrees.north}&south=${degrees.south}&east=${degrees.east}&west=${degrees.west}`),
                  authorization: "abc123"
                };
              }
            };
          },
        },
      },
    }

  )
}
// __PUBLISH_EXTRACT_END__
setGoogleMapsBaseMap();
setGoogleMapsBaseMapOpts();
attachGoogleMapsMapLayerSimple();
attachGoogleMapsMapLayerOpts();
setGoogleMapsApiKey().catch(() => {});
setGoogleMapsSessionManager().catch(() => {});