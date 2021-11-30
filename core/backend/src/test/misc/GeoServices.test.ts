/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import {
  GeographicCRSInterpretRequestProps, GeographicCRSProps,
} from "@itwin/core-common";
import { IModelHost } from "../../IModelHost";
import { Geometry } from "@itwin/core-geometry";

// spell-checker: disable

describe("GeoServices", () => {

  it("should be able to interpret to completion an incomplete GeographicCRS", async () => {

    const completionTest = async (incompleteGCS: GeographicCRSProps, completeCRS: GeographicCRSProps) => {

      const requestProps: GeographicCRSInterpretRequestProps = { format: "JSON", geographicCRSDef: JSON.stringify(incompleteGCS) };
      const response = IModelHost.platform.GeoServices.getGeographicCRSInterpretation(requestProps);

      assert.isTrue(response.status === 0);

      assert.isTrue(response.geographicCRS !== undefined);
      if (response.geographicCRS !== undefined) {
        assert.isTrue(response.geographicCRS.horizontalCRS !== undefined && completeCRS.horizontalCRS !== undefined);
        assert.isTrue(response.geographicCRS.horizontalCRS!.id === completeCRS.horizontalCRS!.id);
        assert.isTrue(response.geographicCRS.horizontalCRS!.projection !== undefined && completeCRS.horizontalCRS!.projection !== undefined);
        assert.isTrue(response.geographicCRS.horizontalCRS!.projection!.method === completeCRS.horizontalCRS!.projection!.method);
        if (completeCRS.horizontalCRS!.projection!.falseEasting !== undefined) {
          assert.isTrue(response.geographicCRS.horizontalCRS!.projection!.falseEasting !== undefined);
          assert.isTrue(Math.abs(response.geographicCRS.horizontalCRS!.projection!.falseEasting! - completeCRS.horizontalCRS!.projection!.falseEasting) < Geometry.smallMetricDistance);
        }
        if (completeCRS.horizontalCRS!.projection!.falseNorthing !== undefined) {
          assert.isTrue(response.geographicCRS.horizontalCRS!.projection!.falseNorthing !== undefined);
          assert.isTrue(Math.abs(response.geographicCRS.horizontalCRS!.projection!.falseNorthing! - completeCRS.horizontalCRS!.projection!.falseNorthing) < Geometry.smallMetricDistance);
        }

        assert.isTrue(response.geographicCRS.horizontalCRS!.datum !== undefined && completeCRS.horizontalCRS!.datum !== undefined);
        assert.isTrue(response.geographicCRS.horizontalCRS!.datum!.id === completeCRS.horizontalCRS!.datum!.id);

        assert.isTrue(response.geographicCRS.horizontalCRS!.datum!.ellipsoid !== undefined && completeCRS.horizontalCRS!.datum!.ellipsoid !== undefined);
        assert.isTrue(response.geographicCRS.horizontalCRS!.datum!.ellipsoid!.id === completeCRS.horizontalCRS!.datum!.ellipsoid!.id);

        if (response.geographicCRS.additionalTransform !== undefined) {
          assert.isTrue(completeCRS.additionalTransform !== undefined);
          assert.isTrue(response.geographicCRS.additionalTransform.helmert2DWithZOffset !== undefined);
          assert.isTrue(completeCRS.additionalTransform!.helmert2DWithZOffset !== undefined);

          assert.isTrue(Math.abs(response.geographicCRS.additionalTransform.helmert2DWithZOffset!.rotDeg - completeCRS.additionalTransform!.helmert2DWithZOffset!.rotDeg) < Geometry.smallAngleDegrees);
          assert.isTrue(Math.abs(response.geographicCRS.additionalTransform.helmert2DWithZOffset!.translationX - completeCRS.additionalTransform!.helmert2DWithZOffset!.translationX) < Geometry.smallMetricDistance);
          assert.isTrue(Math.abs(response.geographicCRS.additionalTransform.helmert2DWithZOffset!.translationY - completeCRS.additionalTransform!.helmert2DWithZOffset!.translationY) < Geometry.smallMetricDistance);
          assert.isTrue(Math.abs(response.geographicCRS.additionalTransform.helmert2DWithZOffset!.translationZ - completeCRS.additionalTransform!.helmert2DWithZOffset!.translationZ) < Geometry.smallMetricDistance);
          assert.isTrue(Math.abs(response.geographicCRS.additionalTransform.helmert2DWithZOffset!.scale - completeCRS.additionalTransform!.helmert2DWithZOffset!.scale) < Geometry.smallFraction);
        }

        assert.isTrue(response.geographicCRS.verticalCRS !== undefined && completeCRS.verticalCRS !== undefined);
        assert.isTrue(response.geographicCRS.verticalCRS!.id === completeCRS.verticalCRS!.id);
      }
    };

    const britishNationalGridOld: GeographicCRSProps =
    {
      horizontalCRS: {
        datum: {
          deprecated: true,
          description: "OSGB36 - Use OSGB-7P-2. Consider OSGB/OSTN15 instead",
          ellipsoid: {
            description: "Airy 1830",
            equatorialRadius: 6377563.396,
            id: "EPSG:7001",
            polarRadius: 6356256.909237,
            source: "EPSG, Version 6 [EPSG]"},
          ellipsoidId: "EPSG:7001",
          id: "EPSG:6277",
          source: "EPSG V6.12 operation EPSG:1314 [EPSG]",
          transforms: [
            {
              method: "PositionalVector",
              positionalVector: {
                delta: {
                  x: 446.448,
                  y: -125.157,
                  z: 542.06},
                rotation: {
                  x: 0.15,
                  y: 0.247,
                  z: 0.842},
                scalePPM: -20.489},
              sourceEllipsoid: {
                equatorialRadius: 6377563.396,
                id: "EPSG:7001",
                polarRadius: 6356256.909237},
              targetEllipsoid: {
                equatorialRadius: 6378137,
                id: "WGS84",
                polarRadius: 6356752.3142}}]},
        datumId: "EPSG:6277",
        deprecated: true,
        description: "Use other variant - OSGB British National Grid",
        extent: {
          northEast: {
            latitude: 60.84,
            longitude: 1.78},
          southWest: {
            latitude: 49.96,
            longitude: -7.56}},
        id: "EPSG:27700",
        projection: {
          centralMeridian: -2,
          falseEasting: 400000,
          falseNorthing: -100000,
          latitudeOfOrigin: 49,
          method: "TransverseMercator",
          scaleFactor: 0.999601272737422},
        source: "EPSG",
        unit: "Meter"},
      verticalCRS: {
        id: "ELLIPSOID"}};

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
            source: "EPSG, Version 6 [EPSG]"},
          transforms: [
            {
              method: "PositionalVector",
              sourceEllipsoid: {
                equatorialRadius: 6377563.396,
                polarRadius: 6356256.909237,
                id: "EPSG:7001"},
              targetEllipsoid: {
                equatorialRadius: 6378137,
                polarRadius: 6356752.3142,
                id: "WGS84"},
              positionalVector: {
                delta: {
                  x: 446.448,
                  y: -125.157,
                  z: 542.06},
                rotation: {
                  x: 0.15,
                  y: 0.247,
                  z: 0.842},
                scalePPM: -20.489}}]},
        unit: "Meter",
        projection: {
          method: "TransverseMercator",
          falseEasting: 400000,
          falseNorthing: -100000,
          centralMeridian: -2,
          latitudeOfOrigin: 49,
          scaleFactor: 0.999601272737422},
        extent: {
          southWest: {
            latitude: 49.96,
            longitude: -7.56},
          northEast: {
            latitude: 60.84,
            longitude: 1.78}}},
      verticalCRS: {
        id: "ELLIPSOID"},
      additionalTransform: {
        helmert2DWithZOffset: {
          translationX: 284597.3343,
          translationY: 79859.4651,
          translationZ: 0,
          rotDeg: 0.5263624458992088,
          scale: 0.9996703340508721}}};

    const UTM27Z10: GeographicCRSProps = {
      horizontalCRS: {
        datum: {
          description: "North American Datum of 1927 (US48, AK, HI, and Canada)",
          ellipsoid: {
            description: "Clarke 1866, Benoit Ratio",
            epsg: 7008,
            equatorialRadius: 6378206.4,
            id: "CLRK66",
            polarRadius: 6356583.8,
            source: "US Defense Mapping Agency, TR-8350.2-B, December 1987"},
          ellipsoidId: "CLRK66",
          epsg: 6267,
          id: "NAD27",
          source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
          transforms: [
            {
              gridFile: {
                files: [
                  {
                    direction: "Direct",
                    fileName: "./Usa/Nadcon/conus.l?s",
                    format: "NADCON"},
                  {
                    direction: "Direct",
                    fileName: "./Usa/Nadcon/alaska.l?s",
                    format: "NADCON"},
                  {
                    direction: "Direct",
                    fileName: "./Usa/Nadcon/prvi.l?s",
                    format: "NADCON"},
                  {
                    direction: "Direct",
                    fileName: "./Usa/Nadcon/hawaii.l?s",
                    format: "NADCON"},
                  {
                    direction: "Direct",
                    fileName: "./Usa/Nadcon/stgeorge.l?s",
                    format: "NADCON"},
                  {
                    direction: "Direct",
                    fileName: "./Usa/Nadcon/stlrnc.l?s",
                    format: "NADCON"},
                  {
                    direction: "Direct",
                    fileName: "./Usa/Nadcon/stpaul.l?s",
                    format: "NADCON"}]},
              method: "GridFiles",
              sourceEllipsoid: {
                equatorialRadius: 6378206.4,
                id: "CLRK66",
                polarRadius: 6356583.8},
              targetEllipsoid: {
                equatorialRadius: 6378137,
                id: "GRS1980",
                polarRadius: 6356752.314140348}}]},
        datumId: "NAD27",
        description: "UTM with NAD27 datum, Zone 10, Meter; Central Meridian 123d W",
        epsg: 26710,
        extent: {
          northEast: {
            latitude: 84,
            longitude: -119.5},
          southWest: {
            latitude: -1,
            longitude: -126.5}},
        id: "UTM27-10",
        projection: {
          hemisphere: "North",
          method: "UniversalTransverseMercator",
          zoneNumber: 10},
        source: "Snyder, J.P, 1987, Map Projections - A Working Manual",
        unit: "Meter"},
      verticalCRS: {
        id: "NGVD29"}};

    const UTM27Z10B: GeographicCRSProps =
        {
          horizontalCRS: {
            datum: {
              description: "North American Datum of 1927 (US48, AK, HI, and Canada)",
              ellipsoid: {
                description: "Clarke 1866, Benoit Ratio",
                epsg: 7008,
                equatorialRadius: 6378206.4,
                id: "CLRK66",
                polarRadius: 6356583.8,
                source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
              },
              ellipsoidId: "CLRK66",
              epsg: 6267,
              id: "NAD27",
              source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
              transforms: [
                {
                  gridFile: {
                    files: [
                      {
                        direction: "Direct",
                        fileName: "./Usa/Nadcon/conus.l?s",
                        format: "NADCON",
                      },
                      {
                        direction: "Direct",
                        fileName: "./Usa/Nadcon/alaska.l?s",
                        format: "NADCON",
                      },
                      {
                        direction: "Direct",
                        fileName: "./Usa/Nadcon/prvi.l?s",
                        format: "NADCON",
                      },
                      {
                        direction: "Direct",
                        fileName: "./Usa/Nadcon/hawaii.l?s",
                        format: "NADCON",
                      },
                      {
                        direction: "Direct",
                        fileName: "./Usa/Nadcon/stgeorge.l?s",
                        format: "NADCON",
                      },
                      {
                        direction: "Direct",
                        fileName: "./Usa/Nadcon/stlrnc.l?s",
                        format: "NADCON",
                      },
                      {
                        direction: "Direct",
                        fileName: "./Usa/Nadcon/stpaul.l?s",
                        format: "NADCON",
                      },
                    ],
                  },
                  method: "GridFiles",
                  sourceEllipsoid: {
                    equatorialRadius: 6378206.4,
                    id: "CLRK66",
                    polarRadius: 6356583.8,
                  },
                  targetEllipsoid: {
                    equatorialRadius: 6378137,
                    id: "GRS1980",
                    polarRadius: 6356752.314140348,
                  },
                },
              ],
            },
            datumId: "NAD27",
            description: "NAD27 / UTM zone 10N",
            epsg: 26710,
            extent: {
              northEast: {
                latitude: 77,
                longitude: -120,
              },
              southWest: {
                latitude: 34.4,
                longitude: -126,
              },
            },
            id: "EPSG:26710",
            projection: {
              centralMeridian: -123,
              falseEasting: 500000,
              falseNorthing: 0,
              latitudeOfOrigin: 0,
              method: "TransverseMercator",
              scaleFactor: 0.9996,
            },
            source: "EPSG V6 [Large and medium scale topographic mapping and engin]",
            unit: "Meter",
          },
          verticalCRS: {
            id: "NGVD29",
          },
        };

    await completionTest({ horizontalCRS: { id: "EPSG:27700" }, verticalCRS: { id: "ELLIPSOID" } }, britishNationalGridOld);
    await completionTest({ horizontalCRS: { id: "EPSG:27700" }, verticalCRS: { id: "ELLIPSOID" }, additionalTransform: { helmert2DWithZOffset: { translationX: 284597.3343, translationY: 79859.4651, translationZ: 0, rotDeg: 0.5263624458992088, scale: 0.9996703340508721}} }, EWRGCS);
    await completionTest({ horizontalCRS: { id: "UTM27-10" }, verticalCRS: { id: "NGVD29" } }, UTM27Z10);
    await completionTest({ horizontalCRS: { epsg: 26710 }, verticalCRS: { id: "NGVD29" } }, UTM27Z10B);
  });

  it("should be able to interpret a WKT GeographicCRS", async () => {

    const interpretWKTTest = async (testWKT: string, completeCRS: GeographicCRSProps) => {

      const requestProps: GeographicCRSInterpretRequestProps = { format: "WKT", geographicCRSDef: testWKT };
      const response = IModelHost.platform.GeoServices.getGeographicCRSInterpretation(requestProps);

      assert.isTrue(response.status === 0);

      assert.isTrue(response.geographicCRS !== undefined);
      if (response.geographicCRS !== undefined) {
        assert.isTrue(response.geographicCRS.horizontalCRS !== undefined && completeCRS.horizontalCRS !== undefined);
        assert.isTrue(response.geographicCRS.horizontalCRS!.id === completeCRS.horizontalCRS!.id);
        assert.isTrue(response.geographicCRS.horizontalCRS!.projection !== undefined && completeCRS.horizontalCRS!.projection !== undefined);
        assert.isTrue(response.geographicCRS.horizontalCRS!.projection!.method === completeCRS.horizontalCRS!.projection!.method);
        if (completeCRS.horizontalCRS!.projection!.falseEasting !== undefined) {
          assert.isTrue(response.geographicCRS.horizontalCRS!.projection!.falseEasting !== undefined);
          assert.isTrue(Math.abs(response.geographicCRS.horizontalCRS!.projection!.falseEasting! - completeCRS.horizontalCRS!.projection!.falseEasting) < Geometry.smallMetricDistance);
        }
        if (completeCRS.horizontalCRS!.projection!.falseNorthing !== undefined) {
          assert.isTrue(response.geographicCRS.horizontalCRS!.projection!.falseNorthing !== undefined);
          assert.isTrue(Math.abs(response.geographicCRS.horizontalCRS!.projection!.falseNorthing! - completeCRS.horizontalCRS!.projection!.falseNorthing) < Geometry.smallMetricDistance);
        }

        assert.isTrue(response.geographicCRS.horizontalCRS!.datum !== undefined && completeCRS.horizontalCRS!.datum !== undefined);
        assert.isTrue(response.geographicCRS.horizontalCRS!.datum!.id === completeCRS.horizontalCRS!.datum!.id);

        assert.isTrue(response.geographicCRS.horizontalCRS!.datum!.ellipsoid !== undefined && completeCRS.horizontalCRS!.datum!.ellipsoid !== undefined);
        assert.isTrue(response.geographicCRS.horizontalCRS!.datum!.ellipsoid!.id === completeCRS.horizontalCRS!.datum!.ellipsoid!.id);

        assert.isTrue(response.geographicCRS.verticalCRS !== undefined && completeCRS.verticalCRS !== undefined);
        assert.isTrue(response.geographicCRS.verticalCRS!.id === completeCRS.verticalCRS!.id);

        // WKTs cannot define an additional transform
        assert.isTrue(response.geographicCRS.additionalTransform === undefined);
      }
    };

    const airportGrid2007: GeographicCRSProps =
    {
      horizontalCRS: {
        datum: {
          description: "Heathrow T5 Datum",
          ellipsoid: {
            description: "Airy, 1830",
            epsg: 7001,
            equatorialRadius: 6377563.396,
            id: "AIRY30",
            polarRadius: 6356256.909,
            source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
          },
          ellipsoidId: "AIRY30",
          id: "HeathrowT5",
          source: "Bentley Client",
          transforms: [
            {
              method: "PositionalVector",
              positionalVector: {
                delta: {
                  x: 358.398212181898,
                  y: -213.702844870731,
                  z: 495.318319769716,
                },
                rotation: {
                  x: 668.806139320047,
                  y: -4.72664217602752,
                  z: 719.671097181396,
                },
                scalePPM: -6.26386076385543,
              },
              sourceEllipsoid: {
                equatorialRadius: 6377563.396,
                id: "AIRY30",
                polarRadius: 6356256.909,
              },
              targetEllipsoid: {
                equatorialRadius: 6378137,
                id: "WGS84",
                polarRadius: 6356752.3142,
              },
            },
          ],
        },
        datumId: "HeathrowT5",
        description: "AirportGrid2007",
        id: "AirportGrid2007",
        projection: {
          centralMeridian: -0.41832591666666674,
          falseEasting: 7334.81,
          falseNorthing: 5637.423,
          latitudeOfOrigin: 51.47011065555556,
          method: "TransverseMercator",
          scaleFactor: 0.999995,
        },
        source: "WKT",
        unit: "Meter",
      },
      verticalCRS: {
        id: "ELLIPSOID",
      },
    };

    const denmarkED50: GeographicCRSProps =
    {
      horizontalCRS: {
        datum: {
          description: "European 1950, Denmark, for System 34",
          ellipsoid: {
            description: "Hayford, 1924 (aka 1909); same as International 1924",
            epsg: 7022,
            equatorialRadius: 6378388,
            id: "HAYFORD",
            polarRadius: 6356911.9461279465,
            source: "Snyder, J.P., 1987, Map Projections - A Working Manual",
          },
          ellipsoidId: "HAYFORD",
          id: "ED50-DK34",
          source: "KMSTrans, by Kort-og Matrikelstyrelsen (Nov 1999)",
          transforms: [
            {
              method: "PositionalVector",
              positionalVector: {
                delta: {
                  x: -81.0703,
                  y: -89.3603,
                  z: -115.7526,
                },
                rotation: {
                  x: 0.48488,
                  y: 0.02436,
                  z: 0.41321,
                },
                scalePPM: -0.540645,
              },
              sourceEllipsoid: {
                equatorialRadius: 6378388,
                id: "HAYFORD",
                polarRadius: 6356911.9461279465,
              },
              targetEllipsoid: {
                equatorialRadius: 6378137,
                id: "WGS84",
                polarRadius: 6356752.3142,
              },
            },
          ],
        },
        datumId: "ED50-DK34",
        description: "Longitude / Latitude (ED 50 Denmark)",
        extent: {
          northEast: {
            latitude: 90,
            longitude: 180,
          },
          southWest: {
            latitude: -90,
            longitude: -180,
          },
        },
        id: "Longitude.Latitude (ED ",
        projection: {
          method: "None",
        },
        source: "Extracted from WKT string; description field carries WKT name.",
        unit: "Degree",
      },
      verticalCRS: {
        id: "ELLIPSOID",
      },
    };

    const californiaStateZone2: GeographicCRSProps =
    {
      horizontalCRS: {
        datum: {
          description: "North American Datum of 1983",
          ellipsoid: {
            description: "Geodetic Reference System of 1980",
            epsg: 7019,
            equatorialRadius: 6378137,
            id: "GRS1980",
            polarRadius: 6356752.314140348,
            source: "Stem, L.E., Jan 1989, State Plane Coordinate System of 1983",
          },
          ellipsoidId: "GRS1980",
          epsg: 6269,
          id: "NAD83",
          source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
          transforms: [
            {
              method: "None",
            },
          ],
        },
        datumId: "NAD83",
        description: "NAD_1983_StatePlane_California_II_FIPS_0402_Feet",
        id: "NAD_1983_StatePlane_Cal",
        projection: {
          falseEasting: 6561666.666666666,
          falseNorthing: 1640416.666666667,
          latitudeOfOrigin: 37.66666666666666,
          longitudeOfOrigin: -122,
          method: "LambertConformalConicTwoParallels",
          standardParallel1: 38.33333333333334,
          standardParallel2: 39.83333333333334,
        },
        source: "WKT",
        unit: "USSurveyFoot",
      },
      verticalCRS: {
        id: "NAVD88",
      },
    };

    const utm84Zone34S: GeographicCRSProps =
    {
      horizontalCRS: {
        datum: {
          description: "World Geodetic System of 1984",
          ellipsoid: {
            description: "World Geodetic System of 1984, GEM 10C",
            epsg: 7030,
            equatorialRadius: 6378137,
            id: "WGS84",
            polarRadius: 6356752.3142,
            source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
          },
          ellipsoidId: "WGS84",
          epsg: 6326,
          id: "WGS84",
          source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
          transforms: [
            {
              method: "None",
            },
          ],
        },
        datumId: "WGS84",
        description: "WGS 84 / UTM zone 34S",
        id: "WGS 84 / UTM zone 34S",
        projection: {
          centralMeridian: 20.999999999999982,
          falseEasting: 500000,
          falseNorthing: 10000000,
          latitudeOfOrigin: 0,
          method: "TransverseMercator",
          scaleFactor: 0.9996,
        },
        source: "WKT",
        unit: "Meter",
      },
      verticalCRS: {
        id: "ELLIPSOID",
      },
    };

    const utm84Zone32NGeoid: GeographicCRSProps =
    {
      horizontalCRS: {
        datum: {
          description: "World Geodetic System of 1984",
          ellipsoid: {
            description: "World Geodetic System of 1984, GEM 10C",
            epsg: 7030,
            equatorialRadius: 6378137,
            id: "WGS84",
            polarRadius: 6356752.3142,
            source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
          },
          ellipsoidId: "WGS84",
          epsg: 6326,
          id: "WGS84",
          source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
          transforms: [
            {
              method: "None",
            },
          ],
        },
        datumId: "WGS84",
        description: "WGS 84 / UTM zone32N",
        id: "WGS 84 / UTM zone32N",
        projection: {
          centralMeridian: 9,
          falseEasting: 500000,
          falseNorthing: 0,
          latitudeOfOrigin: 0,
          method: "TransverseMercator",
          scaleFactor: 0.9996,
        },
        source: "WKT",
        unit: "Meter",
      },
      verticalCRS: {
        id: "GEOID",
      },
    };

    const utm84Zone18NGeoid: GeographicCRSProps =
    {
      horizontalCRS: {
        datum: {
          description: "World Geodetic System of 1984",
          ellipsoid: {
            description: "World Geodetic System of 1984, GEM 10C",
            epsg: 7030,
            equatorialRadius: 6378137,
            id: "WGS84",
            polarRadius: 6356752.3142,
            source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
          },
          ellipsoidId: "WGS84",
          epsg: 6326,
          id: "WGS84",
          source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
          transforms: [
            {
              method: "None",
            },
          ],
        },
        datumId: "WGS84",
        description: "UTM84-18N",
        id: "UTM84-18N",
        projection: {
          hemisphere: "North",
          method: "UniversalTransverseMercator",
          zoneNumber: 18,
        },
        source: "WKT",
        unit: "Meter",
      },
      verticalCRS: {
        id: "GEOID",
      },
    };

    await interpretWKTTest('PROJCS["AirportGrid2007", GEOGCS["HeathrowT5.LL",DATUM["Heathrow T5", SPHEROID["AIRY30",6377563.396,299.32496127],358.398,-213.7028,495.3183,-668.80613932004700,4.72664217602752,-719.67109718139600,-6.26386076385543],PRIMEM["Greenwich",0],UNIT["Decimal Degree",0.017453292519943295]],PROJECTION["Transverse Mercator"],PARAMETER["latitude_of_origin",51.470110655555558],PARAMETER["central_meridian",-0.41832591666666669],PARAMETER["scale_factor",0.999995],PARAMETER["false_easting",7334.810],PARAMETER["false_northing",5637.423],UNIT["Meter",1.00000000000000]]', airportGrid2007);
    await interpretWKTTest('GEOGCS[ "Longitude / Latitude (ED 50 Denmark)", DATUM ["European 1950 (Denmark)", SPHEROID ["International 1924", 6378388, 297],-81.0703, -89.3603, -115.7526, .48488, .02436, .41321, -.540645], PRIMEM [ "Greenwich", 0.000000 ], UNIT ["Decimal Degree", 0.01745329251994330]]', denmarkED50);
    await interpretWKTTest('PROJCS["NAD_1983_StatePlane_California_II_FIPS_0402_Feet",GEOGCS["GCS_North_American_1983",DATUM["D_North_American_1983",SPHEROID["GRS_1980",6378137,298.257222101]],PRIMEM["Greenwich",0],UNIT["Degree",0.017453292519943295]],PROJECTION["Lambert_Conformal_Conic"],PARAMETER["False_Easting",6561666.666666666],PARAMETER["False_Northing",1640416.666666667],PARAMETER["Central_Meridian",-122],PARAMETER["Standard_Parallel_1",38.33333333333334],PARAMETER["Standard_Parallel_2",39.83333333333334],PARAMETER["Latitude_Of_Origin",37.66666666666666],UNIT["Foot_US",0.30480060960121924]]', californiaStateZone2);
    await interpretWKTTest('PROJCS["WGS 84 / UTM zone 34S", GEOGCS [ "WGS 84", DATUM ["World Geodetic System 1984 (EPSG ID 6326)", SPHEROID ["WGS 84 (EPSG ID 7030)", 6378137, 298.257223563]], PRIMEM [ "Greenwich", 0.000000 ], UNIT ["Decimal Degree", 0.01745329251994328]], PROJECTION ["UTM zone 34S (EPSG OP 16134)"], PARAMETER ["Latitude_Of_Origin", 0], PARAMETER ["Central_Meridian", 21], PARAMETER ["Scale_Factor", .9996], PARAMETER ["False_Easting", 500000], PARAMETER ["False_Northing", 10000000], UNIT ["Meter", 1]]', utm84Zone34S);
    await interpretWKTTest('COMPD_CS["WGS 84 / UTM zone 32N + EGM96 geoid height",PROJCS["WGS 84 / UTM zone32N",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",9],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",0],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AXIS["Easting",EAST],AXIS["Northing",NORTH],AUTHORITY["EPSG","32632"]],VERT_CS["EGM96 geoid height",VERT_DATUM["EGM96 geoid",2005,EXTENSION["PROJ4_GRIDS","egm96_15.gtx"],AUTHORITY["EPSG","5171"]],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AXIS["Up",UP],AUTHORITY["EPSG","5773"]]]', utm84Zone32NGeoid);
    await interpretWKTTest('COMPD_CS["UTM84-18N",PROJCS["UTM84-18N",GEOGCS["LL84",DATUM["WGS84",SPHEROID["WGS84",6378137.000,298.25722293]],PRIMEM["Greenwich",0],UNIT["Degree",0.017453292519943295]],PROJECTION["Universal Transverse Mercator System"],PARAMETER["UTM Zone Number (1 - 60)",18.0],PARAMETER["Hemisphere, North or South",1.0],UNIT["Meter",1.00000000000000]],VERT_CS["Geoid Height",VERT_DATUM["EGM96 geoid",2005],UNIT["METER",1.000000]]]', utm84Zone18NGeoid);
  });

  it("should not be able to interpret an invalid GeographicCRS", async () => {

    const interpretInvalidTest = async (formatCRS: "WKT"| "JSON", testInvalid: string) => {

      const requestProps: GeographicCRSInterpretRequestProps = { format: formatCRS, geographicCRSDef: testInvalid };
      const response = IModelHost.platform.GeoServices.getGeographicCRSInterpretation(requestProps);

      // At the moment return codes are not really error specific (we mostly return 32768) so we do not validate
      // actual error code for now.
      assert.isFalse(response.status === 0);
    };

    // WKT Without datum or projection clause
    await interpretInvalidTest("WKT", 'PROJCS["AirportGrid2007", GEOGCS["HeathrowT5.LL",PRIMEM["Greenwich",0],UNIT["Decimal Degree",0.017453292519943295]],UNIT["Meter",1.00000000000000]]');

    // Plain garbage
    await interpretInvalidTest("WKT", "Some invalid content");

    // Format is JSON but content is WKT
    await interpretInvalidTest("JSON", 'GEOGCS[ "Longitude / Latitude (ED 50 Denmark)", DATUM ["European 1950 (Denmark)", SPHEROID ["International 1924", 6378388, 297],-81.0703, -89.3603, -115.7526, .48488, .02436, .41321, -.540645], PRIMEM [ "Greenwich", 0.000000 ], UNIT ["Decimal Degree", 0.01745329251994330]]');

    // Vertical datum invalid for horizontal definition
    await interpretInvalidTest("JSON", '{ horizontalCRS: { id: "EPSG:27700" }, verticalCRS: { id: "NAVD29" } }');

    // No horizontal CRS
    await interpretInvalidTest("JSON", '{ verticalCRS: { id: "NAVD29" } }');

    // Unknown identifier
    await interpretInvalidTest("JSON", '{ horizontalCRS: { id: "UNKNOWN" }, verticalCRS: { id: "NAVD29" } }');
  });
});
