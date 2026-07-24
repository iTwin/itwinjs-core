/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Guid, ProcessDetector } from "@itwin/core-bentley";
import {
  EcefLocation, GeoCoordinatesRequestProps, GeoCoordStatus, GeographicCRS, GeographicCRSProps, IModelCoordinatesRequestProps, PointWithStatus,
} from "@itwin/core-common";
import { Geometry, Point3d, XYZProps } from "@itwin/core-geometry";
import { withEditTxn } from "../../EditTxn";
import { SnapshotDb } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { TestUtils } from "../TestUtils";
import { createIModelFromSeed } from "./IModelTestFixtures";

// spell-checker: disable

describe("iModel geolocation", () => {
  let mirukuruReadonly: SnapshotDb;
  let originalEnv: any;

  before(async () => {
    originalEnv = { ...process.env };

    await TestUtils.shutdownBackend();
    await TestUtils.startBackend({ loadGcsWorkspaces: true });

    IModelTestUtils.registerTestBimSchema();

    const mirukuruWritable = createIModelFromSeed("geolocation-mirukuru.ibim", "mirukuru.ibim");
    const mirukuruPath = mirukuruWritable.pathName;
    mirukuruWritable.close();
    mirukuruReadonly = SnapshotDb.openFile(mirukuruPath);
  });

  after(async () => {
    process.env = originalEnv;

    if (mirukuruReadonly !== undefined && mirukuruReadonly.isOpen)
      mirukuruReadonly.close();

    await TestUtils.shutdownBackend();
    await TestUtils.startBackend();
  });

  it("ecefLocation for iModels", () => {
    assert.isTrue(mirukuruReadonly.isGeoLocated);
    const center = { x: 289095, y: 3803860, z: 10 }; // near center of project extents, 10 meters above ground.
    const ecefPt = mirukuruReadonly.spatialToEcef(center);
    const pt = { x: -3575156.3661052254, y: 3873432.0891543664, z: 3578996.012643183 };
    assert.isTrue(ecefPt.isAlmostEqual(pt), "spatialToEcef");

    const z2 = mirukuruReadonly.ecefToSpatial(ecefPt);
    assert.isTrue(z2.isAlmostEqual(center), "ecefToSpatial");

    const carto = mirukuruReadonly.spatialToCartographicFromEcef(center);
    assert.approximately(carto.longitudeDegrees, 132.70683882277805, .1); // this data is in Japan
    assert.approximately(carto.latitudeDegrees, 34.35462768786055, .1);
    const c2 = { longitude: 2.3161712773709127, latitude: 0.5996013664499733, height: 10 };
    assert.isTrue(carto.equalsEpsilon(c2, .001), "spatialToCartographic");

    mirukuruReadonly.cartographicToSpatialFromEcef(carto, z2);
    assert.isTrue(z2.isAlmostEqual(center, .001), "cartographicToSpatial");

    assert.isTrue(mirukuruReadonly.geographicCoordinateSystem !== undefined);
    assert.isTrue(mirukuruReadonly.geographicCoordinateSystem!.horizontalCRS !== undefined);
    assert.isTrue(mirukuruReadonly.geographicCoordinateSystem!.verticalCRS !== undefined);
    assert.isTrue(mirukuruReadonly.geographicCoordinateSystem!.verticalCRS!.id !== undefined);
    assert.isTrue(mirukuruReadonly.geographicCoordinateSystem!.horizontalCRS!.id === "UTM84-53N");
    assert.isTrue(mirukuruReadonly.geographicCoordinateSystem!.verticalCRS!.id === "ELLIPSOID");
  });

  it("should be able to create a snapshot IModel and set geolocation by GCS", async () => {
    const args = {
      rootSubject: { name: "TestSubject", description: "test iTwin" },
      client: "ABC Engineering",
      globalOrigin: { x: 10, y: 10 },
      projectExtents: { low: { x: -300, y: -300, z: -20 }, high: { x: 500, y: 500, z: 400 } },
      guid: Guid.createValue(),
    };

    const gcs = new GeographicCRS({
      horizontalCRS: {
        id: "10TM115-27",
        description: "",
        source: "Mentor Software Client",
        deprecated: false,
        datumId: "NAD27",
        unit: "Meter",
        projection: {
          method: "TransverseMercator",
          centralMeridian: -115,
          latitudeOfOrigin: 0,
          scaleFactor: 0.9992,
          falseEasting: 0.0,
          falseNorthing: 0.0,
        },
        extent: {
          southWest: { latitude: 48, longitude: -120.5 },
          northEast: { latitude: 84, longitude: -109.5 },
        },
      },
      verticalCRS: { id: "GEOID" },
      additionalTransform: {
        helmert2DWithZOffset: {
          translationX: 10.0,
          translationY: 15.0,
          translationZ: 0.02,
          rotDeg: 1.2,
          scale: 1.0001,
        },
      },
    });

    const testFile = IModelTestUtils.prepareOutputFile("IModel", "TestSnapshot2.bim");
    const iModel = SnapshotDb.createEmpty(testFile, args);

    let eventListenedTo = false;
    const gcsListener = (previousGCS: GeographicCRS | undefined) => {
      assert.equal(previousGCS, undefined);
      assert.isTrue(iModel.geographicCoordinateSystem !== undefined);
      assert.isTrue(iModel.geographicCoordinateSystem!.equals(gcs));
      eventListenedTo = true;
    };
    iModel.onGeographicCoordinateSystemChanged.addListener(gcsListener);

    assert.isTrue(iModel.geographicCoordinateSystem === undefined);

    assert.isFalse(eventListenedTo);

    iModel.geographicCoordinateSystem = gcs;

    assert.isTrue(eventListenedTo);

    withEditTxn(iModel, (txn) => {
      txn.updateIModelProps();
    });
    iModel.close();

    const iModel2 = SnapshotDb.openFile(testFile);

    assert.isTrue(iModel2.geographicCoordinateSystem !== undefined);

    // The reloaded gcs will be different as the datum definition will have been expanded
    assert.isFalse(iModel2.geographicCoordinateSystem!.equals(gcs));

    // But other properties will be identical
    assert.isTrue(iModel2.geographicCoordinateSystem !== undefined);
    assert.isTrue(iModel2.geographicCoordinateSystem!.verticalCRS !== undefined);
    assert.isTrue(iModel2.geographicCoordinateSystem!.verticalCRS!.equals(gcs.verticalCRS!));
    assert.isTrue(iModel2.geographicCoordinateSystem!.additionalTransform !== undefined);
    assert.isTrue(iModel2.geographicCoordinateSystem!.additionalTransform!.equals(gcs.additionalTransform!));
    assert.isTrue(iModel2.geographicCoordinateSystem!.horizontalCRS !== undefined);
    assert.isTrue(iModel2.geographicCoordinateSystem!.horizontalCRS!.projection !== undefined);
    assert.isTrue(iModel2.geographicCoordinateSystem!.horizontalCRS!.projection!.equals(gcs.horizontalCRS!.projection!));
    assert.isTrue(iModel2.geographicCoordinateSystem!.horizontalCRS!.id !== undefined);
    assert.isTrue(iModel2.geographicCoordinateSystem!.horizontalCRS!.id === gcs.horizontalCRS!.id!);
    assert.isTrue(iModel2.geographicCoordinateSystem!.horizontalCRS!.extent !== undefined);
    assert.isTrue(iModel2.geographicCoordinateSystem!.horizontalCRS!.extent!.equals(gcs.horizontalCRS!.extent!));

    // The following were not in initial definition but were completed after storage.
    assert.isTrue(iModel2.geographicCoordinateSystem!.horizontalCRS!.datum !== undefined);
    assert.isTrue(iModel2.geographicCoordinateSystem!.horizontalCRS!.datum!.additionalTransformPaths !== undefined);
    assert.isTrue(iModel2.geographicCoordinateSystem!.horizontalCRS!.datum!.additionalTransformPaths!.length >= 0);

    // When a gcs is present then the ECEF is automatically defined.
    assert.isTrue(iModel2.ecefLocation !== undefined);

    iModel2.close();
  });

  describe("async coordinate conversions", () => {
    it("should output same number of points as input", async () => {
      const iModelCoords: Point3d[] = [];
      const geoCoords: Point3d[] = [];
      for (let numPts = 0; numPts < 3; numPts++) {
        const geoResponse = await mirukuruReadonly.getGeoCoordinatesFromIModelCoordinates({ target: "WGS84", iModelCoords });
        expect(geoResponse.geoCoords.length).to.equal(numPts);

        const iModelResponse = await mirukuruReadonly.getIModelCoordinatesFromGeoCoordinates({ source: "WGS84", geoCoords });
        expect(iModelResponse.iModelCoords.length).to.equal(numPts);

        iModelCoords.push(new Point3d());
        geoCoords.push(new Point3d());
      }
    });

    it("should always have fromCache = 0", async () => {
      const iModelCoords: Point3d[] = [];
      const geoCoords: Point3d[] = [];
      for (let numPts = 0; numPts < 3; numPts++) {
        const geoResponse = await mirukuruReadonly.getGeoCoordinatesFromIModelCoordinates({ target: "WGS84", iModelCoords });
        expect(geoResponse.fromCache).to.equal(0);

        const iModelResponse = await mirukuruReadonly.getIModelCoordinatesFromGeoCoordinates({ source: "WGS84", geoCoords });
        expect(iModelResponse.iModelCoords.length).to.equal(numPts);
        expect(iModelResponse.fromCache).to.equal(0);

        iModelCoords.push(new Point3d());
        geoCoords.push(new Point3d());
      }
    });

    if (!ProcessDetector.isIOSAppBackend) {
      it("should be able to reproject with iModel coordinates to or from any other GeographicCRS", async () => {
        const convertTest = async (fileName: string, fileGCS: GeographicCRSProps, datum: string | GeographicCRSProps, inputCoord: XYZProps, outputCoord: PointWithStatus) => {

          const args = {
            rootSubject: { name: "TestSubject", description: "test project" },
            client: "ABC Engineering",
            globalOrigin: { x: 0.0, y: 0.0 },
            projectExtents: { low: { x: -300, y: -300, z: -20 }, high: { x: 500, y: 500, z: 400 } },
            guid: Guid.createValue(),
          };

          let datumOrGCS: string;
          if (typeof datum === "object")
            datumOrGCS = JSON.stringify(datum);
          else
            datumOrGCS = datum;

          const testFile = IModelTestUtils.prepareOutputFile("IModel", fileName);
          const iModel = SnapshotDb.createEmpty(testFile, args);

          withEditTxn(iModel, (txn) => {
            iModel.setGeographicCoordinateSystem(fileGCS);
            txn.updateIModelProps();
          });

          const testPoint1: XYZProps[] = [];
          testPoint1.push(inputCoord);
          const requestProps1: GeoCoordinatesRequestProps = { target: datumOrGCS, iModelCoords: testPoint1 };
          const response1 = await iModel.getGeoCoordinatesFromIModelCoordinates(requestProps1);

          expect(response1.geoCoords[0].s === outputCoord.s).to.be.true;

          // If success or warning we compare result
          if (outputCoord.s === GeoCoordStatus.Success || outputCoord.s === GeoCoordStatus.OutOfUsefulRange) {

            const expectedPt1 = Point3d.fromJSON(outputCoord.p);
            const outPt1 = Point3d.fromJSON(response1.geoCoords[0].p);

            expect(Geometry.isSamePoint3dXY(expectedPt1, outPt1, 0.001)).to.be.true;
            expect(Math.abs(expectedPt1.z - outPt1.z) < 0.0001).to.be.true;

            // No point testing reversal when Out of useful range since reversibility is doubtful
            if (outputCoord.s !== GeoCoordStatus.OutOfUsefulRange) {
              const testPoint2: XYZProps[] = [];
              testPoint2.push(outputCoord.p);
              const requestProps2: IModelCoordinatesRequestProps = { source: datumOrGCS, geoCoords: testPoint2 };
              const response2 = await iModel.getIModelCoordinatesFromGeoCoordinates(requestProps2);

              const expectedPt2 = Point3d.fromJSON(inputCoord);
              const outPt2 = Point3d.fromJSON(response2.iModelCoords[0].p);

              expect(expectedPt2.distanceXY(outPt2) < 0.001).to.be.true;
              expect(Math.abs(expectedPt2.z - outPt2.z) < 0.001).to.be.true;
            }
          }

          iModel.close();
        };

        const EWRGCS: GeographicCRSProps = {
          horizontalCRS: {
            id: "EPSG:27700",
            description: "OSGB 1936 / British National Grid",
            source: "EPSG V6 [Large and medium scale topographic mapping and engin]",
            datumId: "EPSG:6277",
            datum: {
              id: "EPSG:6277",
              description: "OSGB36 - Use OSGB-7P-2. Consider OSGB/OSTN15 instead",
              deprecated: true,
              source: "EPSG V6.12 operation EPSG:1314 [EPSG]",
              ellipsoidId: "EPSG:7001",
              ellipsoid: {
                equatorialRadius: 6377563.396,
                polarRadius: 6356256.909237,
                id: "EPSG:7001",
                description: "Airy 1830",
                source: "EPSG, Version 6 [EPSG]",
              },
              transforms: [
                {
                  method: "PositionalVector",
                  sourceEllipsoid: {
                    equatorialRadius: 6377563.396,
                    polarRadius: 6356256.909237,
                    id: "EPSG:7001",
                  },
                  targetEllipsoid: {
                    equatorialRadius: 6378137,
                    polarRadius: 6356752.3142,
                    id: "WGS84",
                  },
                  positionalVector: {
                    delta: {
                      x: 446.448,
                      y: -125.157,
                      z: 542.06,
                    },
                    rotation: {
                      x: 0.15,
                      y: 0.247,
                      z: 0.842,
                    },
                    scalePPM: -20.489,
                  },
                }],
            },
            unit: "Meter",
            projection: {
              method: "TransverseMercator",
              falseEasting: 400000,
              falseNorthing: -100000,
              centralMeridian: -2,
              latitudeOfOrigin: 49,
              scaleFactor: 0.999601272737422,
            },
            extent: {
              southWest: {
                latitude: 49.96,
                longitude: -7.56,
              },
              northEast: {
                latitude: 60.84,
                longitude: 1.78,
              },
            },
          },
          verticalCRS: {
            id: "ELLIPSOID",
          },
          additionalTransform: {
            helmert2DWithZOffset: {
              translationX: 284597.3343,
              translationY: 79859.4651,
              translationZ: 0,
              rotDeg: 0.5263624458992088,
              scale: 0.9996703340508721,
            },
          },
        };

        await convertTest("ExtonCampus1.bim", { horizontalCRS: { id: "EPSG:2272" }, verticalCRS: { id: "NAVD88" } }, "WGS84", { x: 775970.3155166894, y: 83323.24543981979, z: 130.74977547686285 }, { p: { x: -75.68712011112366, y: 40.06524845273591, z: 95.9769083 }, s: GeoCoordStatus.Success });

        await convertTest("UTM83-10-NGVD29-10.bim", { horizontalCRS: { id: "UTM83-10" }, verticalCRS: { id: "NAVD88" } }, { horizontalCRS: { id: "UTM27-10" }, verticalCRS: { id: "NGVD29" } }, { x: 548296.472, y: 4179414.470, z: 0.8457 }, { p: { x: 548392.9689991799, y: 4179217.683834238, z: -0.0006774162750405877 }, s: GeoCoordStatus.Success });

        await convertTest("BritishNatGrid-EllipsoidHelmert1.bim", EWRGCS, "WGS84", { x: 199247.08883859176, y: 150141.68625139236, z: 0.0 }, { p: { x: -0.80184489371471, y: 51.978341907041205, z: 0.0 }, s: GeoCoordStatus.Success });
        await convertTest("BritishNatGrid-Ellipsoid1.bim", { horizontalCRS: { id: "BritishNatGrid" }, verticalCRS: { id: "ELLIPSOID" } }, "", { x: 170370.718, y: 11572.405, z: 0.0 }, { p: { x: -5.2020119082059511, y: 49.959453295440234, z: 0.0 }, s: GeoCoordStatus.Success });
        await convertTest("BritishNatGrid-Ellipsoid2.bim", { horizontalCRS: { id: "BritishNatGrid" }, verticalCRS: { id: "ELLIPSOID" } }, "ETRF89", { x: 170370.718, y: 11572.405, z: 0.0 }, { p: { x: -5.2030365061523707, y: 49.960007477936202, z: 0.0 }, s: GeoCoordStatus.Success });
        await convertTest("BritishNatGrid-Ellipsoid3.bim", { horizontalCRS: { id: "BritishNatGrid" }, verticalCRS: { id: "ELLIPSOID" } }, "OSGB", { x: 170370.718, y: 11572.405, z: 0.0 }, { p: { x: -5.2020119082059511, y: 49.959453295440234, z: 0.0 }, s: GeoCoordStatus.Success });
        await convertTest("GermanyDHDN-3-Ellipsoid1.bim", { horizontalCRS: { id: "DHDN/3.GK3d-4/EN" }, verticalCRS: { id: "ELLIPSOID" } }, "", { x: 4360857.005, y: 5606083.067, z: 0.0 }, { p: { x: 10.035413954488630, y: 50.575070810112159, z: 0.0 }, s: GeoCoordStatus.Success });
        await convertTest("GermanyDHDN-3-Ellipsoid2.bim", { horizontalCRS: { id: "DHDN/3.GK3d-4/EN" }, verticalCRS: { id: "ELLIPSOID" } }, "DHDN/3", { x: 4360857.005, y: 5606083.067, z: 0.0 }, { p: { x: 10.035413954488630, y: 50.575070810112159, z: 0.0 }, s: GeoCoordStatus.Success });
        await convertTest("GermanyDHDN-3-Ellipsoid3.bim", { horizontalCRS: { id: "DHDN/3.GK3d-4/EN" }, verticalCRS: { id: "ELLIPSOID" } }, "WGS84", { x: 4360857.005, y: 5606083.067, z: 0.0 }, { p: { x: 10.034215937440818, y: 50.573862480894853, z: 0.0 }, s: GeoCoordStatus.Success });
        await convertTest("UTM83-10-NGVD29-1.bim", { horizontalCRS: { id: "UTM83-10" }, verticalCRS: { id: "NGVD29" } }, "", { x: 632748.112, y: 4263868.307, z: 0.0 }, { p: { x: -121.47738265889652, y: 38.513305313793019, z: 0.0 }, s: GeoCoordStatus.Success });
        await convertTest("UTM83-10-NGVD29-2.bim", { horizontalCRS: { id: "UTM83-10" }, verticalCRS: { id: "NGVD29" } }, "NAD83", { x: 632748.112, y: 4263868.307, z: 0.0 }, { p: { x: -121.47738265889652, y: 38.513305313793019, z: -30.12668428839329 }, s: GeoCoordStatus.Success });
        await convertTest("UTM83-10-NGVD29-3.bim", { horizontalCRS: { id: "UTM83-10" }, verticalCRS: { id: "NGVD29" } }, "WGS84", { x: 632748.112, y: 4263868.307, z: 0.0 }, { p: { x: -121.47738265889652, y: 38.513305313793019, z: -30.12668428839329 }, s: GeoCoordStatus.Success });
        await convertTest("UTM27-10-Ellipsoid1.bim", { horizontalCRS: { id: "UTM27-10" }, verticalCRS: { id: "ELLIPSOID" } }, "", { x: 623075.328, y: 4265650.532, z: 0.0 }, { p: { x: -121.58798236995744, y: 38.532616292207997, z: 0.0 }, s: GeoCoordStatus.Success });
        await convertTest("UTM27-10-Ellipsoid2.bim", { horizontalCRS: { id: "UTM27-10" }, verticalCRS: { id: "ELLIPSOID" } }, "NAD83", { x: 623075.328, y: 4265650.532, z: 0.0 }, { p: { x: -121.58905088839697, y: 38.532522753851708, z: 0.0 }, s: GeoCoordStatus.Success });

        await convertTest("UTM83-10-NGVD29-4.bim", { horizontalCRS: { id: "UTM83-10" }, verticalCRS: { id: "NGVD29" } }, { horizontalCRS: { id: "LL84" }, verticalCRS: { id: "ELLIPSOID" } }, { x: 632748.112, y: 4263868.307, z: 0.0 }, { p: { x: -121.47738265889652, y: 38.513305313793019, z: -30.12668428839329 }, s: GeoCoordStatus.Success });

        await convertTest("UTM83-10-NGVD29-5.bim", { horizontalCRS: { id: "UTM83-10" }, verticalCRS: { id: "NGVD29" } }, { horizontalCRS: { id: "LL84" }, verticalCRS: { id: "GEOID" } }, { x: 632748.112, y: 4263868.307, z: 0.0 }, { p: { x: -121.47738265889652, y: 38.513305313793019, z: 0.7621583779125531 }, s: GeoCoordStatus.Success });
        await convertTest("UTM83-10-NGVD29-6.bim", { horizontalCRS: { id: "UTM83-10" }, verticalCRS: { id: "NGVD29" } }, { horizontalCRS: { id: "CA83-II" }, verticalCRS: { id: "NAVD88" } }, { x: 569024.940, y: 4386341.752, z: 0.0 }, { p: { x: 1983192.529823256, y: 717304.0311293667, z: 0.745910484422781 }, s: GeoCoordStatus.Success });
        await convertTest("UTM83-10-NGVD29-7.bim", { horizontalCRS: { id: "UTM83-10" }, verticalCRS: { id: "NGVD29" } }, { horizontalCRS: { id: "CA83-II" }, verticalCRS: { id: "GEOID" } }, { x: 569024.940, y: 4386341.752, z: 0.0 }, { p: { x: 1983192.529823256, y: 717304.0311293667, z: 0.745910484422781 }, s: GeoCoordStatus.Success });
        await convertTest("UTM83-10-NGVD29-8.bim", { horizontalCRS: { id: "UTM83-10" }, verticalCRS: { id: "NGVD29" } }, { horizontalCRS: { id: "CA83-II" }, verticalCRS: { id: "NGVD29" } }, { x: 569024.940, y: 4386341.752, z: 0.0 }, { p: { x: 1983192.529823256, y: 717304.0311293667, z: 0.0 }, s: GeoCoordStatus.Success });
        await convertTest("UTM83-10-NGVD29-9.bim", { horizontalCRS: { id: "UTM83-10" }, verticalCRS: { id: "NGVD29" } }, { horizontalCRS: { epsg: 26942 }, verticalCRS: { id: "NAVD88" } }, { x: 569024.940, y: 4386341.752, z: 0.0 }, { p: { x: 1983192.529823256, y: 717304.0311293667, z: 0.745910484422781 }, s: GeoCoordStatus.Success });
        await convertTest("UTM83-10-NGVD29-10.bim", { horizontalCRS: { id: "UTM83-10" }, verticalCRS: { id: "NAVD88" } }, { horizontalCRS: { id: "UTM27-10" }, verticalCRS: { id: "NGVD29" } }, { x: 548296.472, y: 4179414.470, z: 0.8457 }, { p: { x: 548392.9689991799, y: 4179217.683834238, z: -0.0006774162750405877 }, s: GeoCoordStatus.Success });

        await convertTest("BritishNatGrid-Ellipsoid4.bim", { horizontalCRS: { id: "BritishNatGrid" }, verticalCRS: { id: "ELLIPSOID" } }, { horizontalCRS: { id: "HS2_Snake_2015" }, verticalCRS: { id: "GEOID" } }, { x: 473327.251, y: 257049.636, z: 0.0 }, { p: { x: 237732.58101946692, y: 364048.01547843055, z: -47.874172425966336 }, s: GeoCoordStatus.Success });

        await convertTest("BritishNatGrid-Ellipsoid5.bim", { horizontalCRS: { id: "BritishNatGrid" }, verticalCRS: { id: "ELLIPSOID" } },
          {
            horizontalCRS: {
              id: "HS2-MOCK",
              description: "USES CUSTOM DATUM",
              source: "Test",
              deprecated: false,
              datumId: "HS2SD_2015",
              unit: "Meter",
              projection: {
                method: "TransverseMercator",
                centralMeridian: -1.5,
                latitudeOfOrigin: 52.30,
                scaleFactor: 1.0,
                falseEasting: 198873.0046,
                falseNorthing: 375064.3871,
              },
            },
            verticalCRS: {
              id: "GEOID",
            },
          }
          , { x: 473327.251, y: 257049.636, z: 0.0 }, { p: { x: 237732.58101952373, y: 364048.01548327296, z: -47.874172425966336 }, s: GeoCoordStatus.Success });

        await convertTest("BritishNatGrid-Ellipsoid.bim", { horizontalCRS: { id: "BritishNatGrid" }, verticalCRS: { id: "ELLIPSOID" } }, { horizontalCRS: { id: "OSGB-GPS-2015" }, verticalCRS: { id: "GEOID" } }, { x: 473327.251, y: 257049.636, z: 0.0 }, { p: { x: 473325.6830048648, y: 257049.77062273448, z: -47.87643904264457 }, s: GeoCoordStatus.Success });

        await convertTest("UTM83-10-NGVD29-12.bim", { horizontalCRS: { id: "UTM83-10" }, verticalCRS: { id: "NGVD29" } },
          {
            horizontalCRS: {
              id: "California2",
              description: "USES CUSTOM DATUM",
              source: "Test",
              deprecated: false,
              datumId: "NAD83",
              unit: "Meter",
              projection: {
                method: "LambertConformalConicTwoParallels",
                longitudeOfOrigin: -122,
                latitudeOfOrigin: 37.66666666667,
                standardParallel1: 39.833333333333336,
                standardParallel2: 38.333333333333336,
                falseEasting: 2000000.0,
                falseNorthing: 500000.0,
              },
              extent: {
                southWest: {
                  latitude: 35,
                  longitude: -125,
                },
                northEast: {
                  latitude: 39.1,
                  longitude: -120.45,
                },
              },
            },
            verticalCRS: {
              id: "GEOID",
            },
          }, { x: 569024.940, y: 4386341.752, z: 0.0 }, { p: { x: 1983192.529823256, y: 717304.0311293667, z: 0.745910484422781 }, s: GeoCoordStatus.Success });

        // Do some test that return errors
        // First test uses one GCS in Eastern USA and the other in UK. This will produce a hard domain error
        await convertTest("Error1.bim", { horizontalCRS: { id: "UTM84-17N" }, verticalCRS: { id: "ELLIPSOID" } }, { horizontalCRS: { id: "OSGB-GPS-2015" }, verticalCRS: { id: "GEOID" } }, { x: 1473327.251, y: 1257049.636, z: 0.0 }, { p: { x: 473325.6830048648, y: 257049.77062273448, z: -47.87643904264457 }, s: GeoCoordStatus.OutOfMathematicalDomain });

        // This test performs conversion in a region outside normal use of GCS but still mathematically valid (soft domain error)
        await convertTest("Error2.bim", { horizontalCRS: { id: "DanishS34-S99" }, verticalCRS: { id: "ELLIPSOID" } }, "", { x: -6618.5925260757449, y: 36058.097489683532, z: 0.0 }, { p: { x: 13.53250346041385, y: 54.71216475341563, z: 0.0 }, s: GeoCoordStatus.OutOfUsefulRange });
        // -6618.5925260757449, 36058.097489683532
        // { x: -221748.034, y: -10012.784, z: 0.0 } { p: { x: 10.36481105, y: 54.38462506, z: 0.0 }
        // This test makes use of a GCS using a grid file that does not even exist and will return a datum conversion error.
        const userGCSWithinexistentGridFile: GeographicCRSProps = {
          horizontalCRS: {
            id: "User1",
            datumId: "UserDatum1",
            datum: {
              id: "UserDatum1",
              ellipsoidId: "CLRK66",
              transforms: [
                {
                  method: "GridFiles",
                  sourceEllipsoid: {
                    id: "CLRK66",
                    equatorialRadius: 6378160.0,
                    polarRadius: 6356774.719195306,
                  },
                  targetEllipsoid: {
                    id: "WGS84",
                    equatorialRadius: 6378160.0,
                    polarRadius: 6356774.719195306,
                  },
                  gridFile: {
                    files: [
                      { fileName: "./user/inexistent.gdc", format: "NTv2", direction: "Direct" },
                    ],
                  },
                },
              ],
            },
            unit: "Meter",
            projection: {
              method: "TransverseMercator",
              centralMeridian: -115,
              latitudeOfOrigin: 0,
              scaleFactor: 0.9992,
              falseEasting: 1.0,
              falseNorthing: 2.0,
            },
            extent: {
              southWest: { latitude: 48, longitude: -120.5 },
              northEast: { latitude: 84, longitude: -109.5 },
            },
          }, verticalCRS: { id: "ELLIPSOID" },
        };

        await convertTest("Error3.bim", userGCSWithinexistentGridFile, "WGS84", { x: 1473327.251, y: 1257049.636, z: 0.0 }, { p: { x: 473325.6830048648, y: 257049.77062273448, z: -47.87643904264457 }, s: GeoCoordStatus.NoDatumConverter });

        // The model GCS is not valid
        await convertTest("Error4.bim", { horizontalCRS: { id: "badfood" }, verticalCRS: { id: "ELLIPSOID" } }, { horizontalCRS: { id: "OSGB-GPS-2015" }, verticalCRS: { id: "GEOID" } }, { x: 1473327.251, y: 1257049.636, z: 0.0 }, { p: { x: 473325.6830048648, y: 257049.77062273448, z: -47.87643904264457 }, s: GeoCoordStatus.NoGCSDefined });

        // The given GCS is not valid
        await convertTest("Error5.bim", { horizontalCRS: { id: "UTM84-17N" }, verticalCRS: { id: "ELLIPSOID" } }, { horizontalCRS: { id: "badfood" }, verticalCRS: { id: "GEOID" } }, { x: 1473327.251, y: 1257049.636, z: 0.0 }, { p: { x: 473325.6830048648, y: 257049.77062273448, z: -47.87643904264457 }, s: GeoCoordStatus.NoGCSDefined });

      });
    }
  });

  it("should be able to create a snapshot IModel and set geolocation by ECEF", async () => {
    const args = {
      rootSubject: { name: "TestSubject", description: "test iTwin" },
      client: "ABC Engineering",
      globalOrigin: { x: 10, y: 10 },
      projectExtents: { low: { x: -300, y: -300, z: -20 }, high: { x: 500, y: 500, z: 400 } },
      guid: Guid.createValue(),
    };

    const ecef = new EcefLocation({
      origin: [42, 21, 0],
      orientation: { yaw: 1, pitch: 1, roll: -1 },
    });

    const testFile = IModelTestUtils.prepareOutputFile("IModel", "TestSnapshot3.bim");
    const iModel = SnapshotDb.createEmpty(testFile, args);

    assert.isTrue(iModel.ecefLocation === undefined);

    iModel.ecefLocation = ecef;

    withEditTxn(iModel, (txn) => {
      txn.updateIModelProps();
    });
    iModel.close();

    const iModel2 = SnapshotDb.openFile(testFile);

    assert.isTrue(iModel2.ecefLocation !== undefined);
    assert.isTrue(iModel2.ecefLocation!.isAlmostEqual(ecef));

    iModel2.close();
  });

  it("should be able to create a snapshot IModel and set geolocation by ECEF with 0,0,0 rotation", async () => {
    const args = {
      rootSubject: { name: "TestSubject", description: "test iTwin" },
      client: "ABC Engineering",
      globalOrigin: { x: 10, y: 10 },
      projectExtents: { low: { x: -300, y: -300, z: -20 }, high: { x: 500, y: 500, z: 400 } },
      guid: Guid.createValue(),
    };

    const ecef = new EcefLocation({
      origin: [42, 21, 0],
      orientation: { yaw: 0, pitch: 0, roll: 0 },
    });

    const testFile = IModelTestUtils.prepareOutputFile("IModel", "TestSnapshot3_000.bim");
    const iModel = SnapshotDb.createEmpty(testFile, args);

    assert.isTrue(iModel.ecefLocation === undefined);

    iModel.ecefLocation = ecef;

    withEditTxn(iModel, (txn) => {
      txn.updateIModelProps();
    });
    iModel.close();

    const iModel2 = SnapshotDb.openFile(testFile);

    assert.isTrue(iModel2.ecefLocation !== undefined);
    assert.isTrue(iModel2.ecefLocation!.isAlmostEqual(ecef));

    iModel2.close();
  });

  it("presence of a GCS imposes the ecef value", async () => {
    const args = {
      rootSubject: { name: "TestSubject", description: "test iTwin" },
      client: "ABC Engineering",
      globalOrigin: { x: 10, y: 10 },
      projectExtents: { low: { x: -300, y: -300, z: -20 }, high: { x: 500, y: 500, z: 400 } },
      guid: Guid.createValue(),
    };

    const gcs = new GeographicCRS({
      horizontalCRS: {
        id: "10TM115-27",
        description: "",
        source: "Mentor Software Client",
        deprecated: false,
        datumId: "NAD27",
        unit: "Meter",
        projection: {
          method: "TransverseMercator",
          centralMeridian: -115,
          latitudeOfOrigin: 0,
          scaleFactor: 0.9992,
          falseEasting: 0.0,
          falseNorthing: 0.0,
        },
        extent: {
          southWest: { latitude: 48, longitude: -120.5 },
          northEast: { latitude: 84, longitude: -109.5 },
        },
      },
      verticalCRS: { id: "GEOID" },
      additionalTransform: {
        helmert2DWithZOffset: {
          translationX: 10.0,
          translationY: 15.0,
          translationZ: 0.02,
          rotDeg: 1.2,
          scale: 1.0001,
        },
      },
    });

    const ecef = new EcefLocation({
      origin: [42, 21, 0],
      orientation: { yaw: 1, pitch: 1, roll: -1 },
    });

    const testFile = IModelTestUtils.prepareOutputFile("IModel", "TestSnapshot4.bim");

    const iModel = SnapshotDb.createEmpty(testFile, args);

    iModel.ecefLocation = ecef;

    withEditTxn(iModel, (txn) => {
      txn.updateIModelProps();
    });
    iModel.close();

    const iModel2 = SnapshotDb.openForApplyChangesets(testFile);

    assert.isTrue(iModel2.ecefLocation !== undefined);
    assert.isTrue(iModel2.ecefLocation!.isAlmostEqual(ecef));

    assert.isTrue(iModel2.geographicCoordinateSystem === undefined);

    iModel2.geographicCoordinateSystem = gcs;

    withEditTxn(iModel2, (txn) => {
      txn.updateIModelProps();
    });
    iModel2.close();

    const iModel3 = SnapshotDb.openFile(testFile);

    assert.isTrue(iModel3.geographicCoordinateSystem !== undefined);

    // When a gcs is present then ecef value is imposed by the gcs disregarding previous value.
    assert.isTrue(iModel3.ecefLocation !== undefined);
    assert.isFalse(iModel3.ecefLocation!.isAlmostEqual(ecef));

    iModel3.close();
  });
});
