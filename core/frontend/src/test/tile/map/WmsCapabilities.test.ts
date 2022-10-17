/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { WmsCapabilities } from "../../../tile/map/WmsCapabilities";

const mapProxyDatasetNbLayers = 9;
describe("WmsCapabilities", () => {
  it("should parse WMS 1.1.1 capabilities", async () => {
    const capabilities = await WmsCapabilities.create("assets/wms_capabilities/mapproxy_111.xml");

    expect(capabilities).to.not.undefined;
    if (capabilities === undefined) return;

    // Test GetCapabilities operation metadata
    expect(capabilities.version).to.not.undefined;

    expect(capabilities.version).to.equals("1.1.1");
    expect(capabilities.isVersion13).to.equals(false);

    const subLayers = capabilities.getSubLayers(true);
    expect(subLayers).to.not.undefined;
    if (subLayers === undefined) return;
    expect(subLayers?.length).to.equals(mapProxyDatasetNbLayers);

    const subLayerNames = subLayers.map((sub) => sub.name);
    const subLayersCrs = capabilities.getSubLayersCrs(subLayerNames);
    expect(subLayersCrs).to.not.undefined;
    if (subLayersCrs === undefined) return;
    for (const subLayerCrs of subLayersCrs.values()) {
      expect(subLayerCrs).to.include("EPSG:4326");
    }
  });

  it("should parse WMS 1.3.0 capabilities", async () => {
    const capabilities = await WmsCapabilities.create("assets/wms_capabilities/mapproxy_130.xml");

    expect(capabilities).to.not.undefined;
    if (capabilities === undefined) return;

    // Test GetCapabilities operation metadata
    expect(capabilities.version).to.not.undefined;

    expect(capabilities.version).to.equals("1.3.0");
    expect(capabilities.isVersion13).to.equals(true);

    const subLayers = capabilities.getSubLayers(true);
    expect(subLayers).to.not.undefined;
    if (subLayers === undefined) return;
    expect(subLayers?.length).to.equals(mapProxyDatasetNbLayers);

    const subLayerNames = subLayers.map((sub) => sub.name);
    const subLayersCrs = capabilities.getSubLayersCrs(subLayerNames);
    expect(subLayersCrs).to.not.undefined;
    if (subLayersCrs === undefined) return;
    for (const subLayerCrs of subLayersCrs.values()) {
      expect(subLayerCrs).to.include("EPSG:4326");
    }
  });
});
