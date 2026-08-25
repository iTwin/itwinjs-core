/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageMapLayerSettings } from "@itwin/core-common";
import { WmsCapabilities } from "../../../internal/tile/map/WmsCapabilities";
import { WmsMapLayerImageryProvider } from "../../../internal/tile/map/ImageryProviders/WmsMapLayerImageryProvider";
import { fakeTextFetch } from "./MapLayerTestUtilities";

const mapProxyDatasetNbLayers = 9;

describe("WmsCapabilities", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it("should parse WMS 1.1.1 capabilities", async () => {
    const response = await fetch(`/assets/wms_capabilities/mapproxy_111.xml`);
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
    const response = await fetch(`/assets/wms_capabilities/mapproxy_130.xml`);
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
    const params = new URLSearchParams([["key1_1", "value1_1"], ["key1_2", "value1_2"]]);
    const queryParams: {[key: string]: string} = {};
    params.forEach((value: string, key: string) =>  queryParams[key] = value);
    await WmsCapabilities.create(sampleUrl, undefined, true, queryParams);
    expect(fetchStub).toHaveBeenCalledTimes(1);
    const firstCall = fetchStub.mock.calls[0];
    expect(firstCall[0]).toEqual(`${sampleUrl}?request=GetCapabilities&service=WMS&${params.toString()}`);
  });

  it("should handle invalid range with -Infinity values", async () => {
    const response = await fetch(`/assets/wms_capabilities/mapproxy_invalid_range_130.xml`);
    const text = await response.text();
    fakeTextFetch(text);

    // Parse capabilities - this should succeed even with invalid range values
    const capabilities = await WmsCapabilities.create("https://fake/url3");
    expect(capabilities).toBeDefined();
    if (capabilities === undefined)
      return;

    // The capabilities object contains the raw invalid range from the XML
    expect(capabilities.cartoRange).toBeDefined();

    // Create a WmsMapLayerImageryProvider with these capabilities
    const settings = ImageMapLayerSettings.fromJSON({ formatId: "WMS", name: "Test", url: "https://fake/url3" });
    const provider = new WmsMapLayerImageryProvider(settings);
    await provider.initialize();

    // The provider's cartoRange getter validates the range and returns undefined
    // because the underlying range contains -Infinity values
    expect(provider.cartoRange).toBeUndefined();
  });

  describe("hostile and degenerate input", () => {
    const wrap130 = (inner: string) => `<?xml version="1.0"?><WMS_Capabilities version="1.3.0" xmlns="http://www.opengis.net/wms">${inner}</WMS_Capabilities>`;

    it("should recover truncated XML without throwing", async () => {
      // The browser DOMParser recovers this fragment by auto-closing the open tags.
      fakeTextFetch("<WMS_Capabilities><Service><Name>oops");
      const capabilities = await WmsCapabilities.create("https://fake/truncated", undefined, true);
      expect(capabilities).toBeDefined();
      expect(capabilities!.version).toBeUndefined();
      expect(capabilities!.service.name).toEqual("oops");
      expect(capabilities!.layer).toBeUndefined();
    });

    it("should degrade gracefully on unparseable XML without throwing", async () => {
      // Mismatched tags produce a parsererror document; DOMParser still exposes the
      // partially parsed content, so the result is a degenerate but valid object.
      fakeTextFetch("<WMS_Capabilities><Service></WMS_Capabilities></Service>");
      const capabilities = await WmsCapabilities.create("https://fake/malformed", undefined, true);
      expect(capabilities).toBeDefined();
      expect(capabilities!.version).toBeUndefined();
      expect(capabilities!.service.name).toEqual("");
      expect(capabilities!.layer).toBeUndefined();
      expect(capabilities!.getSubLayers()).toBeUndefined();
    });

    it("should not throw on non-WMS XML", async () => {
      fakeTextFetch(`<?xml version="1.0"?><html><body>Not a WMS server</body></html>`);
      const capabilities = await WmsCapabilities.create("https://fake/nonwms", undefined, true);
      expect(capabilities).toBeUndefined();
    });

    it("should reject a capabilities document with no Service or Capability", async () => {
      fakeTextFetch(`<?xml version="1.0"?><WMS_Capabilities xmlns="http://www.opengis.net/wms"></WMS_Capabilities>`);
      const capabilities = await WmsCapabilities.create("https://fake/empty", undefined, true);
      expect(capabilities).toBeUndefined();
    });

    it("should handle missing version and Capability", async () => {
      fakeTextFetch(wrap130(`<Service><Name>svc</Name></Service>`).replace(` version="1.3.0"`, ""));
      const capabilities = await WmsCapabilities.create("https://fake/noversion", undefined, true);
      expect(capabilities).toBeDefined();
      expect(capabilities!.version).toBeUndefined();
      expect(capabilities!.isVersion13).toEqual(false);
      expect(capabilities!.service.name).toEqual("svc");
      expect(capabilities!.layer).toBeUndefined();
      expect(capabilities!.getSubLayers()).toBeUndefined();
      expect(capabilities!.featureInfoSupported).toEqual(false);
    });

    it("should handle unexpected elements and non-string version", async () => {
      fakeTextFetch(wrap130(`<Bogus><Nested/></Bogus><Service><Name>svc</Name></Service>`));
      const capabilities = await WmsCapabilities.create("https://fake/unexpected", undefined, true);
      expect(capabilities).toBeDefined();
      expect(capabilities!.service.name).toEqual("svc");
    });

    it("should handle a layer without CRS/SRS", async () => {
      fakeTextFetch(wrap130(`<Service><Name>svc</Name></Service><Capability><Layer><Title>root</Title><Layer><Name>child</Name><Title>child</Title></Layer></Layer></Capability>`));
      const capabilities = await WmsCapabilities.create("https://fake/nocrs", undefined, true);
      expect(capabilities).toBeDefined();
      const crsMap = capabilities!.getSubLayersCrs(["child"]);
      expect(crsMap).toBeDefined();
      expect(crsMap!.get("child")).toEqual([]);
    });

    it("should handle deeply nested layers", async () => {
      const depth = 100;
      let inner = `<Layer><Name>leaf</Name><Title>leaf</Title></Layer>`;
      for (let i = 0; i < depth; i++)
        inner = `<Layer><Name>n${i}</Name><Title>n${i}</Title>${inner}</Layer>`;
      fakeTextFetch(wrap130(`<Service><Name>svc</Name></Service><Capability>${inner}</Capability>`));
      const capabilities = await WmsCapabilities.create("https://fake/deep", undefined, true);
      expect(capabilities).toBeDefined();
      const subLayers = capabilities!.getSubLayers();
      expect(subLayers).toBeDefined();
      expect(subLayers!.length).toEqual(depth + 1);
    });

    it("should not resolve external entities", async () => {
      const payload = `<?xml version="1.0"?><!DOCTYPE WMS_Capabilities [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><WMS_Capabilities version="1.3.0" xmlns="http://www.opengis.net/wms"><Service><Name>&xxe;</Name></Service></WMS_Capabilities>`;
      fakeTextFetch(payload);
      const capabilities = await WmsCapabilities.create("https://fake/xxe", undefined, true);
      // The browser DOMParser does not resolve external entities; the document is
      // either rejected outright or parsed with an empty entity value.
      if (capabilities !== undefined) {
        expect(capabilities.service.name).toEqual("");
      }
    });
  });
});
