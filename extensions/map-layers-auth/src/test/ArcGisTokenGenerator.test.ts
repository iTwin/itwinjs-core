/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { ArcGisTokenGenerator } from "../map-layers-auth";
import * as fetchMock from "fetch-mock";

describe("ArcGisTokenGenerator", () => {
  const sandbox = sinon.createSandbox();

  const sampleBaseRestUrl = "https://dtlgeoarcgis.adtl.com/server/rest/";
  const sampleServiceUrl = `${sampleBaseRestUrl}services/NewYork/NewYork3857/MapServer`;
  const sampleGenerateTokenUrl = `${sampleBaseRestUrl}https://dtlgeoarcgis.adtl.com/server/rest/generateToken`;

  afterEach(async () => {
    sandbox.restore();
    fetchMock.restore();
  });

  it("should make proper info request and extract tokenServicesUrl from response", async () => {
    sandbox.stub(global, "fetch").callsFake(async function (_input, _init) {
      return Promise.resolve((({
        status: 200,
        json: async () => { return; },
      } as unknown) as Response));
    });

    const mock = fetchMock.mock("*", {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: { authInfo: { isTokenBasedSecurity: true, tokenServicesUrl: sampleGenerateTokenUrl } },
    });

    const tokenServiceUrl = await ArcGisTokenGenerator.fetchTokenServiceUrl(sampleServiceUrl);
    expect(mock.called()).to.be.true;
    expect(mock.lastUrl()).to.be.equals(`${sampleBaseRestUrl}info?f=pjson`);
    expect(sampleGenerateTokenUrl).to.be.equals(tokenServiceUrl);
  });
});
