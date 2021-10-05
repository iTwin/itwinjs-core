/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Geometry, Point3d, XYZProps } from "@itwin/core-geometry";
import { GeoCoordinatesResponseProps, GeoCoordStatus, GeographicCRSProps, IModelCoordinatesResponseProps, PointWithStatus } from "@itwin/core-common";
import { GeoConverter, IModelApp, IModelConnection, SnapshotConnection } from "@itwin/core-frontend";

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

  it("should get proper result from datum conversion", async () => {

    const convertTest = async (fileName: string, datum: string | GeographicCRSProps, inputCoord: XYZProps, outputCoord: PointWithStatus) => {

      const iModelConnection = await SnapshotConnection.openFile(fileName);

      const datumConverter = iModelConnection.geoServices.getConverter(datum)!;

      const testPoint: XYZProps[] = [];
      testPoint.push(inputCoord);

      const response = await datumConverter.getGeoCoordinatesFromIModelCoordinates(testPoint);

      const expectedPt = Point3d.fromJSON(outputCoord.p);
      const outPt = Point3d.fromJSON(response.geoCoords[0].p);

      expect(Geometry.isSamePoint3dXY(expectedPt, outPt)).to.be.true;
      expect(response.geoCoords[0].s === outputCoord.s);
    };

    await convertTest("UTM83-10-NGVD29.bim", { horizontalCRS: { id: "LL84"}, verticalCRS: {id: "ELLIPSOID"} }, {x: 632748.112, y: 4263868.307, z: 0.0}, {p: {x: -121.47738265889652, y: 38.513305313793019, z: -32.352342418737663}, s: 0});

    await convertTest("BritishNatGrid-Ellipsoid.bim", "", {x: 170370.71800000000000, y: 11572.40500000000000, z: 0.0}, {p: {x: -5.2020119082059511, y: 49.959453295440234, z: 0.0}, s: 0});
    await convertTest("BritishNatGrid-Ellipsoid.bim", "ETRF89", {x: 170370.71800000000000, y: 11572.40500000000000, z: 0.0}, {p: {x: -5.2030365061523707, y: 49.960007477936202, z: 0.0}, s: 0});
    await convertTest("BritishNatGrid-Ellipsoid.bim", "OSGB", {x: 170370.71800000000000, y: 11572.40500000000000, z: 0.0}, {p: {x: -5.2020119082059511, y: 49.959453295440234, z: 0.0}, s: 0});
    await convertTest("GermanyDHDN-3-Ellipsoid.bim", "", {x: 4360857.005, y: 5606083.067, z: 0.0}, {p: {x: 10.035413954488630, y: 50.575070810112159, z: 0.0}, s: 0});
    await convertTest("GermanyDHDN-3-Ellipsoid.bim", "DHDN/3", {x: 4360857.005, y: 5606083.067, z: 0.0}, {p: {x: 10.035413954488630, y: 50.575070810112159, z: 0.0}, s: 0});
    await convertTest("GermanyDHDN-3-Ellipsoid.bim", "WGS84", {x: 4360857.005, y: 5606083.067, z: 0.0}, {p: {x: 10.034215937440818, y: 50.573862480894853, z: 0.0}, s: 0});
    await convertTest("UTM83-10-NGVD29.bim", "", {x: 632748.112, y: 4263868.307, z: 0.0}, {p: {x: -121.47738265889652, y: 38.513305313793019, z: 0.0}, s: 0});
    await convertTest("UTM83-10-NGVD29.bim", "NAD83", {x: 632748.112, y: 4263868.307, z: 0.0}, {p: {x: -121.47738265889652, y: 38.513305313793019, z: -32.352342418737663}, s: 0});
    await convertTest("UTM83-10-NGVD29.bim", "WGS84", {x: 632748.112, y: 4263868.307, z: 0.0}, {p: {x: -121.47738265889652, y: 38.513305313793019, z: -32.352342418737663}, s: 0});
    await convertTest("UTM27-10-Ellipsoid.bim", "", {x: 623075.328, y: 4265650.532, z: 0.0}, {p: {x: -121.58798236995744, y: 38.532616292207997, z: 0.0}, s: 0});
    await convertTest("UTM27-10-Ellipsoid.bim", "NAD83", {x: 623075.328, y: 4265650.532, z: 0.0}, {p: {x: -121.58905088839697, y: 38.532522753851708, z: 0.0}, s: 0});

    await convertTest("UTM83-10-NGVD29.bim", { horizontalCRS: { id: "LL84"}, verticalCRS: {id: "ELLIPSOID"} }, {x: 632748.112, y: 4263868.307, z: 0.0}, {p: {x: -121.47738265889652, y: 38.513305313793019, z: -32.352342418737663}, s: 0});

    await convertTest("UTM83-10-NGVD29.bim", { horizontalCRS: { id: "LL84"}, verticalCRS: {id: "ELLIPSOID"} }, {x: 632748.112, y: 4263868.307, z: 0.0}, {p: {x: -121.47738265889652, y: 38.513305313793019, z: -32.352342418737663}, s: 0});
    await convertTest("UTM83-10-NGVD29.bim",
      {
        horizontalCRS: {
          id: "California2",
          description : "USES CUSTOM DATUM",
          source : "Test",
          deprecated : false,
          datumId : "TEST-GRID",
          datum : {
            id: "TEST-GRID",
            description : "TEST DATUM - Uses custom ell and custom transfo",
            deprecated : false,
            source : "Emmo",
            ellipsoidId : "CustomEllipsoid1",
            ellipsoid : {
              id: "CustomEllipsoid1",
              description : "Custom Ellipsoid1 Description",
              source : "Custom Ellipsoid1 Source",
              equatorialRadius : 6378171.1,
              polarRadius : 6356795.719195306},
            transforms: [
              {
                method: "Geocentric",
                sourceEllipsoid : {
                  id: "CustomEllipsoid2",
                  equatorialRadius : 6378171.1,
                  polarRadius : 6356795.719195306},
                targetEllipsoid : {
                  id: "CustomEllipsoid3",
                  equatorialRadius : 6378174.1,
                  polarRadius : 6356796.1},
                geocentric : {
                  delta: {
                    x: -15,
                    y : 18,
                    z : 46}}},
              {
                method: "PositionalVector",
                positionalVector : {
                  scalePPM: 2.4985,
                  delta : {
                    x: -120.271,
                    y : -64.543,
                    z : 161.632},
                  rotation : {
                    x: 0.2175,
                    y : -0.0672,
                    z : -0.1291}},
                sourceEllipsoid : {
                  id: "CustomEllipsoid3",
                  equatorialRadius : 6378174.1,
                  polarRadius : 6356796.1},
                targetEllipsoid : {
                  id: "WGS84",
                  equatorialRadius : 6378137.0,
                  polarRadius : 6356752.3142}}]},
          unit: "Meter",
          projection : {
            method: "LambertConformalConicTwoParallels",
            longitudeOfOrigin : -122,
            latitudeOfOrigin : 37.66666666667,
            standardParallel1 : 39.833333333333336,
            standardParallel2 : 38.333333333333334,
            falseEasting : 2000000.0,
            falseNorthing : 500000.0},
          extent: {
            southWest: {
              latitude: 35,
              longitude: -125},
            northEast: {
              latitude: 39.1,
              longitude: -120.45}}},
        verticalCRS : {
          id : "GEOID"}}, {x: 632748.112, y: 4263868.307, z: 0.0}, {p: {x: 2045672.959210648, y: 594018.471211601, z: 0.7621583779125531}, s: 0});
  });

});
