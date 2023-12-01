/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { EmptyLocalization, ImageMapLayerSettings } from "@itwin/core-common";
import * as sinon from "sinon";
import { assert, expect } from "chai";
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
  const sandbox = sinon.createSandbox();

  beforeEach(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
  });

  afterEach(async () => {
    sandbox.restore();
    if (IModelApp.initialized)
      await IModelApp.shutdown();
  });

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

        case "TileURL":
          expect(provider instanceof TileUrlImageryProvider).to.true;
          break;

        default:
          assert.fail(`Unknown format: '${imageryFormat.formatId}'. Please make sure any new format is covered by this test.`);
      }
    });

    const testValidateSource = async (source: MapLayerSource, url: string) => {
      const stub = sandbox.stub(window, "fetch").callsFake(async function (_input: RequestInfo | URL, _init?: RequestInit) {
        return new Response();
      });
      const urlObj = new URL(url);
      await IModelApp.mapLayerFormatRegistry.validateSource({source});
      expect(stub.called).to.be.true;
      expect(stub.getCall(0).args[0]).to.equals(urlObj.toString());

      const param1 = new URLSearchParams([["key1_1", "value1_1"], ["key1_2", "value1_2"]]);
      const param2 = new URLSearchParams([["key2_1", "value2_2"], ["key2_2", "value2_2"]]);
      source.savedQueryParams = {};
      source.unsavedQueryParams = {};
      param1.forEach((value: string, key: string) => source.savedQueryParams![key] = value);
      param2.forEach((value: string, key: string) => source.unsavedQueryParams![key] = value);
      await IModelApp.mapLayerFormatRegistry.validateSource({source, ignoreCache: true});
      expect(stub.called).to.be.true;
      expect(stub.getCall(1).args[0]).to.equals(urlObj.toString());
    };

    it("validate WMS source with proper URL", async () => {
      const url = "https://sub.service.com/service";
      const source = MapLayerSource.fromJSON({formatId:"WMS", name: "", url});
      if (!source) {
        assert.fail("Failed to create source");
        return;
      }
      await testValidateSource(source, "https://sub.service.com/service?request=GetCapabilities&service=WMS");
    });

    it("validate WMTS source with proper URL", async () => {
      const url = "https://sub.service.com/service";
      const source = MapLayerSource.fromJSON({formatId:"WMTS", name: "", url});
      if (!source) {
        assert.fail("Failed to create source");
        return;
      }

      await testValidateSource(source, "https://sub.service.com/service?request=GetCapabilities&service=WMTS");
    });

    it("validate ArcGIS source with proper URL", async () => {
      const url = "https://sub.service.com/service";
      const source = MapLayerSource.fromJSON({formatId:"ArcGIS", name: "", url});
      if (!source) {
        assert.fail("Failed to create source");
        return;
      }
      sandbox.stub(ArcGisUtilities, "validateUrl").callsFake((_url: string, _serviceType: string) => {
        return MapLayerSourceStatus.Valid;
      });

      await testValidateSource(source, "https://sub.service.com/service?f=json");
    });
  });
});
