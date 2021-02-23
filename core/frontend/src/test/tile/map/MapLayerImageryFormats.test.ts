/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { MapLayerSettings } from "@bentley/imodeljs-common";
import { expect } from "chai";

import {
  ArcGISMapLayerImageryProvider,
  BingMapsImageryLayerProvider,
  internalMapLayerImageryFormats,
  MapBoxLayerImageryProvider,
  MapLayerFormatRegistry,
  TileUrlImageryProvider,
  WmsMapLayerImageryProvider,
  WmtsMapLayerImageryProvider,
} from "../../../tile/internal";

const getSampleLayerSettings = ((formatId: string) => {
  return MapLayerSettings.fromJSON({
    formatId, url: "https://localhost/service", name: `Test ${formatId}`,
  });
});

describe("MapLayerImageryFormats", () => {
  it("should create proper provider", () => {
    const registry = new MapLayerFormatRegistry({});
    internalMapLayerImageryFormats.forEach((imageryFormat) => {

      const layerSettings = getSampleLayerSettings(imageryFormat.formatId);
      expect(layerSettings).to.not.undefined;
      if (!layerSettings)
        return;

      const provider = registry.createImageryProvider(layerSettings);
      expect(provider).to.not.undefined;

      // Update this switch case if you add a new format.
      switch (imageryFormat.formatId) {
        case "WMS":
          expect(provider instanceof WmsMapLayerImageryProvider).to.true;
          break;

        case "WMTS":
          expect(provider instanceof WmtsMapLayerImageryProvider).to.true;
          break;

        case "ArcGIS":
          expect(provider instanceof ArcGISMapLayerImageryProvider).to.true;
          break;

        case "BingMaps":
          expect(provider instanceof BingMapsImageryLayerProvider).to.true;
          break;

        case "MapboxImagery":
          expect(provider instanceof MapBoxLayerImageryProvider).to.true;
          break;

        case "TileUrlMapLayerFormat":
          expect(provider instanceof TileUrlImageryProvider).to.true;
          break;
      }
    });
  });
});
