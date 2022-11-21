/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import { ArcGisExtent, ArcGisFeatureQuery } from "../../ArcGisFeature/ArcGisFeatureQuery";

describe("ArcGisFeatureQuery", () => {

  const sandbox = sinon.createSandbox();

  beforeEach(async () => {
  });

  afterEach(async () => {
    sandbox.restore();
  });

  it("should not apply different switches if not needed", async () => {

    const query = new ArcGisFeatureQuery("https://test.com/rest/",0, "JSON", 3857);
    const queryUrl = query.toString();
    expect(queryUrl).to.not.contains("resultRecordCount");
    expect(queryUrl).to.not.contains("resultOffset");
    expect(queryUrl).to.not.contains("returnGeometry");
    expect(queryUrl).to.not.contains("resultType");
    expect(queryUrl).to.not.contains("maxRecordCountFactor");
    expect(queryUrl).to.not.contains("returnExceededLimitFeatures");
    expect(queryUrl).to.not.contains("geometryType");
    expect(queryUrl).to.not.contains("geometry");
    expect(queryUrl).to.not.contains("inSR");
    expect(queryUrl).to.not.contains("inSR");
    expect(queryUrl).to.contains("where=1%3D1");
  });

  it("should not apply different switches if not needed", async () => {

    const extentSize = 100;
    const fakeEnvelope: ArcGisExtent = {
      xmin : 0,
      ymin : 0,
      xmax : extentSize,
      ymax : extentSize,
      spatialReference : {
        wkid : 102100,
        latestWkid : 3857,
      }};
    const query = new ArcGisFeatureQuery("https://test.com/rest/",0, "JSON", 3857,
      {
        resultRecordCount: 10,
        resultOffset: 11,
        returnGeometry: true,
        geometry: {type:"esriGeometryEnvelope", geom:fakeEnvelope},
        geometryType: "esriGeometryEnvelope",
        spatialRel: "esriSpatialRelIntersects",
        resultType: "tile",
        maxRecordCountFactor: 1000,
        returnExceededLimitFeatures: false,
        quantizationParameters: {
          mode: "view",
          originPosition: "upperLeft",
          tolerance: 10,
          extent: fakeEnvelope,
        },
        outFields: "test",
        distance: 100,
      });
    const queryUrl = query.toString();
    expect(queryUrl).to.contains("resultRecordCount=10");
    expect(queryUrl).to.contains("resultOffset=11");
    expect(queryUrl).to.contains("returnGeometry=true");
    expect(queryUrl).to.contains(`resultType=tile`);
    expect(queryUrl).to.contains("maxRecordCountFactor=1000");
    expect(queryUrl).to.contains("returnExceededLimitFeatures=false");
    expect(queryUrl).to.contains("geometryType=esriGeometryEnvelope");
    expect(queryUrl).to.contains(`geometry=%7B%22xmin%22%3A0%2C%22ymin%22%3A0%2C%22xmax%22%3A100%2C%22ymax%22%3A100%2C%22spatialReference%22%3A%7B%22wkid%22%3A102100%2C%22latestWkid%22%3A3857%7D%7D`);
    expect(queryUrl).to.contains("inSR=102100");
    expect(queryUrl).to.contains("outFields=test");
    expect(queryUrl).to.contains("distance=100");
    expect(queryUrl).to.contains("units=esriSRUnit_Meter");

  });

  it("should not include geometry only when applicable", async () => {

    const extentSize = 100;
    const fakeEnvelope: ArcGisExtent = {
      xmin : 0,
      ymin : 0,
      xmax : extentSize,
      ymax : extentSize,
      spatialReference : {
        wkid : 102100,
        latestWkid : 3857,
      }};
    const query = new ArcGisFeatureQuery("https://test.com/rest/",0, "JSON", 3857,
      {
        spatialRel: "esriSpatialRelIntersects",
      });

    let queryUrl = query.toString();
    expect(queryUrl).to.not.contains("geometryType=");
    expect(queryUrl).to.not.contains(`geometry=`);
    expect(queryUrl).to.not.contains("inSR=");

    query.spatialRel = undefined;
    query.geometry = {type:"esriGeometryEnvelope", geom:fakeEnvelope};
    queryUrl = query.toString();
    expect(queryUrl).to.contains("geometryType=esriGeometryEnvelope");
    expect(queryUrl).to.contains(`geometry=%7B%22xmin%22%3A0%2C%22ymin%22%3A0%2C%22xmax%22%3A100%2C%22ymax%22%3A100%2C%22spatialReference%22%3A%7B%22wkid%22%3A102100%2C%22latestWkid%22%3A3857%7D%7D`);
    expect(queryUrl).to.contains("inSR=102100");

  });

});
