/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { afterEach, describe, expect, it, vi } from "vitest";
import { WmsCapabilities } from "../../../tile/map/WmsCapabilities";
import { fakeTextFetch } from "./MapLayerTestUtilities";

const mapProxyDatasetNbLayers = 9;

describe("WmsCapabilities", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it("should parse WMS 1.1.1 capabilities", async () => {
    const response = await fetch("assets/wms_capabilities/mapproxy_111.xml");
    const text = await response.text();
    fakeTextFetch(text);
    const capabilities = await WmsCapabilities.create("https://fake/url");

    expect(capabilities).toBeDefined();
    if (capabilities === undefined)
      return;

    // Test GetCapabilities operation metadata
    expect(capabilities.version).toBeDefined();

    expect(capabilities.version).toEqual("1.1.1");
    expect(capabilities.isVersion13).toEqual(false);

    const subLayers = capabilities.getSubLayers(true);
    expect(subLayers).toBeDefined();
    if (subLayers === undefined)
      return;
    expect(subLayers?.length).toEqual(mapProxyDatasetNbLayers);

    const subLayerNames = subLayers.map((sub) => sub.name);
    const subLayersCrs = capabilities.getSubLayersCrs(subLayerNames);
    expect(subLayersCrs).toBeDefined();
    if (subLayersCrs === undefined)
      return;
    for (const subLayerCrs of subLayersCrs.values()) {
      expect(subLayerCrs).toContain("EPSG:4326");
    }
  });

  it("should parse WMS 1.3.0 capabilities", async () => {
    const response = await fetch("assets/wms_capabilities/mapproxy_130.xml");
    const text = await response.text();
    fakeTextFetch(text);
    const capabilities = await WmsCapabilities.create("https://fake/url2");

    expect(capabilities).toBeDefined();
    if (capabilities === undefined)
      return;

    // Test GetCapabilities operation metadata
    expect(capabilities.version).toBeDefined();

    expect(capabilities.version).toEqual("1.3.0");
    expect(capabilities.isVersion13).toEqual(true);

    const subLayers = capabilities.getSubLayers(true);
    expect(subLayers).toBeDefined();
    if (subLayers === undefined)
      return;
    expect(subLayers?.length).toEqual(mapProxyDatasetNbLayers);

    const subLayerNames = subLayers.map((sub) => sub.name);
    const subLayersCrs = capabilities.getSubLayersCrs(subLayerNames);
    expect(subLayersCrs).toBeDefined();
    if (subLayersCrs === undefined)
      return;
    for (const subLayerCrs of subLayersCrs.values()) {
      expect(subLayerCrs).toContain("EPSG:4326");
    }
  });

  it("should request proper URL", async () => {
    const fetchStub = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());
    const sampleUrl = "https://service.server.com/rest/WMS";
    const params = new URLSearchParams([
      ["key1_1", "value1_1"],
      ["key1_2", "value1_2"],
    ]);
    const queryParams: { [key: string]: string } = {};
    params.forEach((value: string, key: string) => (queryParams[key] = value));
    await WmsCapabilities.create(sampleUrl, undefined, true, queryParams);
    expect(fetchStub).toHaveBeenCalledTimes(1);
    const firstCall = fetchStub.mock.calls[0];
    expect(firstCall[0]).toEqual(`${sampleUrl}?request=GetCapabilities&service=WMS&${params.toString()}`);
  });
});
