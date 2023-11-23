/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { EmptyLocalization, MapLayerUrlParam } from "@itwin/core-common";
import * as sinon from "sinon";
import { assert, expect } from "chai";
import {
  ArcGisUtilities,
  MapLayerSource,
  MapLayerSourceStatus,
} from "../../../tile/internal";
import { IModelApp } from "../../../IModelApp";

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

  const testValidateSource = async (source: MapLayerSource, url: string) => {
    const stub = sandbox.stub(window, "fetch").callsFake(async function (_input: RequestInfo | URL, _init?: RequestInit) {
      return new Response();
    });
    const urlObj = new URL(url);
    await IModelApp.mapLayerFormatRegistry.validateSourceObj(source);
    expect(stub.called).to.be.true;
    expect(stub.getCall(0).args[0]).to.equals(urlObj.toString());

    const param: MapLayerUrlParam = {key: "key", value:"value1"};
    urlObj.searchParams.append(param.key, param.value);
    source.customParameters = [param];
    await IModelApp.mapLayerFormatRegistry.validateSourceObj(source, {ignoreCache: true});
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
