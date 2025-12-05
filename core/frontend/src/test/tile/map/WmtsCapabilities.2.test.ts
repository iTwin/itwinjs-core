/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterEach, describe, expect, it, vi } from "vitest";
import { WmtsCapabilities } from "../../../internal/tile/map/WmtsCapabilities";
import { fakeTextFetch } from "./MapLayerTestUtilities";

// IMPORTANT:
// I created this second test file because stubbing "globalThis.fetch" in one test contaminates the other tests of the same file.
// Not sure if this is a vitest bug.

describe("WmtsCapabilities2", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("should parse resource urls", async () => {
    const response = await fetch(`/assets/wmts_capabilities/wmts_resource_url.xml`);
    const text = await response.text();
    fakeTextFetch(text);

    const capabilities = await WmtsCapabilities.create("https://fake/url2");
    // I check only things that are different from other datasets

    //  Check the layer styles
    expect(capabilities?.contents?.layers).toBeDefined();
    expect(capabilities?.contents?.layers.length).toEqual(1); // this sample capabilities has 2 layers
    const resourceUrls = capabilities?.contents?.layers[0].resourceUrls;
    expect(resourceUrls).toBeDefined();
    expect(resourceUrls?.length).toEqual(3);
    resourceUrls?.forEach((resourceUrl) => {
      expect(resourceUrl.resourceType).toBeDefined();
      expect(resourceUrl.resourceType).toEqual("tile");
      expect(resourceUrl.template).toBeDefined();
      expect(resourceUrl.template).to.contain("{TileMatrixSet}/{TileMatrix}/{TileCol}/{TileRow}");
    });
  });

});
