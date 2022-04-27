/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { ArcGisUrl } from "../ArcGis/ArcGisUrl";

chai.should();
describe("ArcGisUrl", () => {

  it("should extract REST base url", async () => {
    const sampleUrl1 = new URL("https://dtlgeoarcgis.adtl.com/server/rest/services/NewYork/NewYork3857/MapServer");
    const extractedBaseUrl1 = ArcGisUrl.extractRestBaseUrl(sampleUrl1);
    chai.assert.isFalse(extractedBaseUrl1 === undefined);
    chai.assert.equal("https://dtlgeoarcgis.adtl.com/server/rest/", extractedBaseUrl1?.toString());

    const sampleUrl2 = new URL("https://dtlgeoarcgis.adtl.com/server/rest/");
    const extractedBaseUrl2 = ArcGisUrl.extractRestBaseUrl(sampleUrl2);
    chai.assert.isFalse(extractedBaseUrl2 === undefined);
    chai.assert.equal("https://dtlgeoarcgis.adtl.com/server/rest/", extractedBaseUrl2?.toString());

    const sampleUrl3 = new URL("https://dtlgeoarcgis.adtl.com/server/");
    const extractedBaseUrl3 = ArcGisUrl.extractRestBaseUrl(sampleUrl3);
    chai.assert.isTrue(extractedBaseUrl3 === undefined);

  });

});
