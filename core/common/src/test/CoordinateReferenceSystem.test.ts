/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cspell:ignore JSONXYZ, ETRF, OSGB, DHDN, CLRK, Benoit, NAVD, NADCON, Xfrm, prvi, stgeorge, stlrnc, stpaul, helmert

import { expect } from "chai";
import { GeographicCRS, GeographicCRSProps, HorizontalCRS, HorizontalCRSProps } from "../geometry/CoordinateReferenceSystem";
import { GeodeticDatum, GeodeticDatumProps, GeodeticTransform, GeodeticTransformProps } from "../geometry/GeodeticDatum";
import { GeodeticEllipsoid, GeodeticEllipsoidProps } from "../geometry/GeodeticEllipsoid";
// import { ProjectionMethod2 } from "../geometry/Projection";

describe("Geodetic Settings", () => {

  /* Geodetic Transform unit tests */
  it("round-trips GeodeticTransform through JSON", () => {
    const roundTrip = (input: GeodeticTransformProps | undefined, expected: GeodeticTransformProps | "input") => {
      if (!input)
        input = { method: "None" };

      if ("input" === expected)
        expected = JSON.parse(JSON.stringify(input)) as GeodeticTransform;

      const geoTransform = GeodeticTransform.fromJSON(input);
      const output = geoTransform.toJSON();
      const outTransform = GeodeticTransform.fromJSON(output);

      expect(output.method === expected.method).to.be.true;
      expect((output.geocentric === undefined) === (expected.geocentric === undefined)).to.be.true;
      if (output.geocentric) {
        expect(output.geocentric.delta.x === expected.geocentric!.delta.x);
      }
      expect((output.gridFile === undefined) === (expected.gridFile === undefined)).to.be.true;
      if (output.gridFile) {
        expect(output.gridFile.files.length === expected.gridFile?.files.length);
        for (let index = 0; index < output.gridFile.files.length; ++index) {
          expect(output.gridFile.files[index].direction === expected.gridFile?.files[index].direction).to.be.true;
          expect(output.gridFile.files[index].format === expected.gridFile?.files[index].format).to.be.true;
          expect(output.gridFile.files[index].fileName === expected.gridFile?.files[index].fileName).to.be.true;
        }
      }
      expect((output.positionalVector === undefined) === (expected.positionalVector === undefined)).to.be.true;
      if (output.positionalVector) {
        expect(output.positionalVector.delta.x === expected.positionalVector!.delta.x).to.be.true;
        expect(output.positionalVector.delta.y === expected.positionalVector!.delta.y).to.be.true;
        expect(output.positionalVector.delta.z === expected.positionalVector!.delta.z).to.be.true;
        expect(output.positionalVector.rotation.x === expected.positionalVector!.rotation.x).to.be.true;
        expect(output.positionalVector.rotation.y === expected.positionalVector!.rotation.y).to.be.true;
        expect(output.positionalVector.rotation.z === expected.positionalVector!.rotation.z).to.be.true;
      }

      const expectedTransform = GeodeticTransform.fromJSON(expected);

      expect(geoTransform.equals(expectedTransform)).to.be.true;
      expect(geoTransform.equals(outTransform)).to.be.true;
    };

    /** For the moment no property is validated so we always use input as compare base */
    roundTrip(undefined, { method: "None" });
    roundTrip({ method: "None" }, "input");

    roundTrip({ method: "Geocentric" }, "input");
    roundTrip({ method: "PositionalVector" }, "input");
    roundTrip({ method: "GridFiles" }, "input");
    roundTrip({ method: "MultipleRegression" }, "input");

    roundTrip({ method: "Geocentric", geocentric: { delta: { x: 12.0, y: 32.3, z: 54.1 } } }, "input");
    roundTrip({
      method: "PositionalVector",
      positionalVector: {
        delta: { x: 12.0, y: 32.3, z: 54.1 },
        rotation: { x: 12.1, y: 21.1, z: 23.4 },
        scalePPM: 0.2221,
      },
    }, "input");

    roundTrip({
      method: "GridFiles",
      gridFile: {
        files: [
          { fileName: "toto.tat", format: "NADCON", direction: "Direct" },
          { fileName: "foo.foo", format: "NTv1", direction: "Inverse" },
        ],
      },
    }, "input");
  });

  /* Geodetic Ellipsoid unit tests */
  it("round-trips GeodeticEllipsoid through JSON", () => {
    const roundTrip = (input: GeodeticEllipsoidProps | undefined, expected: GeodeticEllipsoidProps | "input") => {
      if (!input)
        input = {};

      if ("input" === expected)
        expected = JSON.parse(JSON.stringify(input)) as GeodeticEllipsoid;

      const ellipsoid = GeodeticEllipsoid.fromJSON(input);
      const output = ellipsoid.toJSON();
      const outEllipsoid = GeodeticEllipsoid.fromJSON(output);

      expect(output.id === expected.id).to.be.true;
      expect(output.description === expected.description).to.be.true;
      expect(output.source === expected.source).to.be.true;
      expect(output.epsg === expected.epsg).to.be.true;
      if (output.deprecated !== undefined && expected.deprecated !== undefined)
        expect(output.deprecated === expected.deprecated).to.be.true;
      else if (output.deprecated !== undefined && expected.deprecated === undefined)
        expect(output.deprecated).to.be.false;
      else if (output.deprecated === undefined && expected.deprecated !== undefined)
        expect(expected.deprecated).to.be.false;

      expect(output.equatorialRadius === expected.equatorialRadius).to.be.true;
      expect(output.polarRadius === expected.polarRadius).to.be.true;

      const expectedEllipsoid = GeodeticEllipsoid.fromJSON(expected);

      expect(ellipsoid.equals(expectedEllipsoid)).to.be.true;
      expect(ellipsoid.equals(outEllipsoid)).to.be.true;

    };

    /** For the moment no property is validated so we always use input as compare base */
    roundTrip(undefined, {});
    roundTrip({}, "input");

    roundTrip({ id: "123" }, "input");

    roundTrip({ description: "This is a dummy description" }, "input");
    roundTrip({ deprecated: true }, "input");
    roundTrip({ source: "This is a dummy source" }, "input");
    roundTrip({ epsg: 4326 }, "input");

    roundTrip({ id: "WGS84" }, "input");
    roundTrip({ id: "ETRF89" }, "input");
    roundTrip({ id: "GDA2020" }, "input");

    roundTrip({
      id: "WGS84",
      epsg: 6326,
      description: "Clarke 1866, Benoit Ratio",
      source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
      equatorialRadius: 6378160.0,
      polarRadius: 6356774.719195305951,
    }, "input");

    roundTrip({
      id: "CLRK66",
      epsg: 7008,
      description: "Clarke 1866, Benoit Ratio",
      source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
      equatorialRadius: 6378160.0,
      polarRadius: 6356774.719195305951,
    }, "input");

    roundTrip({
      id: "ANS66",
      description: "Australian National Spheroid of 1966",
      source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
      equatorialRadius: 6378160.0,
      polarRadius: 6356774.719195305951,
    }, "input");
  });

  /* Geodetic Datum unit tests */
  it("round-trips GeodeticDatum through JSON", () => {
    const roundTrip = (input: GeodeticDatumProps | undefined, expected: GeodeticDatumProps | "input") => {
      if (!input)
        input = {};

      if ("input" === expected)
        expected = JSON.parse(JSON.stringify(input)) as GeodeticDatum;

      const datum = GeodeticDatum.fromJSON(input);
      const output = datum.toJSON();
      const outDatum = GeodeticDatum.fromJSON(output);

      expect(output.id === expected.id).to.be.true;
      expect(output.description === expected.description).to.be.true;
      expect(output.source === expected.source).to.be.true;
      expect(output.epsg === expected.epsg).to.be.true;
      if (output.deprecated !== undefined && expected.deprecated !== undefined)
        expect(output.deprecated === expected.deprecated).to.be.true;
      else if (output.deprecated !== undefined && expected.deprecated === undefined)
        expect(output.deprecated).to.be.false;
      else if (output.deprecated === undefined && expected.deprecated !== undefined)
        expect(expected.deprecated).to.be.false;

      expect(output.ellipsoidId === expected.ellipsoidId).to.be.true;

      expect((output.transforms === undefined) === (expected.transforms === undefined)).to.be.true;
      if (output.transforms) {
        expect(output.transforms.length === expected.transforms!.length);
        // No need to check the transform content as they were verified above
      }

      const expectedDatum = GeodeticDatum.fromJSON(expected);
      expect(datum.equals(expectedDatum)).to.be.true;
      expect(datum.equals(outDatum)).to.be.true;
    };

    /** For the moment no property is validated so we always use input as compare base */
    roundTrip(undefined, {});
    roundTrip({}, "input");

    roundTrip({ id: "123" }, "input");

    roundTrip({ description: "This is a dummy description" }, "input");
    roundTrip({ deprecated: true }, "input");
    roundTrip({ source: "This is a dummy source" }, "input");
    roundTrip({ epsg: 4326 }, "input");

    roundTrip({ id: "WGS84" }, "input");
    roundTrip({ id: "ETRF89" }, "input");
    roundTrip({ id: "GDA2020" }, "input");

    roundTrip({
      id: "WGS84",
      epsg: 4326,
      ellipsoidId: "WGS84",
      transforms: [{ method: "None" }],
    }, "input");

    roundTrip({
      id: "AmSamoa62",
      description: "Replaced by Samoa1962 which uses GEOCENTRIC transformation",
      deprecated: true,
      source: "EPSG, V6.3, 6169 [EPSG]",
      epsg: 0,
      ellipsoidId: "CLRK66",
      ellipsoid: {
        id: "CLRK66",
        epsg: 7008,
        description: "Clarke 1866, Benoit Ratio",
        source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
        equatorialRadius: 6378160.0,
        polarRadius: 6356774.719195305951,
      },
      transforms: [
        {
          method: "Geocentric",
          geocentric: {
            delta: { x: -115, y: 118, z: 426 },
          },
        },
      ],
    }, "input");

    roundTrip({
      id: "AGD84-P7",
      description: "Australian Geodetic 1984, uses 7 Parameter Xfrm",
      deprecated: false,
      source: "Geocentric Datum of Australia Technical Manual",
      epsg: 0,
      ellipsoidId: "ANS66",
      ellipsoid: {
        id: "ANS66",
        description: "Australian National Spheroid of 1966",
        source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
        equatorialRadius: 6378160.0,
        polarRadius: 6356774.719195305951,
      },
      transforms: [
        {
          method: "PositionalVector",
          positionalVector: {
            scalePPM: -0.191,
            delta: { x: -117.763, y: -51.51, z: 139.061 },
            rotation: { x: -0.292, y: -0.443, z: -0.277 },
          },
        },
      ],
    }, "input");

    roundTrip({
      id: "NAD27",
      description: "North American Datum of 1927 (US48, AK, HI, and Canada)",
      source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
      epsg: 6267,
      ellipsoidId: "CLRK66",
      ellipsoid: {
        id: "CLRK66",
        description: "Clarke 1866, Benoit Ratio",
        source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
        epsg: 7008,
        equatorialRadius: 6378206.4,
        polarRadius: 6356583.8,
      },
      transforms: [
        {
          method: "GridFiles",
          gridFile: {
            files: [
              { fileName: "./Usa/Nadcon/conus.l?s", format: "NADCON", direction: "Direct" },
              { fileName: "./Usa/Nadcon/alaska.l?s", format: "NADCON", direction: "Direct" },
              { fileName: "./Usa/Nadcon/prvi.l?s", format: "NADCON", direction: "Direct" },
              { fileName: "./Usa/Nadcon/hawaii.l?s", format: "NADCON", direction: "Direct" },
              { fileName: "./Usa/Nadcon/stgeorge.l?s", format: "NADCON", direction: "Direct" },
              { fileName: "./Usa/Nadcon/stlrnc.l?s", format: "NADCON", direction: "Direct" },
              { fileName: "./Usa/Nadcon/stpaul.l?s", format: "NADCON", direction: "Direct" },
            ],
          },
        }],
    }, "input");
  });

  /* Horizontal CRS unit tests */
  it("round-trips HorizontalCRS through JSON", () => {
    const roundTrip = (input: HorizontalCRSProps | undefined, expected: HorizontalCRSProps | "input") => {
      if (!input)
        input = {};

      if ("input" === expected)
        expected = JSON.parse(JSON.stringify(input)) as HorizontalCRS;

      const horizCRS = HorizontalCRS.fromJSON(input);
      const output = horizCRS.toJSON();
      const outHorizCRS = HorizontalCRS.fromJSON(output);

      expect(output.id === expected.id).to.be.true;
      expect(output.description === expected.description).to.be.true;
      expect(output.source === expected.source).to.be.true;
      expect(output.epsg === expected.epsg).to.be.true;
      expect(output.datumId === expected.datumId).to.be.true;
      if (output.deprecated !== undefined && expected.deprecated !== undefined)
        expect(output.deprecated === expected.deprecated).to.be.true;
      else if (output.deprecated !== undefined && expected.deprecated === undefined)
        expect(output.deprecated).to.be.false;
      else if (output.deprecated === undefined && expected.deprecated !== undefined)
        expect(expected.deprecated).to.be.false;

      expect(output.ellipsoidId === expected.ellipsoidId).to.be.true;
      expect(output.name === expected.name).to.be.true;
      expect(output.unit === expected.unit);
      expect((output.datum === undefined) === (expected.datum === undefined)).to.be.true;
      // No need to verify the datum content as they were verified in another test.
      expect((output.ellipsoidId === undefined) === (expected.ellipsoidId === undefined)).to.be.true;
      // No need to verify the ellipsoid content as they were verified in another test.

      const expectedHorizCRS = HorizontalCRS.fromJSON(expected);
      expect(horizCRS.equals(expectedHorizCRS)).to.be.true;
      expect(horizCRS.equals(outHorizCRS)).to.be.true;
    };

    /** For the moment no property is validated so we always use input as compare base */
    roundTrip(undefined, {});
    roundTrip({}, "input");

    roundTrip({ id: "123" }, "input");

    roundTrip({ description: "This is a dummy description" }, "input");
    roundTrip({ deprecated: true }, "input");
    roundTrip({ source: "This is a dummy source" }, "input");
    roundTrip({ epsg: 4326 }, "input");

    roundTrip({ id: "WGS84" }, "input");
    roundTrip({ id: "ETRF89" }, "input");
    roundTrip({ id: "GDA2020" }, "input");

    roundTrip({
      id: "LatLong-WGS84",
      epsg: 4326,
      datumId: "WGS84",
      projection: { method: "None" },
      area: {
        latitude: { min: 12.1, max: 14.56 },
        longitude: { min: 45.6, max: 58.7 },
      },
    }, "input");

    roundTrip({
      id: "LatLong-GRS1980",
      ellipsoidId: "GRS1980",
      projection: { method: "None" },
      area: {
        latitude: { min: 12.1, max: 14.56 },
        longitude: { min: 45.6, max: 58.7 },
      },
    }, "input");

    // Attempt to set both datum and ellipsoid (ellipsoid will be dropped)
    roundTrip({
      id: "LatLong-GRS1980-INV",
      ellipsoidId: "GRS1980",
      ellipsoid: { id: "GRS1980", description: "An ellipsoid description" },
      datumId: "WGS84",
      datum: { id: "WGS84", description: "A datum description" },
      projection: { method: "None" },
      area: { latitude: { min: 12.1, max: 14.56 }, longitude: { min: 45.6, max: 58.7 } },
    }, {
      id: "LatLong-GRS1980-INV",
      datumId: "WGS84",
      datum: { id: "WGS84", description: "A datum description" },
      ellipsoidId: undefined,
      ellipsoid: undefined,
      projection: { method: "None" },
      area: {
        latitude: { min: 12.1, max: 14.56 },
        longitude: { min: 45.6, max: 58.7 },
      },
    });

    roundTrip({
      id: "10TM115-27",
      description: "",
      source: "Mentor Software Client",
      deprecated: false,
      datumId: "NAD27",
      datum: {
        id: "NAD27",
        description: "North American Datum of 1927 (US48, AK, HI, and Canada)",
        deprecated: false,
        source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
        epsg: 6267,
        ellipsoidId: "CLRK66",
        ellipsoid: {
          id: "CLRK66",
          epsg: 7008,
          description: "Clarke 1866, Benoit Ratio",
          source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
          equatorialRadius: 6378160.0,
          polarRadius: 6356774.719195305951,
        },
        transforms: [
          {
            method: "GridFiles",
            gridFile: {
              files: [
                { fileName: "./Usa/Nadcon/conus.l?s", format: "NADCON", direction: "Direct" },
                { fileName: "./Usa/Nadcon/alaska.l?s", format: "NADCON", direction: "Direct" },
                { fileName: "./Usa/Nadcon/prvi.l?s", format: "NADCON", direction: "Direct" },
                { fileName: "./Usa/Nadcon/hawaii.l?s", format: "NADCON", direction: "Direct" },
                { fileName: "./Usa/Nadcon/stgeorge.l?s", format: "NADCON", direction: "Direct" },
                { fileName: "./Usa/Nadcon/stlrnc.l?s", format: "NADCON", direction: "Direct" },
                { fileName: "./Usa/Nadcon/stpaul.l?s", format: "NADCON", direction: "Direct" },
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
      area: {
        latitude: { min: 48, max: 84 },
        longitude: { min: -120.5, max: -109.5 },
      },
    }, "input");
  });

  /* GeographicCRS unit tests */
  it("round-trips GeographicCRS through JSON", () => {
    const roundTrip = (input: GeographicCRSProps | undefined, expected: GeographicCRSProps | "input") => {
      if (!input)
        input = {};

      if ("input" === expected)
        expected = JSON.parse(JSON.stringify(input)) as GeographicCRS;

      const geoCRS = GeographicCRS.fromJSON(input);
      const output = geoCRS.toJSON();
      const outGeoCRS = GeographicCRS.fromJSON(output);

      expect((output.horizontalCRS === undefined) === (expected.horizontalCRS === undefined)).to.be.true;
      // No need to verify the datum content as they were verified in another test.
      expect((output.verticalCRS === undefined) === (expected.verticalCRS === undefined)).to.be.true;
      // No need to verify the ellipsoid content as they were verified in another test.

      const expectedGeoCRS = GeographicCRS.fromJSON(expected);
      expect(geoCRS.equals(expectedGeoCRS)).to.be.true;
      expect(geoCRS.equals(outGeoCRS)).to.be.true;
    };

    /** For the moment no property is validated so we always use input as compare base */
    roundTrip(undefined, {});
    roundTrip({}, "input");

    roundTrip({ horizontalCRS: { id: "123" } }, "input");

    roundTrip({ horizontalCRS: { description: "This is a dummy description" } }, "input");
    roundTrip({ horizontalCRS: { deprecated: true } }, "input");
    roundTrip({ horizontalCRS: { source: "This is a dummy source" } }, "input");
    roundTrip({ horizontalCRS: { epsg: 4326 } }, "input");

    roundTrip({ horizontalCRS: { id: "LL83" }, verticalCRS: { id: "NAVD88" } }, "input");
    roundTrip({ horizontalCRS: { id: "ETRF89" }, verticalCRS: { id: "ELLIPSOID" } }, "input");
    roundTrip({ horizontalCRS: { id: "GDA2020" }, verticalCRS: { id: "GEOID" } }, "input");
    roundTrip({ horizontalCRS: { id: "GDA2020" }, verticalCRS: { id: "GEOID" }, additionalTransform: { helmert2DWithZOffset: {translationX: 10.0, translationY: 15.0, translationZ: 0.02, rotDeg: 1.2, scale: 1.0001 } } }, "input");

    roundTrip({
      horizontalCRS: {
        id: "LatLong-WGS84",
        epsg: 4326,
        datumId: "WGS84",
        projection: { method: "None" },
        area: { latitude: { min: 12.1, max: 14.56 }, longitude: { min: 45.6, max: 58.7 } },
      },
      verticalCRS: { id: "ELLIPSOID" },
    }, "input");

    roundTrip({
      horizontalCRS: {
        id: "10TM115-27",
        description: "",
        source: "Mentor Software Client",
        deprecated: false,
        datumId: "NAD27",
        datum: {
          id: "NAD27",
          description: "North American Datum of 1927 (US48, AK, HI, and Canada)",
          deprecated: false,
          source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
          epsg: 6267,
          ellipsoidId: "CLRK66",
          ellipsoid: {
            id: "CLRK66",
            epsg: 7008,
            description: "Clarke 1866, Benoit Ratio",
            source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
            equatorialRadius: 6378160.0,
            polarRadius: 6356774.719195305951,
          },
          transforms: [
            {
              method: "GridFiles",
              gridFile: {
                files: [
                  { fileName: "./Usa/Nadcon/conus.l?s", format: "NADCON", direction: "Direct" },
                  { fileName: "./Usa/Nadcon/alaska.l?s", format: "NADCON", direction: "Direct" },
                  { fileName: "./Usa/Nadcon/prvi.l?s", format: "NADCON", direction: "Direct" },
                  { fileName: "./Usa/Nadcon/hawaii.l?s", format: "NADCON", direction: "Direct" },
                  { fileName: "./Usa/Nadcon/stgeorge.l?s", format: "NADCON", direction: "Direct" },
                  { fileName: "./Usa/Nadcon/stlrnc.l?s", format: "NADCON", direction: "Direct" },
                  { fileName: "./Usa/Nadcon/stpaul.l?s", format: "NADCON", direction: "Direct" },
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
        area: {
          latitude: { min: 48, max: 84 },
          longitude: { min: -120.5, max: -109.5 },
        },
      },
      verticalCRS: { id: "GEOID" },
    }, "input");

    roundTrip({
      horizontalCRS: {
        id: "10TM115-27",
        description: "",
        source: "Mentor Software Client",
        deprecated: false,
        datumId: "NAD27",
        datum: {
          id: "NAD27",
          description: "North American Datum of 1927 (US48, AK, HI, and Canada)",
          deprecated: false,
          source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
          epsg: 6267,
          ellipsoidId: "CLRK66",
          ellipsoid: {
            id: "CLRK66",
            epsg: 7008,
            description: "Clarke 1866, Benoit Ratio",
            source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
            equatorialRadius: 6378160.0,
            polarRadius: 6356774.719195305951,
          },
          transforms: [
            {
              method: "GridFiles",
              gridFile: {
                files: [
                  { fileName: "./Usa/Nadcon/conus.l?s", format: "NADCON", direction: "Direct" },
                  { fileName: "./Usa/Nadcon/alaska.l?s", format: "NADCON", direction: "Direct" },
                  { fileName: "./Usa/Nadcon/prvi.l?s", format: "NADCON", direction: "Direct" },
                  { fileName: "./Usa/Nadcon/hawaii.l?s", format: "NADCON", direction: "Direct" },
                  { fileName: "./Usa/Nadcon/stgeorge.l?s", format: "NADCON", direction: "Direct" },
                  { fileName: "./Usa/Nadcon/stlrnc.l?s", format: "NADCON", direction: "Direct" },
                  { fileName: "./Usa/Nadcon/stpaul.l?s", format: "NADCON", direction: "Direct" },
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
        area: {
          latitude: { min: 48, max: 84 },
          longitude: { min: -120.5, max: -109.5 },
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
    }, "input");

  });
});
