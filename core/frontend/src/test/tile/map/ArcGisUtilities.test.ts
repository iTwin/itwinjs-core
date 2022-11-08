/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ArcGisUtilities } from "../../../tile/map/ArcGisUtilities";
import { wsg84Lods256px, wsg84Lods512px } from "./Wgs84Lods";

describe("ArcGisUtilities", () => {
  const tolerance = 0.1;

  it("should compute resolution and scale for LOD range", async () => {
    let scales = ArcGisUtilities.computeZoomLevelsScales(5,10);
    expect(scales.length).to.equals(6);
    expect(scales[0].zoom).to.equals(5);
    expect(scales[5].zoom).to.equals(10);

    // Test scales for 256px tiles
    scales = ArcGisUtilities.computeZoomLevelsScales();
    expect(scales.length).to.equals(wsg84Lods256px.length);
    for (let i=0 ; i < scales.length; i++) {
      expect(Math.abs(scales[i].resolution - wsg84Lods256px[i].resolution)).to.be.lessThan(tolerance);
      expect(Math.abs(scales[i].scale - wsg84Lods256px[i].scale)).to.be.lessThan(tolerance);
    }

    // Test scales for 512px tiles
    scales = ArcGisUtilities.computeZoomLevelsScales(0,20,0,512);
    expect(scales.length).to.equals(wsg84Lods512px.length);
    for (let i=0 ; i < scales.length; i++) {
      expect(Math.abs(scales[i].resolution - wsg84Lods512px[i].resolution)).to.be.lessThan(tolerance);
      expect(Math.abs(scales[i].scale - wsg84Lods512px[i].scale)).to.be.lessThan(tolerance);
    }

    // Make sure we can get zooms level one by one.
    for (let i=0 ; i < wsg84Lods256px.length; i++) {
      scales = ArcGisUtilities.computeZoomLevelsScales(i,i,0,256);
      expect(scales.length).to.equals(1);
      expect(Math.abs(scales[0].resolution - wsg84Lods256px[i].resolution)).to.be.lessThan(tolerance);
      expect(Math.abs(scales[0].scale - wsg84Lods256px[i].scale)).to.be.lessThan(tolerance);
    }

    // Test parameters validation
    expect(ArcGisUtilities.computeZoomLevelsScales(-1,20,0,0, 256).length).to.equals(0);
    expect(ArcGisUtilities.computeZoomLevelsScales(0,-20,0,0, 256).length).to.equals(0);
    expect(ArcGisUtilities.computeZoomLevelsScales(4,1,0,256).length).to.equals(0);
    expect(ArcGisUtilities.computeZoomLevelsScales(0,20,0,-256).length).to.equals(0);
    expect(ArcGisUtilities.computeZoomLevelsScales(0,20,0,256,0).length).to.equals(0);

  });

  it("should match minScale/maxScale to corresponding LOD", async () => {

    let lods = ArcGisUtilities.getZoomLevelsScales(22, 256);
    expect(lods.minLod).to.be.undefined;
    expect(lods.maxLod).to.be.undefined;

    // We want the largest zoom level having a scale value smaller than minimum scale value
    // MinScale: 600 000
    // Zoom 9 has scale of 1155583, and Zoom 10 has scale value of 577791, so it should be zoom 9
    lods = ArcGisUtilities.getZoomLevelsScales(22, 256, 600000, undefined);
    expect(lods.minLod).to.equals(10);
    expect(lods.maxLod).to.be.undefined;

    // We want the smallest zoom level having a scale value greater than maximum scale value
    // Max Scale: 5000
    // Zoom 16 has scale of 9027, and Zoom 17 has scale value of 4513, so it should be zoom 16
    lods = ArcGisUtilities.getZoomLevelsScales(22, 256, undefined, 5000);
    expect(lods.minLod).to.be.undefined;
    expect(lods.maxLod).to.equals(16);
  });
});
