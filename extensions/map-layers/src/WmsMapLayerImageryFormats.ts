/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MapLayers
 */

import { ImageMapLayerSettings, MapSubLayerProps } from "@itwin/core-common";
import { ImageryMapLayerFormat, MapLayerAuthenticationInfo, MapLayerAuthType, MapLayerImageryProvider, MapLayerSourceStatus, MapLayerSourceValidation, WmsCapabilities } from "@itwin/core-frontend";
import { RequestBasicCredentials } from "@itwin/core-frontend/lib/cjs/request/Request";
import { WmsMapLayerImageryProvider } from "./WmsMapLayerImageryProvider";

export class WmsMapLayerFormat extends ImageryMapLayerFormat {
  public static override formatId = "WMS";

  public static override createImageryProvider(settings: ImageMapLayerSettings): MapLayerImageryProvider | undefined {
    return new WmsMapLayerImageryProvider(settings);
  }
  public static override async validateSource(url: string, credentials?: RequestBasicCredentials, ignoreCache?: boolean): Promise<MapLayerSourceValidation> {
    try {
      let subLayers: MapSubLayerProps[] | undefined;
      const maxVisibleSubLayers = 50;
      const capabilities = await WmsCapabilities.create(url, credentials, ignoreCache);
      if (capabilities !== undefined) {
        subLayers = capabilities.getSubLayers(false);
        const rootsSubLayer = subLayers?.find((sublayer) => sublayer.parent === undefined);
        const hasTooManyLayers = subLayers && subLayers.length > maxVisibleSubLayers;

        if (!Array.isArray(subLayers))
          return { status: MapLayerSourceStatus.Valid, subLayers };

        for (const subLayer of subLayers) {
          // In general for WMS, we prefer to have the children of root node visible, but not the root itself.
          // Thats simply to give more flexibility in the UI.
          // Two exceptions to this rule: If there are too many layers or the root node is not named.
          if (subLayer.id && subLayer.id === rootsSubLayer?.id
            && (!(subLayer.name && subLayer.name.length > 0) || hasTooManyLayers)) {
            subLayer.visible = true;
            break;  // if root node is visible, don't bother turning ON any other layers
          }

          // Make children of the root node visible.
          if (subLayer.parent && subLayer.parent === rootsSubLayer?.id && !hasTooManyLayers) {
            const isUnnamedGroup = (layer: MapSubLayerProps) => { return layer.children && layer.children.length > 0 && (!layer.name || layer.name.length === 0); };
            const makeChildrenVisible = (layers: MapSubLayerProps[] | undefined, layer: MapSubLayerProps) => {
              layer?.children?.forEach((childId) => {
                const childSubLayer = subLayers?.find((child) => child?.id === childId);
                if (childSubLayer) {
                  childSubLayer.visible = true;
                  if (isUnnamedGroup(childSubLayer))
                    makeChildrenVisible(layers, childSubLayer);
                }
              });
            };

            subLayer.visible = true;

            // If we got a unnamed group, make children visible recursively until we have a leaf or named group
            if (isUnnamedGroup(subLayer))
              makeChildrenVisible(subLayers, subLayer);
          }
        }
      }

      return { status: MapLayerSourceStatus.Valid, subLayers };
    } catch (err: any) {
      let status = MapLayerSourceStatus.InvalidUrl;
      let authInfo: MapLayerAuthenticationInfo|undefined;
      if (err?.status === 401) {
        status = (credentials ? MapLayerSourceStatus.InvalidCredentials : MapLayerSourceStatus.RequireAuth);
        authInfo = {authMethod: MapLayerAuthType.Basic};
      }
      return { status, authInfo};
    }
  }
}
