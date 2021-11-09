/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Point3d, XYZProps } from "@bentley/geometry-core";
import { GeoCoordinatesResponseProps, GeoCoordStatus, IModelCoordinatesResponseProps } from "@bentley/imodeljs-common";
import { GeoConverter, IModelApp, IModelConnection, SnapshotConnection } from "@bentley/imodeljs-frontend";

// spell-checker: disable

describe("GeoCoord", () => {
  let iModel: IModelConnection;
  const geoPointList: XYZProps[] = [];
  let wgs84Converter: GeoConverter;
  let nad27Converter: GeoConverter;
  let sameDatumConverter: GeoConverter;
  let wgs84Response: IModelCoordinatesResponseProps;
  let wgs84GeoCoordsResponse: GeoCoordinatesResponseProps;

  before(async () => {
    await IModelApp.startup();
    iModel = await SnapshotConnection.openFile("mirukuru.ibim"); // relative path resolved by BackendTestAssetResolver
    // make an array of 10x10 geoPoints in geoPointList.
    for (let iLatitude: number = 0; iLatitude < 10; iLatitude++) {
      for (let iLongitude: number = 0; iLongitude < 10; iLongitude++) {
        geoPointList.push({ x: (132.600 + 0.02 * iLongitude), y: (34.350 + 0.02 * iLatitude), z: 0.0 });
      }
    }
    wgs84Converter = iModel.geoServices.getConverter("WGS84")!;
    nad27Converter = iModel.geoServices.getConverter("NAD27")!;
    sameDatumConverter = iModel.geoServices.getConverter()!;
  });

  after(async () => {
    if (iModel) await iModel.close();
    await IModelApp.shutdown();
  });

  it("should get different results for different datums", async () => {
    const testPoints: XYZProps[] = [];
    for (let iGeoPoint: number = 1; iGeoPoint < geoPointList.length; iGeoPoint += 2) {
      testPoints.push(geoPointList[iGeoPoint]);
    }

    wgs84Response = await wgs84Converter.getIModelCoordinatesFromGeoCoordinates(testPoints);

    // shouldn't have any from the cache.
    expect(wgs84Response.fromCache === 0).to.be.true;

    // shouldn't have any failures.
    for (const result of wgs84Response.iModelCoords) {
      expect(GeoCoordStatus.Success === result.s);
    }

    const nad27Response = await nad27Converter.getIModelCoordinatesFromGeoCoordinates(testPoints);

    // shouldn't have any from the cache.
    expect(nad27Response.fromCache === 0).to.be.true;

    for (const result of nad27Response.iModelCoords) {
      expect(GeoCoordStatus.Success === result.s).to.be.true;
    }

    // we expect the iModelCoord results from treating the geoCoords as WGS84 lat/longs to be different from what we get treating them as NAD27 lat/longs.
    for (let iPoint: number = 0; iPoint < wgs84Response.iModelCoords.length; ++iPoint) {
      const wgs84Point = Point3d.fromJSON(wgs84Response.iModelCoords[iPoint].p);
      const nad27Point = Point3d.fromJSON(nad27Response.iModelCoords[iPoint].p);
      expect(wgs84Point.isAlmostEqual(nad27Point)).to.be.false;
    }

    const sameDatumResponse = await sameDatumConverter.getIModelCoordinatesFromGeoCoordinates(testPoints);

    // shouldn't have any from the cache.
    expect(sameDatumResponse.fromCache === 0).to.be.true;

    for (const result of sameDatumResponse.iModelCoords) {
      expect(GeoCoordStatus.Success === result.s).to.be.true;
    }
  });

  it("should read repeated requests from the cache", async () => {
    // use the same points as the first test.
    const testPoints: XYZProps[] = [];
    for (let iGeoPoint: number = 1; iGeoPoint < geoPointList.length; iGeoPoint += 2) {
      testPoints.push(geoPointList[iGeoPoint]);
    }
    // when we ask again, we expect faster response as no round trip is necessary, but we expect the same results.
    const wgs84Response2 = await wgs84Converter.getIModelCoordinatesFromGeoCoordinates(testPoints);

    // they should all come from the cache.
    expect(wgs84Response2.fromCache === 50).to.be.true;

    // expect ok status for each.
    for (const result of wgs84Response.iModelCoords) {
      expect(GeoCoordStatus.Success === result.s).to.be.true;
    }

    // expect equal answers for all of them.
    for (let iPoint: number = 0; iPoint < wgs84Response.iModelCoords.length; ++iPoint) {
      const wgs84Point = Point3d.fromJSON(wgs84Response.iModelCoords[iPoint].p);
      const wgs84Point2 = Point3d.fromJSON(wgs84Response2.iModelCoords[iPoint].p);
      expect(wgs84Point.isAlmostEqual(wgs84Point2)).to.be.true;
    }

    // now try the round trip to make sure they are close.
    const wgs84IModelPoints: XYZProps[] = [];
    for (const thisPoint of wgs84Response.iModelCoords)
      wgs84IModelPoints.push(thisPoint.p);

    // convert back to geoCoords and compare
    wgs84GeoCoordsResponse = await wgs84Converter.getGeoCoordinatesFromIModelCoordinates(wgs84IModelPoints);

    for (const result of wgs84GeoCoordsResponse.geoCoords) {
      expect(GeoCoordStatus.Success === result.s).to.be.true;
    }

    // round-tripped result should be close to original point for each of the three datum responses.
    for (let iPoint: number = 0; iPoint < testPoints.length; ++iPoint) {
      const thisPoint = Point3d.fromJSON(testPoints[iPoint]);
      const thatPoint = Point3d.fromJSON(wgs84GeoCoordsResponse.geoCoords[iPoint].p);
      expect(thisPoint.isAlmostEqual(thatPoint)).to.be.true;
    }
  });

  it("should get some IModelCoords from the cache and calculate some", async () => {
    // use the first 10 points.
    const testPoints: XYZProps[] = [];
    for (let iGeoPoint: number = 0; iGeoPoint < 10; ++iGeoPoint) {
      testPoints.push(geoPointList[iGeoPoint]);
    }

    const first10Response = await wgs84Converter.getIModelCoordinatesFromGeoCoordinates(testPoints);

    // expect half from cache.
    expect(first10Response.fromCache === 5).to.be.true;

    // the longitude values are increasing, so we expect the x values to increase.
    for (let iPoint = 0; iPoint < (testPoints.length - 1); iPoint++) {
      const firstPoint = Point3d.fromJSON(first10Response.iModelCoords[iPoint].p);
      const secondPoint = Point3d.fromJSON(first10Response.iModelCoords[iPoint + 1].p);
      expect(firstPoint.x < secondPoint.x).to.be.true;
    }
  });

  it("should get some GeoCoords from the cache and calculate some", async () => {
    // interleave the first 10 points with some halfway between.
    const testPoints: XYZProps[] = [];
    for (let iIModelPoint: number = 0; iIModelPoint < 10; ++iIModelPoint) {
      testPoints.push(wgs84Response.iModelCoords[iIModelPoint].p);
      const firstPoint = Point3d.fromJSON(wgs84Response.iModelCoords[iIModelPoint].p);
      const secondPoint = Point3d.fromJSON(wgs84Response.iModelCoords[iIModelPoint + 1].p);
      const pointBetween = {
        x: (firstPoint.x + secondPoint.x) / 2,
        y: (firstPoint.y + secondPoint.y) / 2,
        z: 0,
      };
      testPoints.push(pointBetween);
    }

    const mixedResponse = await wgs84Converter.getGeoCoordinatesFromIModelCoordinates(testPoints);
    expect(mixedResponse.fromCache === 10).to.be.true;
  });
});
