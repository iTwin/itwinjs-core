/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmptyLocalization, ImageMapLayerSettings } from "@itwin/core-common";
import {
  ArcGISMapLayerImageryProvider,
  ArcGisUtilities,
  BingMapsImageryLayerProvider,
  internalMapLayerImageryFormats,
  MapBoxLayerImageryProvider,
  MapLayerFormatRegistry,
  MapLayerSource,
  MapLayerSourceStatus,
  TileUrlImageryProvider,
  WmsMapLayerImageryProvider,
  WmtsMapLayerImageryProvider,
} from "../../../tile/internal";
import { IModelApp } from "../../../IModelApp";

const getSampleLayerSettings = ((formatId: string) => {
  return ImageMapLayerSettings.fromJSON({
    formatId, url: "https://localhost/service", name: `Test ${formatId}`,
  });
});

describe("MapLayerImageryFormats", () => {
  beforeEach(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (IModelApp.initialized)
      await IModelApp.shutdown();
  });
  describe("should create proper provider", () => {
    beforeEach(async () => {
      const registry = new MapLayerFormatRegistry({});
      internalMapLayerImageryFormats.forEach((imageryFormat) => {
        const layerSettings = getSampleLayerSettings(imageryFormat.formatId);
        expect(layerSettings).toBeDefined();
        if (!layerSettings)
          return;

        const provider = registry.createImageryProvider(layerSettings);
        expect(provider).toBeDefined();

        // Update this switch case if you add a new format.
        switch (imageryFormat.formatId) {
          case "WMS":
            expect(provider instanceof WmsMapLayerImageryProvider).toBe(true);
            break;

          case "WMTS":
            expect(provider instanceof WmtsMapLayerImageryProvider).toBe(true);
            break;

          case "ArcGIS":
            expect(provider instanceof ArcGISMapLayerImageryProvider).toBe(true);
            break;

          case "BingMaps":
            expect(provider instanceof BingMapsImageryLayerProvider).toBe(true);
            break;

          case "MapboxImagery":
            expect(provider instanceof MapBoxLayerImageryProvider).toBe(true);
            break;

          case "TileURL":
            expect(provider instanceof TileUrlImageryProvider).toBe(true);
            break;

          default:
            expect.fail(`Unknown format: '${imageryFormat.formatId}'. Please make sure any new format is covered by this test.`);
        }
      });
    });

    const testValidateSource = async (source: MapLayerSource, url: string) => {
      const stub = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());
      const urlObj = new URL(url);
      await IModelApp.mapLayerFormatRegistry.validateSource({source});
      expect(stub).toHaveBeenCalled();
      const firstCall = stub.mock.calls[0][0];
      if (firstCall instanceof URL) {
        expect(firstCall.toString()).toBe(urlObj.toString());
      } else {
        expect(firstCall).toBe(urlObj.toString());
      }

      const param1 = new URLSearchParams([["key1_1", "value1_1"], ["key1_2", "value1_2"]]);
      const param2 = new URLSearchParams([["key2_1", "value2_2"], ["key2_2", "value2_2"]]);
      source.savedQueryParams = {};
      source.unsavedQueryParams = {};
      param1.forEach((value: string, key: string) => {
        source.savedQueryParams![key] = value;
        urlObj.searchParams.append(key, value);
      });
      param2.forEach((value: string, key: string) => {
        source.unsavedQueryParams![key] = value;
        urlObj.searchParams.append(key, value);
      });
      await IModelApp.mapLayerFormatRegistry.validateSource({ source, ignoreCache: true });
      expect(stub).toHaveBeenCalled();
      const secondCall = stub.mock.calls[1][0];
      if (secondCall instanceof URL) {
        expect(secondCall.toString()).toBe(urlObj.toString());
      } else {
        expect(secondCall).toBe(urlObj.toString());
      }
    };

    it("validate WMS source with proper URL", async () => {
      const url = "https://sub.service.com/service";
      const source = MapLayerSource.fromJSON({ formatId: "WMS", name: "", url });
      if (!source) {
        expect.fail("Failed to create source");
      }
      await testValidateSource(source, "https://sub.service.com/service?request=GetCapabilities&service=WMS");
    });

    it("validate WMTS source with proper URL", async () => {
      const url = "https://sub.service.com/service";
      const source = MapLayerSource.fromJSON({formatId:"WMTS", name: "", url});
      if (!source) {
        expect.fail("Failed to create source");
      }

      await testValidateSource(source, "https://sub.service.com/service?request=GetCapabilities&service=WMTS");
    });

    it("validate ArcGIS source with proper URL", async () => {
      const url = "https://sub.service.com/service";
      const source = MapLayerSource.fromJSON({formatId:"ArcGIS", name: "", url});
      if (!source) {
        expect.fail("Failed to create source");
      }
      vi.spyOn(ArcGisUtilities, "validateUrl").mockImplementation((_url: string, _serviceType: string) => {
        return MapLayerSourceStatus.Valid;
      });

      await testValidateSource(source, "https://sub.service.com/service?f=json");
    });
  });
});
