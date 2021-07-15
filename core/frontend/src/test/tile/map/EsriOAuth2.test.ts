/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";

import { EsriOAuth2EndpointType } from "../../../tile/map/EsriOAuth2";
import * as sinon from "sinon";
import { ArcGisUtilities, EsriOAuth2 } from "../../../tile/internal";

describe("ESRI OAuth2", () => {
  const sandbox = sinon.createSandbox();

  afterEach(async () => {
    sandbox.restore();
  });

  const sampleOnPremiseFeatureServer1 = "https://dtlgeoarcgis.adtl.com/server/rest/services/SampleWorldCities/FeatureServer/";
  const sampleAuthorizeUrl1 = "https://dtlgeoarcgis.adtl.com/portal/sharing/rest/oauth2/authorize";
  const sampleTokenUrl1 = "https://dtlgeoarcgis.adtl.com/portal/sharing/rest/oauth2/token";
  const sampleGenerateTokenUrl1 = "https://dtlgeoarcgis.adtl.com/portal/sharing/rest/generateToken";

  const sampleOnPremiseFeatureServer2 = "https://dtlgeoarcgis.adtl.com/arcgis/rest/services/SampleWorldCities/FeatureServer/";
  const sampleAuthorizeUrl2 = "https://dtlgeoarcgis.adtl.com/arcgis/sharing/rest/oauth2/authorize";
  const sampleTokenUrl2 = "https://dtlgeoarcgis.adtl.com/portal/sharing/rest/oauth2/token";

  const sampleOnlineFeatureServer1 = "https://services3.arcgis.com/RRwXxn3KKYHT7QV6/arcgis/rest/services/Quebec/MapServer";
  const sampleOnlineAuthorize1 = "https://www.arcgis.com/sharing/rest/oauth2/authorize";
  const sampleOnlineToken1 = "https://www.arcgis.com/sharing/rest/oauth2/token";

  it("should build proper OAuth2 endpoint URL using generateTokenUrl", async () => {

    sandbox.stub(EsriOAuth2, "validateOAuth2Endpoint").resolves(true);
    sandbox.stub(ArcGisUtilities, "requestGetJson").callsFake(async function _(_url: string) {
      return Promise.resolve({ body: {authInfo : {tokenServicesUrl: sampleGenerateTokenUrl1}}, text: undefined, status: 200, header: undefined });
    });

    const authorize1 =  await EsriOAuth2.getOAuth2EndpointFromMapLayerUrl(sampleOnPremiseFeatureServer1, EsriOAuth2EndpointType.Authorize);

    expect(authorize1).to.not.undefined;
    expect(authorize1?.getUrl()).to.equals(sampleAuthorizeUrl1);

    const token1 =  await EsriOAuth2.getOAuth2EndpointFromMapLayerUrl(sampleOnPremiseFeatureServer1, EsriOAuth2EndpointType.Token);
    expect(token1).to.not.undefined;
    expect(token1?.getUrl()).to.equals(sampleTokenUrl1);

  });

  it("should build proper OAuth2 endpoint URL if no generateTokenUrl response", async () => {

    sandbox.stub(EsriOAuth2, "validateOAuth2Endpoint").resolves(true);
    sandbox.stub(ArcGisUtilities, "requestGetJson").callsFake(async function _(_url: string) {
      return Promise.resolve({ body:  undefined, text: undefined, status: 404, header: undefined });
    });

    const endpointUrl =  await EsriOAuth2.getOAuth2EndpointFromMapLayerUrl(sampleOnPremiseFeatureServer2, EsriOAuth2EndpointType.Authorize);

    expect(endpointUrl).to.not.undefined;
    expect(endpointUrl?.getUrl()).to.equals(sampleAuthorizeUrl2);

    const token1 =  await EsriOAuth2.getOAuth2EndpointFromMapLayerUrl(sampleOnPremiseFeatureServer1, EsriOAuth2EndpointType.Token);
    expect(token1).to.not.undefined;
    expect(token1?.getUrl()).to.equals(sampleTokenUrl2);

  });

  it("should build proper OAuth2 endpoint URL if could not validate url base on generateTokenUrl", async () => {

    sandbox.stub(EsriOAuth2, "validateOAuth2Endpoint")
      .callsFake(async function _(url: string)  {
        return (url.includes("/oauth2") ? Promise.resolve(true) : Promise.resolve(false));
      });

    sandbox.stub(ArcGisUtilities, "requestGetJson").callsFake(async function _(_url: string)  {
      return Promise.resolve({ body: {authInfo : {tokenServicesUrl: sampleGenerateTokenUrl1}}, text: undefined, status: 200, header: undefined });
    });

    let endpointUrl =  await EsriOAuth2.getOAuth2EndpointFromMapLayerUrl(sampleOnPremiseFeatureServer2, EsriOAuth2EndpointType.Authorize);

    expect(endpointUrl).to.not.undefined;
    expect(endpointUrl?.getUrl()).to.equals(sampleAuthorizeUrl2);

    endpointUrl = await EsriOAuth2.getOAuth2EndpointFromMapLayerUrl(sampleOnPremiseFeatureServer1, EsriOAuth2EndpointType.Token);
    expect(endpointUrl).to.not.undefined;
    expect(endpointUrl?.getUrl()).to.equals(sampleTokenUrl2);

  });

  it("should build proper OAuth2 endpoint URL if ArcGIS online", async () => {

    let endpointUrl =  await EsriOAuth2.getOAuth2EndpointFromMapLayerUrl(sampleOnlineFeatureServer1, EsriOAuth2EndpointType.Authorize);

    expect(endpointUrl).to.not.undefined;
    expect(endpointUrl?.getUrl()).to.equals(sampleOnlineAuthorize1);

    endpointUrl = await EsriOAuth2.getOAuth2EndpointFromMapLayerUrl(sampleOnlineFeatureServer1, EsriOAuth2EndpointType.Token);
    expect(endpointUrl).to.not.undefined;
    expect(endpointUrl?.getUrl()).to.equals(sampleOnlineToken1);

  });

});
