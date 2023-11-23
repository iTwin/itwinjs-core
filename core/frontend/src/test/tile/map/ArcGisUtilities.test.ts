/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import { MapLayerSource, MapLayerSourceStatus } from "../../../core-frontend";
import { ArcGisUtilities } from "../../../tile/map/ArcGisUtilities";
import { ArcGISMapLayerDataset } from "./ArcGISMapLayerDataset";
import { wsg84Lods256px, wsg84Lods512px } from "./Wgs84Lods";
import { MapLayerUrlParam } from "@itwin/core-common";

function stubGetServiceJson(sandbox: sinon.SinonSandbox, json: any ) {
  return sandbox.stub(ArcGisUtilities, "getServiceJson").callsFake(async function _(_url: string, _formatId: string, _userName?: string, _password?: string, _customParam?: MapLayerUrlParam[], _ignoreCache?: boolean, _requireToken?: boolean) {
    return json;
  });
}

const getSampleSource = () => {
  const source = MapLayerSource.fromJSON({
    name: "dummyFeatureLayer",
    url: "https://services7.arcgis.com/nZ2Vb4CUwdo9AIiQ/ArcGIS/rest/services/PhillyRailLines/MapServer",
    formatId: "Arcgis"});

  if (!source) {
    chai.assert.fail();
  }
  source.customParameters = [{key: "key1", value:"value1"}];
  source.userName = "username1";
  source.password = "password1";
  return source;
};

describe ("ArcGisUtilities", () => {
  const tolerance = 0.1;
  const sandbox = sinon.createSandbox();

  afterEach(async () => {
    sandbox.restore();
  });

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

  it("should validate by invoking getServiceJson with proper parameters ", async () => {
    const source = getSampleSource();
    const fetchStub = sandbox.stub(global, "fetch").callsFake(async function (_input: RequestInfo | URL, _init?: RequestInit) {
      return Promise.resolve((({
        status: 200,
        json: async () => {return {};},
      } as unknown) as Response));
    });
    await ArcGisUtilities.getServiceJson(source.url, source.formatId, source.userName, source.password, source.customParameters);

    expect(fetchStub.calledOnce).to.be.true;
    const firstCall = fetchStub.getCalls()[0];
    expect(firstCall.args[0]).to.equals(`${source.url}?f=json&key1=value1`);

  });

  it("should fetch service json with proper URL", async () => {
    const stub = stubGetServiceJson(sandbox, {content: ArcGISMapLayerDataset.UsaTopoMaps, accessTokenRequired:false});
    const source = getSampleSource();

    await ArcGisUtilities.validateSource(source.url, source.formatId, [], source.userName, source.password, source.customParameters);

    expect(stub.calledOnce).to.be.true;
    const firstCall = stub.getCalls()[0];
    expect(firstCall.args[0]).to.equals(source.url);
    expect(firstCall.args[1]).to.equals(source.formatId);
    expect(firstCall.args[2]).to.eqls(source.userName);
    expect(firstCall.args[3]).to.eqls(source.password);
    expect(firstCall.args[4]).to.eqls(source.customParameters);
  });

  it("should validate proper source", async () => {
    stubGetServiceJson(sandbox, {content: ArcGISMapLayerDataset.UsaTopoMaps, accessTokenRequired:false});
    const  result = ArcGisUtilities.validateSource("https:/localhost/Mapserver", "ArcGIS", []);
    expect((await result).status).to.equals(MapLayerSourceStatus.Valid);
  });

  it("validate should detect invalid coordinate system ", async () => {
    stubGetServiceJson(sandbox, {content: ArcGISMapLayerDataset.TilesOnlyDataset26918, accessTokenRequired:false});
    const  result = ArcGisUtilities.validateSource("https:/localhost/Mapserver", "ArcGIS",[]);
    expect((await result).status).to.equals(MapLayerSourceStatus.InvalidCoordinateSystem);
  });

  it("should validate url", async () => {
    let status = ArcGisUtilities.validateUrl("https://services7.arcgis.com/nZ2Vb4CUwdo9AIiQ/arcgis/rest/services/PhillyCityLandmarks/MapServer", "MapServer");
    expect(status).to.equals(MapLayerSourceStatus.Valid);

    status = ArcGisUtilities.validateUrl("https://services7.arcgis.com/nZ2Vb4CUwdo9AIiQ/arcgis/rest/services/PhillyCityLandmarks/MapServer", "mapserver");
    expect(status).to.equals(MapLayerSourceStatus.Valid);

    status = ArcGisUtilities.validateUrl("https://services7.arcgis.com/nZ2Vb4CUwdo9AIiQ/arcgis/rest/services/test/PhillyCityLandmarks/MapServer", "mapserver");
    expect(status).to.equals(MapLayerSourceStatus.Valid);

    status = ArcGisUtilities.validateUrl("https://services7.arcgis.com/nZ2Vb4CUwdo9AIiQ/arcgis/rest/services/PhillyCityLandmarks/MapServer", "FeatureServer");
    expect(status).to.equals(MapLayerSourceStatus.IncompatibleFormat);

    status = ArcGisUtilities.validateUrl("https://services7.arcgis.com/nZ2Vb4CUwdo9AIiQ/arcgis/restXYZ/services/PhillyCityLandmarks/MapServer", "FeatureServer");
    expect(status).to.equals(MapLayerSourceStatus.InvalidUrl);

  });
});
