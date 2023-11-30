/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { WmsCapabilities } from "../../../tile/map/WmsCapabilities";
import { fakeTextFetch } from "./MapLayerTestUtilities";

const mapProxyDatasetNbLayers = 9;

describe("WmsCapabilities", () => {
  const sandbox = sinon.createSandbox();

  afterEach(async () => {
    sandbox.restore();
  });

  it("should parse WMS 1.1.1 capabilities", async () => {

    const response = await fetch("assets/wms_capabilities/mapproxy_111.xml");
    const text = await response.text();
    fakeTextFetch(sandbox, text);
    const capabilities = await WmsCapabilities.create("https://fake/url");

    expect(capabilities).to.not.undefined;
    if (capabilities === undefined)
      return;

    // Test GetCapabilities operation metadata
    expect(capabilities.version).to.not.undefined;

    expect(capabilities.version).to.equals("1.1.1");
    expect(capabilities.isVersion13).to.equals(false);

    const subLayers = capabilities.getSubLayers(true);
    expect(subLayers).to.not.undefined;
    if (subLayers === undefined)
      return;
    expect(subLayers?.length).to.equals(mapProxyDatasetNbLayers);

    const subLayerNames = subLayers.map((sub)=>sub.name);
    const subLayersCrs = capabilities.getSubLayersCrs(subLayerNames);
    expect(subLayersCrs).to.not.undefined;
    if (subLayersCrs === undefined)
      return;
    for (const subLayerCrs of subLayersCrs.values()) {
      expect(subLayerCrs).to.include("EPSG:4326");
    }
  });

  it("should parse WMS 1.3.0 capabilities", async () => {
    const response = await fetch("assets/wms_capabilities/mapproxy_130.xml");
    const text = await response.text();
    fakeTextFetch(sandbox, text);
    const capabilities = await WmsCapabilities.create("https://fake/url2");

    expect(capabilities).to.not.undefined;
    if (capabilities === undefined)
      return;

    // Test GetCapabilities operation metadata
    expect(capabilities.version).to.not.undefined;

    expect(capabilities.version).to.equals("1.3.0");
    expect(capabilities.isVersion13).to.equals(true);

    const subLayers = capabilities.getSubLayers(true);
    expect(subLayers).to.not.undefined;
    if (subLayers === undefined)
      return;
    expect(subLayers?.length).to.equals(mapProxyDatasetNbLayers);

    const subLayerNames = subLayers.map((sub)=>sub.name);
    const subLayersCrs = capabilities.getSubLayersCrs(subLayerNames);
    expect(subLayersCrs).to.not.undefined;
    if (subLayersCrs === undefined)
      return;
    for (const subLayerCrs of subLayersCrs.values()) {
      expect(subLayerCrs).to.include("EPSG:4326");
    }

  });

  it("should request proper URL", async () => {

    const fetchStub = sandbox.stub(global, "fetch").callsFake(async function (_input: RequestInfo | URL, _init?: RequestInit) {
      return new Response();
    });
    const sampleUrl = "https://service.server.com/rest/WMS";
    const params = new URLSearchParams([["key1_1", "value1_1"], ["key1_2", "value1_2"]]);
    const queryParams: {[key: string]: string} = {};
    params.forEach((value: string, key: string) =>  queryParams[key] = value);
    await WmsCapabilities.create(sampleUrl, undefined, true, queryParams);
    expect(fetchStub.calledOnce).to.be.true;
    const firstCall = fetchStub.getCalls()[0];
    expect(firstCall.args[0]).to.equals(`${sampleUrl}?request=GetCapabilities&service=WMS&${params.toString()}`);
  });

});
