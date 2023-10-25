/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { ArcGisTokenGenerator } from "../map-layers-auth";

describe("ArcGisTokenGenerator", () => {
  const sandbox = sinon.createSandbox();

  const sampleBaseRestUrl = "https://dtlgeoarcgis.adtl.com/server/rest/";
  const sampleServiceUrl = `${sampleBaseRestUrl}services/NewYork/NewYork3857/MapServer`;
  const sampleGenerateTokenUrl = `${sampleBaseRestUrl}https://dtlgeoarcgis.adtl.com/server/rest/generateToken`;

  afterEach(async () => {
    sandbox.restore();
  });

  it("should make proper info request and extract tokenServicesUrl from response", async () => {
    const fetchStub = sandbox.stub(global, "fetch").callsFake(async function (_input, _init) {

      return Promise.resolve((({
        status: 200,
        json: async () => {return {authInfo: {isTokenBasedSecurity: true, tokenServicesUrl: sampleGenerateTokenUrl}};},
      } as unknown) as Response));
    });

    const tokenServiceUrl = await ArcGisTokenGenerator.fetchTokenServiceUrl(sampleServiceUrl);
    expect(fetchStub.calledOnce).to.be.true;
    expect(fetchStub.getCalls()[0].args[0]).to.be.equals(`${sampleBaseRestUrl}info?f=pjson`);

    expect(sampleGenerateTokenUrl).to.be.equals(tokenServiceUrl);

  });
});
