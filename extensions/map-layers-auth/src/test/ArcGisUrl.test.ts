/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as sinon from "sinon";
import { ArcGisUrl } from "../map-layers-auth";

describe("ArcGisUrl", () => {
  const sandbox = sinon.createSandbox();

  const sampleRestUrl = "https://dtlgeoarcgis.adtl.com/portal/sharing/rest/";
  const sampleGenerateTokenUrl = `${sampleRestUrl}generateToken`;

  afterEach(async () => {
    sandbox.restore();
  });

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

  it("should extract RestUrl From GenerateToken Url", async () => {
    const fetchJsonStub = sandbox.stub(ArcGisUrl, "fetchJson" as any).callsFake(async function _(_url: URL) {
      return Promise.resolve({
        authInfo: { tokenServicesUrl: sampleGenerateTokenUrl },
      });
    });

    let restUrl;
    try {
      restUrl = await ArcGisUrl.getRestUrlFromGenerateTokenUrl(new URL(sampleRestUrl));
    } catch {

    }

    // The returned URL should match
    chai.assert.isDefined(restUrl);
    chai.expect(sampleRestUrl.toString()).to.equals(sampleRestUrl);

    // Make sure fetchJson has been called with the right request URL
    chai.expect(fetchJsonStub.calledOnce).to.be.true;
    const urlArg = fetchJsonStub.getCalls()[0].args[0] as URL;
    chai.expect(urlArg?.toString()).to.equals(`${sampleRestUrl}info?f=json`);
  });

});
