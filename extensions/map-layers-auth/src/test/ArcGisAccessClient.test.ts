/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";

import * as sinon from "sinon";
import { ArcGisAccessClient, ArcGisOAuth2Endpoint, ArcGisUrl } from "../map-layers-auth";

global.fetch = async (_input, _init) => {

  return Promise.resolve((({
    status: 400,
  } as unknown) as Response));
};

describe("ArcGisUtilities tests", () => {
  const sandbox = sinon.createSandbox();
  let fakeAccessClient: ArcGisAccessClient | undefined;

  beforeEach(async () => {
    fakeAccessClient = new ArcGisAccessClient();
    fakeAccessClient.initialize({
      redirectUri: "https://test.com/oauth-redirect",
      clientIds: {
        arcgisOnlineClientId: "dummy_clientId1",
        enterpriseClientIds: [{
          serviceBaseUrl: "https://dtlgeoarcgis.adtl.com",
          clientId: "dummy_clientId2",
        }],
      },
    });

  });

  afterEach(async () => {
    sandbox.restore();
    fakeAccessClient = undefined;
  });

  const sampleOnPremiseHostName = "https://dtlgeoarcgis.adtl.com";
  const sampleOnPremiseMapServer = `${sampleOnPremiseHostName}/server/rest/services/NewYork/NewYork3857/MapServer`;
  const sampleOnPremiseMapServerRestUrl = `${sampleOnPremiseHostName}/portal/sharing/rest/`;
  const sampleOnPremiseMapServerAuthorizeUrl = `${sampleOnPremiseMapServerRestUrl}oauth2/authorize`;
  const sampleOnPremiseMapServerFallbackAuthorizeUrl = `${sampleOnPremiseHostName}/server/sharing/rest/oauth2/authorize`;

  const sampleOnlineAuthorize1 = "https://www.arcgis.com/sharing/rest/oauth2/authorize";

  it("should find the matching enterprise client id ", async () => {

    let clientId = (fakeAccessClient as any)!.getMatchingEnterpriseClientId(sampleOnPremiseHostName);
    expect(clientId).to.not.undefined;
    expect(clientId === fakeAccessClient?.arcGisEnterpriseClientIds![0].clientId);

    // Check it returns undefined if no match (and not default value set)
    clientId = (fakeAccessClient as any).getMatchingEnterpriseClientId("https://yyz.com");
    expect(clientId === undefined);

    // Check it uses the default value, if specified
    fakeAccessClient?.setEnterpriseClientId("", "dummy_clientId1");
    clientId = (fakeAccessClient as any).getMatchingEnterpriseClientId("https://yyz.com");
    expect(clientId === undefined);

  });
  it("should construct the proper login Url from a enterprise token url", async () => {

    const loginURl = (fakeAccessClient as any).constructLoginUrl(sampleOnPremiseMapServerAuthorizeUrl, false);

    const refLoginUrl = new URL(sampleOnPremiseMapServerAuthorizeUrl);
    refLoginUrl.searchParams.append("client_id", fakeAccessClient!.getMatchingEnterpriseClientId("https://dtlgeoarcgis.adtl.com")!);
    refLoginUrl.searchParams.append("response_type", "token");
    refLoginUrl.searchParams.append("redirect_uri", fakeAccessClient!.redirectUri!);

    expect(loginURl).to.equals(refLoginUrl.toString());
  });

  it("should construct the proper login Url from arcgis online token url", async () => {

    const loginURl = (fakeAccessClient as any).constructLoginUrl(sampleOnlineAuthorize1, true);

    const refLoginUrl = new URL(sampleOnlineAuthorize1);
    refLoginUrl.searchParams.append("client_id", fakeAccessClient!.arcGisOnlineClientId!);
    refLoginUrl.searchParams.append("response_type", "token");
    refLoginUrl.searchParams.append("redirect_uri", fakeAccessClient!.redirectUri!);

    expect(loginURl).to.equals(refLoginUrl.toString());
  });

  it("should build proper OAuth2 enterprise endpoint URL using generateTokenUrl", async () => {

    sandbox.stub(ArcGisUrl, "getRestUrlFromGenerateTokenUrl").callsFake(async function _(_url: URL) {
      return Promise.resolve(new URL(sampleOnPremiseMapServerRestUrl));
    });

    const onPremiseEndpoint = await fakeAccessClient?.getTokenServiceEndPoint(sampleOnPremiseMapServer);
    let acOnPremiseEndpoint;
    if (onPremiseEndpoint instanceof ArcGisOAuth2Endpoint)
      acOnPremiseEndpoint = onPremiseEndpoint;

    expect(acOnPremiseEndpoint).to.not.undefined;
    expect(acOnPremiseEndpoint?.isArcgisOnline).to.false;
    expect(acOnPremiseEndpoint?.getUrl()).to.equals(sampleOnPremiseMapServerAuthorizeUrl);

  });

  it("should only allow URLs with valid host", async () => {
    const validUrl = new URL("https://services7.arcgis.com/nZ2Vb4CUwdo9AIiQ/arcgis/rest/services/PhillyTransportationImprovementProject/MapServer");
    expect((fakeAccessClient as any).isArcGisHostValid(validUrl)).to.true;

    const invalidUrl = new URL("https://services7.randomurl.com/nZ2Vb4CUwdo9AIiQ/arcgis/rest/services/PhillyTransportationImprovementProject/MapServer");
    expect((fakeAccessClient as any).isArcGisHostValid(invalidUrl)).to.false;

    const capitalUrl = new URL("https://services7.ArcGis.Com/nZ2Vb4CUwdo9AIiQ/arcgis/rest/services/PhillyTransportationImprovementProject/MapServer");
    expect((fakeAccessClient as any).isArcGisHostValid(capitalUrl)).to.true;
  });

  it("should build proper OAuth2 enterprise endpoint URL if no generateTokenUrl response", async () => {

    sandbox.stub(ArcGisUrl, "getRestUrlFromGenerateTokenUrl").callsFake(async function _(_url: URL) {
      return Promise.resolve(undefined);
    });

    const onPremiseEndpoint = await fakeAccessClient?.getTokenServiceEndPoint(sampleOnPremiseMapServer);
    let acOnPremiseEndpoint;
    if (onPremiseEndpoint instanceof ArcGisOAuth2Endpoint)
      acOnPremiseEndpoint = onPremiseEndpoint;

    expect(acOnPremiseEndpoint).to.not.undefined;
    expect(acOnPremiseEndpoint?.isArcgisOnline).to.false;
    expect(acOnPremiseEndpoint?.getUrl()).to.equals(sampleOnPremiseMapServerFallbackAuthorizeUrl);

  });

});
