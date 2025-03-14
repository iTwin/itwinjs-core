/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cspell:ignore JSONXYZ, ETRF, OSGB, DHDN, CLRK, Benoit, NAVD, NADCON, Xfrm, prvi, stgeorge, stlrnc, stpaul, helmert, NSRS

import { describe, expect, it } from "vitest";
import { GeographicCRS, GeographicCRSProps, HorizontalCRS, HorizontalCRSExtent, HorizontalCRSExtentProps, HorizontalCRSProps } from "../geometry/CoordinateReferenceSystem";
import { GeodeticDatum, GeodeticDatumProps, GeodeticTransform, GeodeticTransformPath, GeodeticTransformPathProps, GeodeticTransformProps } from "../geometry/GeodeticDatum";
import { GeodeticEllipsoid, GeodeticEllipsoidProps } from "../geometry/GeodeticEllipsoid";
import { Carto2DDegrees } from "../geometry/Projection";
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
      expect((output.sourceEllipsoid === undefined) === (expected.sourceEllipsoid === undefined)).to.be.true;
      // No need to verify the ellipsoid content as they were verified in another test.
      expect((output.targetEllipsoid === undefined) === (expected.targetEllipsoid === undefined)).to.be.true;
      // No need to verify the ellipsoid content as they were verified in another test.

      expect((output.geocentric === undefined) === (expected.geocentric === undefined)).to.be.true;
      if (output.geocentric) {
        expect(output.geocentric.delta.x === expected.geocentric!.delta.x);
      }
      expect((output.gridFile === undefined) === (expected.gridFile === undefined)).to.be.true;
      if (output.gridFile) {
        expect((output.gridFile.fallback === undefined) === (expected.gridFile!.fallback === undefined)).to.be.true;
        if (output.gridFile.fallback) {
          expect(output.gridFile.fallback.delta.x === expected.gridFile!.fallback!.delta.x).to.be.true;
          expect(output.gridFile.fallback.delta.y === expected.gridFile!.fallback!.delta.y).to.be.true;
          expect(output.gridFile.fallback.delta.z === expected.gridFile!.fallback!.delta.z).to.be.true;
          expect(output.gridFile.fallback.rotation.x === expected.gridFile!.fallback!.rotation.x).to.be.true;
          expect(output.gridFile.fallback.rotation.y === expected.gridFile!.fallback!.rotation.y).to.be.true;
          expect(output.gridFile.fallback.rotation.z === expected.gridFile!.fallback!.rotation.z).to.be.true;
        }
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
      sourceEllipsoid: {
        id: "CLRK66",
        epsg: 7008,
        description: "Clarke 1866, Benoit Ratio",
        source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
        equatorialRadius: 6378160.0,
        polarRadius: 6356774.719195306,
      },
      targetEllipsoid: {
        id: "WGS84",
        epsg: 6326,
        description: "Clarke 1866, Benoit Ratio",
        source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
        equatorialRadius: 6378160.0,
        polarRadius: 6356774.719195306,
      },
      gridFile: {
        fallback: {
          scalePPM: -0.191,
          delta: { x: -117.763, y: -51.51, z: 139.061 },
          rotation: { x: -0.292, y: -0.443, z: -0.277 },
        },
        files: [
          { fileName: "toto.tat", format: "NADCON", direction: "Direct" },
          { fileName: "foo.foo", format: "NTv1", direction: "Inverse" },
        ],
      },
    }, "input");

    // This one verifies that fuzzy number compares apply
    const transform1 = new GeodeticTransform({
      method: "GridFiles",
      sourceEllipsoid: {
        id: "CLRK66",
        epsg: 7008,
        description: "Clarke 1866, Benoit Ratio",
        source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
        equatorialRadius: 6378160.0,
        polarRadius: 6356774.719195306,
      },
      targetEllipsoid: {
        id: "WGS84",
        epsg: 6326,
        description: "Clarke 1866, Benoit Ratio",
        source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
        equatorialRadius: 6378160.0,
        polarRadius: 6356774.719195306,
      },
      gridFile: {
        fallback: {
          scalePPM: -0.191,
          delta: { x: -117.763, y: -51.51, z: 139.061 },
          rotation: { x: -0.292, y: -0.443, z: -0.277 },
        },
        files: [
          { fileName: "toto.tat", format: "NADCON", direction: "Direct" },
          { fileName: "foo.foo", format: "NTv1", direction: "Inverse" },
        ],
      },
    });
    const transform2 = new GeodeticTransform({
      method: "GridFiles",
      sourceEllipsoid: {
        id: "CLRK66",
        epsg: 7008,
        description: "Clarke 1866, Benoit Ratio",
        source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
        equatorialRadius: 6378160.0,
        polarRadius: 6356774.719195306,
      },
      targetEllipsoid: {
        id: "WGS84",
        epsg: 6326,
        description: "Clarke 1866, Benoit Ratio",
        source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
        equatorialRadius: 6378160.0,
        polarRadius: 6356774.719195306,
      },
      gridFile: {
        fallback: {
          scalePPM: -0.19100000000001,
          delta: { x: -117.7630000000001, y: -51.51, z: 139.06100000000001 },
          rotation: { x: -0.292, y: -0.4430000000001, z: -0.277 },
        },
        files: [
          { fileName: "toto.tat", format: "NADCON", direction: "Direct" },
          { fileName: "foo.foo", format: "NTv1", direction: "Inverse" },
        ],
      },
    });

    expect(transform1.equals(transform2)).to.be.true;
  });

  /* Geodetic Transform Path unit tests */
  it("round-trips GeodeticTransformPath through JSON", () => {
    const roundTrip = (input: GeodeticTransformPathProps | undefined, expected: GeodeticTransformPathProps | "input") => {
      if (!input)
        input = { sourceDatumId: "NAD27" };

      if ("input" === expected)
        expected = JSON.parse(JSON.stringify(input)) as GeodeticTransformPath;

      const geoTransformPath = GeodeticTransformPath.fromJSON(input);
      const output = geoTransformPath.toJSON();
      const outTransformPath = GeodeticTransformPath.fromJSON(output);

      expect(output.sourceDatumId === expected.sourceDatumId).to.be.true;
      expect(output.targetDatumId === expected.targetDatumId).to.be.true;
      expect((output.transforms === undefined) === (expected.transforms === undefined)).to.be.true;
      if (output.transforms) {
        expect(output.transforms.length === expected.transforms!.length);
        // No need to check the transform content as they were verified above
      }
      const expectedTransformPath = GeodeticTransformPath.fromJSON(expected);

      expect(geoTransformPath.equals(expectedTransformPath)).to.be.true;
      expect(geoTransformPath.equals(outTransformPath)).to.be.true;
    };

    /** For the moment no property is validated so we always use input as compare base */
    roundTrip(undefined, { sourceDatumId: "NAD27" });
    roundTrip({
      sourceDatumId: "NAD27",
      targetDatumId: "NAD83/HARN-A",
    }, "input");
  },
  );

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
      polarRadius: 6356774.719195306,
    }, "input");

    roundTrip({
      id: "CLRK66",
      epsg: 7008,
      description: "Clarke 1866, Benoit Ratio",
      source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
      equatorialRadius: 6378160.0,
      polarRadius: 6356774.719195306,
    }, "input");

    roundTrip({
      id: "ANS66",
      description: "Australian National Spheroid of 1966",
      source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
      equatorialRadius: 6378160.0,
      polarRadius: 6356774.719195306,
    }, "input");

    // This one verifies that fuzzy number compare is applied
    const ellipsoid1 = new GeodeticEllipsoid({
      id: "CLRK66",
      epsg: 7008,
      description: "Clarke 1866, Benoit Ratio",
      source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
      equatorialRadius: 6378160.0,
      polarRadius: 6356774.719195306,
    });
    const ellipsoid2 = new GeodeticEllipsoid({
      id: "CLRK66",
      epsg: 7008,
      description: "Clarke 1866, Benoit Ratio",
      source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
      equatorialRadius: 6378160,
      polarRadius: 6356774.719195306,
    });
    expect(ellipsoid1.equals(ellipsoid2)).to.be.true;

  });

  /* HorizontalCRSExtent unit tests */
  it("round-trips Horizontal CRS Extent through JSON", () => {
    const roundTrip = (input: HorizontalCRSExtentProps | undefined, expected: HorizontalCRSExtentProps | "input") => {
      if (!input)
        input = { southWest: { latitude: 0.0, longitude: 0.0 }, northEast: { latitude: 0.0, longitude: 0.0 } };

      if ("input" === expected)
        expected = JSON.parse(JSON.stringify(input)) as HorizontalCRSExtent;

      const extent = HorizontalCRSExtent.fromJSON(input);
      const output = extent.toJSON();
      const outExtent = HorizontalCRSExtent.fromJSON(output);

      expect(output.southWest.latitude === expected.southWest.latitude).to.be.true;
      expect(output.southWest.longitude === expected.southWest.longitude).to.be.true;

      expect(output.northEast.latitude === expected.northEast.latitude).to.be.true;
      expect(output.northEast.longitude === expected.northEast.longitude).to.be.true;

      const expectedExtent = HorizontalCRSExtent.fromJSON(expected);

      expect(extent.equals(expectedExtent)).to.be.true;
      expect(extent.equals(outExtent)).to.be.true;

    };

    roundTrip({ southWest: { latitude: 12.1, longitude: 45.6 }, northEast: { latitude: 14.56, longitude: 58.7 } }, "input");
    roundTrip({ southWest: { latitude: -90.0, longitude: 45.6 }, northEast: { latitude: 90.0, longitude: 58.7 } }, "input");
    roundTrip({ southWest: { latitude: 12.1, longitude: -190.1 }, northEast: { latitude: 14.56, longitude: -158.7 } }, "input");

    roundTrip({ southWest: { latitude: 12.1, longitude: 178.1 }, northEast: { latitude: 14.56, longitude: -178.7 } }, "input");

    // This one verifies that fuzzy number compare are applied
    const cartoPointA = HorizontalCRSExtent.fromJSON({ southWest: { latitude: 12.1, longitude: 178.1 }, northEast: { latitude: 14.56, longitude: -178.7 } });
    const cartoPointB = HorizontalCRSExtent.fromJSON({ southWest: { latitude: 12.100000000001, longitude: 178.1000000000001 }, northEast: { latitude: 14.56000000001, longitude: -178.70000000001 } });
    expect(cartoPointA.equals(cartoPointB)).to.be.true;

    const cartoPointC = HorizontalCRSExtent.fromJSON({ southWest: { latitude: 12.100000001, longitude: 178.1000000001 }, northEast: { latitude: 14.56000000001, longitude: -178.70000000001 } });
    expect(cartoPointA.equals(cartoPointC)).to.be.false;

    /* Additional unit tests */
    const cartoPoint = Carto2DDegrees.fromJSON({ latitude: 23.4, longitude: 123.4 });
    expect(cartoPoint.latitude === 23.4).to.be.true;
    expect(cartoPoint.longitude === 123.4).to.be.true;

    cartoPoint.latitude = 100.0; /* Impossible value */
    expect(cartoPoint.latitude === 100.0).to.be.false;
    expect(cartoPoint.latitude === 23.4).to.be.true; /* value remained unchanged */

    cartoPoint.longitude = -189.1;
    expect(cartoPoint.longitude === -189.1).to.be.true;
    cartoPoint.longitude = 210.2;
    expect(cartoPoint.longitude === 210.2).to.be.true;

    const extent1 = HorizontalCRSExtent.fromJSON({ southWest: { latitude: 12.1, longitude: 45.6 }, northEast: { latitude: 14.56, longitude: 58.7 } });
    expect(extent1.southWest.latitude === 12.1).to.be.true;
    expect(extent1.southWest.longitude === 45.6).to.be.true;
    expect(extent1.northEast.latitude === 14.56).to.be.true;
    expect(extent1.northEast.longitude === 58.7).to.be.true;

    const extent2 = HorizontalCRSExtent.fromJSON({ southWest: { latitude: 12.1, longitude: 45.6 }, northEast: { latitude: 10.56, longitude: 58.7 } });
    expect(extent2.southWest.latitude === 12.1).to.be.true;
    expect(extent2.southWest.longitude === 45.6).to.be.true;
    expect(extent2.northEast.latitude === 10.56).to.be.false;
    expect(extent2.northEast.latitude === 12.1).to.be.true;
    expect(extent2.northEast.longitude === 58.7).to.be.true;

    const cartoPoint2 = Carto2DDegrees.fromJSON({ latitude: 23.4, longitude: 123.4 });
    const cartoPoint3 = Carto2DDegrees.fromJSON({ latitude: 23.400000000001, longitude: 123.40000000001 });
    expect(cartoPoint2.equals(cartoPoint3)).to.be.true;
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
      expect((output.additionalTransformPaths === undefined) === (expected.additionalTransformPaths === undefined)).to.be.true;
      if (output.additionalTransformPaths) {
        expect(output.additionalTransformPaths.length === expected.additionalTransformPaths!.length);
        // No need to check the transform paths content as they were verified above
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
        polarRadius: 6356774.719195306,
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
        polarRadius: 6356774.719195306,
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
          sourceEllipsoid: {
            id: "CLRK66",
            epsg: 7008,
            description: "Clarke 1866, Benoit Ratio",
            source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
            equatorialRadius: 6378160.0,
            polarRadius: 6356774.719195306,
          },
          targetEllipsoid: {
            id: "WGS84",
            epsg: 6326,
            description: "Clarke 1866, Benoit Ratio",
            source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
            equatorialRadius: 6378160.0,
            polarRadius: 6356774.719195306,
          },
          gridFile: {
            fallback: {
              scalePPM: -0.191,
              delta: { x: -117.763, y: -51.51, z: 139.061 },
              rotation: { x: -0.292, y: -0.443, z: -0.277 },
            },
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
      additionalTransformPaths: [
        {
          sourceDatumId: "NAD27",
          targetDatumId: "NAD83/2011",
          transforms: [
            {
              gridFile: {
                files: [
                  { direction: "Direct", fileName: "./Usa/Nadcon/conus.l?s", format: "NADCON" },
                  { direction: "Direct", fileName: "./Usa/Nadcon/alaska.l?s", format: "NADCON" },
                  { direction: "Direct", fileName: "./Usa/Nadcon/prvi.l?s", format: "NADCON" },
                  { direction: "Direct", fileName: "./Usa/Nadcon/hawaii.l?s", format: "NADCON" },
                  { direction: "Direct", fileName: "./Usa/Nadcon/stgeorge.l?s", format: "NADCON" },
                  { direction: "Direct", fileName: "./Usa/Nadcon/stlrnc.l?s", format: "NADCON" },
                  { direction: "Direct", fileName: "./Usa/Nadcon/stpaul.l?s", format: "NADCON" },
                ],
              },
              method: "GridFiles",
              sourceEllipsoid: {
                equatorialRadius: 6378206.4000000004,
                id: "CLRK66",
                polarRadius: 6356583.7999999998,
              },
              targetDatumId: "NAD83",
              targetEllipsoid: {
                equatorialRadius: 6378137.0,
                id: "GRS1980",
                polarRadius: 6356752.3141403478,
              },
            },
            {
              gridFile: {
                files: [
                  { direction: "Direct", fileName: "./Usa/Harn/48hpgn.l?s", format: "NADCON" },
                  { direction: "Direct", fileName: "./Usa/Harn/hihpgn.l?s", format: "NADCON" },
                  { direction: "Direct", fileName: "./Usa/Harn/pvhpgn.l?s", format: "NADCON" },
                  { direction: "Direct", fileName: "./Usa/Harn/eshpgn.l?s", format: "NADCON" },
                  { direction: "Direct", fileName: "./Usa/Harn/wshpgn.l?s", format: "NADCON" },
                ],
              },
              method: "GridFiles",
              sourceEllipsoid: {
                equatorialRadius: 6378137.0,
                id: "GRS1980",
                polarRadius: 6356752.3141403478,
              },
              targetDatumId: "NAD83/HARN-A",
              targetEllipsoid: {
                equatorialRadius: 6378137.0,
                id: "GRS1980",
                polarRadius: 6356752.3141403478,
              },
            },
            {
              gridFile: {
                files: [
                  { direction: "Direct", fileName: "./Usa/NSRS2007/dsl?.b", format: "GEOCN" },
                  { direction: "Direct", fileName: "./Usa/NSRS2007/dsl?a.b", format: "GEOCN" },
                  { direction: "Direct", fileName: "./Usa/NSRS2007/dsl?p.b", format: "GEOCN" },
                ],
              },
              method: "GridFiles",
              sourceEllipsoid: {
                equatorialRadius: 6378137.0,
                id: "GRS1980",
                polarRadius: 6356752.3141403478,
              },
              targetDatumId: "NSRS07",
              targetEllipsoid: {
                equatorialRadius: 6378137.0,
                id: "GRS1980",
                polarRadius: 6356752.3141403478,
              },
            },
            {
              gridFile: {
                files: [
                  { direction: "Direct", fileName: "./Usa/NSRS2011/dsl?11.b", format: "GEOCN" },
                  { direction: "Direct", fileName: "./Usa/NSRS2011/dsl?a11.b", format: "GEOCN" },
                  { direction: "Direct", fileName: "./Usa/NSRS2011/dsl?p11.b", format: "GEOCN" },
                ],
              },
              method: "GridFiles",
              sourceEllipsoid: {
                equatorialRadius: 6378137.0,
                id: "GRS1980",
                polarRadius: 6356752.3141403478,
              },
              targetDatumId: "NAD83/2011",
              targetEllipsoid: {
                equatorialRadius: 6378137.0,
                id: "GRS1980",
                polarRadius: 6356752.3141403478,
              },
            },
          ],
        },
      ],
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
      extent: {
        southWest: { latitude: 12.1, longitude: 45.6 },
        northEast: { latitude: 14.56, longitude: 58.7 },
      },
    }, "input");

    roundTrip({
      id: "LatLong-GRS1980",
      ellipsoidId: "GRS1980",
      projection: { method: "None" },
      extent: {
        southWest: { latitude: 12.1, longitude: 45.6 },
        northEast: { latitude: 14.56, longitude: 58.7 },
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
      extent: { southWest: { latitude: 12.1, longitude: 45.6 }, northEast: { latitude: 14.56, longitude: 58.7 } },
    }, {
      id: "LatLong-GRS1980-INV",
      datumId: "WGS84",
      datum: { id: "WGS84", description: "A datum description" },
      ellipsoidId: undefined,
      ellipsoid: undefined,
      projection: { method: "None" },
      extent: {
        southWest: { latitude: 12.1, longitude: 45.6 },
        northEast: { latitude: 14.56, longitude: 58.7 },
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
          polarRadius: 6356774.719195306,
        },
        transforms: [
          {
            method: "GridFiles",
            sourceEllipsoid: {
              id: "CLRK66",
              epsg: 7008,
              description: "Clarke 1866, Benoit Ratio",
              source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
              equatorialRadius: 6378160.0,
              polarRadius: 6356774.719195306,
            },
            targetEllipsoid: {
              id: "WGS84",
              epsg: 6326,
              description: "Clarke 1866, Benoit Ratio",
              source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
              equatorialRadius: 6378160.0,
              polarRadius: 6356774.719195306,
            },
            gridFile: {
              fallback: {
                scalePPM: -0.191,
                delta: { x: -117.763, y: -51.51, z: 139.061 },
                rotation: { x: -0.292, y: -0.443, z: -0.277 },
              },
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
        additionalTransformPaths: [
          {
            sourceDatumId: "NAD27",
            targetDatumId: "NAD83/2011",
            transforms: [
              {
                gridFile: {
                  files: [
                    { direction: "Direct", fileName: "./Usa/Nadcon/conus.l?s", format: "NADCON" },
                    { direction: "Direct", fileName: "./Usa/Nadcon/alaska.l?s", format: "NADCON" },
                    { direction: "Direct", fileName: "./Usa/Nadcon/prvi.l?s", format: "NADCON" },
                    { direction: "Direct", fileName: "./Usa/Nadcon/hawaii.l?s", format: "NADCON" },
                    { direction: "Direct", fileName: "./Usa/Nadcon/stgeorge.l?s", format: "NADCON" },
                    { direction: "Direct", fileName: "./Usa/Nadcon/stlrnc.l?s", format: "NADCON" },
                    { direction: "Direct", fileName: "./Usa/Nadcon/stpaul.l?s", format: "NADCON" },
                  ],
                },
                method: "GridFiles",
                sourceEllipsoid: {
                  equatorialRadius: 6378206.4000000004,
                  id: "CLRK66",
                  polarRadius: 6356583.7999999998,
                },
                targetDatumId: "NAD83",
                targetEllipsoid: {
                  equatorialRadius: 6378137.0,
                  id: "GRS1980",
                  polarRadius: 6356752.3141403478,
                },
              },
              {
                gridFile: {
                  files: [
                    { direction: "Direct", fileName: "./Usa/Harn/48hpgn.l?s", format: "NADCON" },
                    { direction: "Direct", fileName: "./Usa/Harn/hihpgn.l?s", format: "NADCON" },
                    { direction: "Direct", fileName: "./Usa/Harn/pvhpgn.l?s", format: "NADCON" },
                    { direction: "Direct", fileName: "./Usa/Harn/eshpgn.l?s", format: "NADCON" },
                    { direction: "Direct", fileName: "./Usa/Harn/wshpgn.l?s", format: "NADCON" },
                  ],
                },
                method: "GridFiles",
                sourceEllipsoid: {
                  equatorialRadius: 6378137.0,
                  id: "GRS1980",
                  polarRadius: 6356752.3141403478,
                },
                targetDatumId: "NAD83/HARN-A",
                targetEllipsoid: {
                  equatorialRadius: 6378137.0,
                  id: "GRS1980",
                  polarRadius: 6356752.3141403478,
                },
              },
              {
                gridFile: {
                  files: [
                    { direction: "Direct", fileName: "./Usa/NSRS2007/dsl?.b", format: "GEOCN" },
                    { direction: "Direct", fileName: "./Usa/NSRS2007/dsl?a.b", format: "GEOCN" },
                    { direction: "Direct", fileName: "./Usa/NSRS2007/dsl?p.b", format: "GEOCN" },
                  ],
                },
                method: "GridFiles",
                sourceEllipsoid: {
                  equatorialRadius: 6378137.0,
                  id: "GRS1980",
                  polarRadius: 6356752.3141403478,
                },
                targetDatumId: "NSRS07",
                targetEllipsoid: {
                  equatorialRadius: 6378137.0,
                  id: "GRS1980",
                  polarRadius: 6356752.3141403478,
                },
              },
              {
                gridFile: {
                  files: [
                    { direction: "Direct", fileName: "./Usa/NSRS2011/dsl?11.b", format: "GEOCN" },
                    { direction: "Direct", fileName: "./Usa/NSRS2011/dsl?a11.b", format: "GEOCN" },
                    { direction: "Direct", fileName: "./Usa/NSRS2011/dsl?p11.b", format: "GEOCN" },
                  ],
                },
                method: "GridFiles",
                sourceEllipsoid: {
                  equatorialRadius: 6378137.0,
                  id: "GRS1980",
                  polarRadius: 6356752.3141403478,
                },
                targetDatumId: "NAD83/2011",
                targetEllipsoid: {
                  equatorialRadius: 6378137.0,
                  id: "GRS1980",
                  polarRadius: 6356752.3141403478,
                },
              },
            ],
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
    roundTrip({ horizontalCRS: { id: "OSGB" }, verticalCRS: { id: "LOCAL_ELLIPSOID" } }, "input");
    roundTrip({ horizontalCRS: { id: "GDA2020" }, verticalCRS: { id: "GEOID" } }, "input");
    roundTrip({ horizontalCRS: { id: "GDA2020" }, verticalCRS: { id: "GEOID" }, additionalTransform: { helmert2DWithZOffset: { translationX: 10.0, translationY: 15.0, translationZ: 0.02, rotDeg: 1.2, scale: 1.0001 } } }, "input");

    roundTrip({
      horizontalCRS: {
        id: "LatLong-WGS84",
        epsg: 4326,
        datumId: "WGS84",
        projection: { method: "None" },
        extent: { southWest: { latitude: 12.1, longitude: 45.6 }, northEast: { latitude: 14.56, longitude: 58.7 } },
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
            polarRadius: 6356774.719195306,
          },
          transforms: [
            {
              method: "GridFiles",
              sourceEllipsoid: {
                id: "CLRK66",
                epsg: 7008,
                description: "Clarke 1866, Benoit Ratio",
                source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
                equatorialRadius: 6378160.0,
                polarRadius: 6356774.719195306,
              },
              targetEllipsoid: {
                id: "WGS84",
                epsg: 6326,
                description: "Clarke 1866, Benoit Ratio",
                source: "US Defense Mapping Agency, TR-8350.2-B, December 1987",
                equatorialRadius: 6378160.0,
                polarRadius: 6356774.719195306,
              },
              gridFile: {
                fallback: {
                  scalePPM: -0.191,
                  delta: { x: -117.763, y: -51.51, z: 139.061 },
                  rotation: { x: -0.292, y: -0.443, z: -0.277 },
                },
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
          additionalTransformPaths: [
            {
              sourceDatumId: "NAD27",
              targetDatumId: "NAD83/2011",
              transforms: [
                {
                  gridFile: {
                    files: [
                      { direction: "Direct", fileName: "./Usa/Nadcon/conus.l?s", format: "NADCON" },
                      { direction: "Direct", fileName: "./Usa/Nadcon/alaska.l?s", format: "NADCON" },
                      { direction: "Direct", fileName: "./Usa/Nadcon/prvi.l?s", format: "NADCON" },
                      { direction: "Direct", fileName: "./Usa/Nadcon/hawaii.l?s", format: "NADCON" },
                      { direction: "Direct", fileName: "./Usa/Nadcon/stgeorge.l?s", format: "NADCON" },
                      { direction: "Direct", fileName: "./Usa/Nadcon/stlrnc.l?s", format: "NADCON" },
                      { direction: "Direct", fileName: "./Usa/Nadcon/stpaul.l?s", format: "NADCON" },
                    ],
                  },
                  method: "GridFiles",
                  sourceEllipsoid: {
                    equatorialRadius: 6378206.4000000004,
                    id: "CLRK66",
                    polarRadius: 6356583.7999999998,
                  },
                  targetDatumId: "NAD83",
                  targetEllipsoid: {
                    equatorialRadius: 6378137.0,
                    id: "GRS1980",
                    polarRadius: 6356752.3141403478,
                  },
                },
                {
                  gridFile: {
                    files: [
                      { direction: "Direct", fileName: "./Usa/Harn/48hpgn.l?s", format: "NADCON" },
                      { direction: "Direct", fileName: "./Usa/Harn/hihpgn.l?s", format: "NADCON" },
                      { direction: "Direct", fileName: "./Usa/Harn/pvhpgn.l?s", format: "NADCON" },
                      { direction: "Direct", fileName: "./Usa/Harn/eshpgn.l?s", format: "NADCON" },
                      { direction: "Direct", fileName: "./Usa/Harn/wshpgn.l?s", format: "NADCON" },
                    ],
                  },
                  method: "GridFiles",
                  sourceEllipsoid: {
                    equatorialRadius: 6378137.0,
                    id: "GRS1980",
                    polarRadius: 6356752.3141403478,
                  },
                  targetDatumId: "NAD83/HARN-A",
                  targetEllipsoid: {
                    equatorialRadius: 6378137.0,
                    id: "GRS1980",
                    polarRadius: 6356752.3141403478,
                  },
                },
                {
                  gridFile: {
                    files: [
                      { direction: "Direct", fileName: "./Usa/NSRS2007/dsl?.b", format: "GEOCN" },
                      { direction: "Direct", fileName: "./Usa/NSRS2007/dsl?a.b", format: "GEOCN" },
                      { direction: "Direct", fileName: "./Usa/NSRS2007/dsl?p.b", format: "GEOCN" },
                    ],
                  },
                  method: "GridFiles",
                  sourceEllipsoid: {
                    equatorialRadius: 6378137.0,
                    id: "GRS1980",
                    polarRadius: 6356752.3141403478,
                  },
                  targetDatumId: "NSRS07",
                  targetEllipsoid: {
                    equatorialRadius: 6378137.0,
                    id: "GRS1980",
                    polarRadius: 6356752.3141403478,
                  },
                },
                {
                  gridFile: {
                    files: [
                      { direction: "Direct", fileName: "./Usa/NSRS2011/dsl?11.b", format: "GEOCN" },
                      { direction: "Direct", fileName: "./Usa/NSRS2011/dsl?a11.b", format: "GEOCN" },
                      { direction: "Direct", fileName: "./Usa/NSRS2011/dsl?p11.b", format: "GEOCN" },
                    ],
                  },
                  method: "GridFiles",
                  sourceEllipsoid: {
                    equatorialRadius: 6378137.0,
                    id: "GRS1980",
                    polarRadius: 6356752.3141403478,
                  },
                  targetDatumId: "NAD83/2011",
                  targetEllipsoid: {
                    equatorialRadius: 6378137.0,
                    id: "GRS1980",
                    polarRadius: 6356752.3141403478,
                  },
                },
              ],
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
            polarRadius: 6356774.719195306,
          },
          transforms: [
            {
              method: "GridFiles",
              sourceEllipsoid: {
                id: "CLRK66",
                equatorialRadius: 6378160.0,
                polarRadius: 6356774.719195306,
              },
              targetEllipsoid: {
                id: "WGS84-2",
                equatorialRadius: 6378160.0,
                polarRadius: 6356774.719195306,
              },
              gridFile: {
                fallback: {
                  scalePPM: -0.191,
                  delta: { x: -117.763, y: -51.51, z: 139.061 },
                  rotation: { x: -0.292, y: -0.443, z: -0.277 },
                },
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
            {
              method: "GridFiles",
              sourceEllipsoid: {
                id: "WGS84-2",
                equatorialRadius: 6378160.0,
                polarRadius: 6356774.719195306,
              },
              targetEllipsoid: {
                id: "NSRS98",
                equatorialRadius: 6378160.1,
                polarRadius: 6356774.719195,
              },
              gridFile: {
                fallback: {
                  scalePPM: -0.191,
                  delta: { x: -117.763, y: -51.51, z: 139.061 },
                  rotation: { x: -0.292, y: -0.443, z: -0.277 },
                },
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
    }, "input");

    // This one verifies that fuzzy number compare apply to projections
    const CRS1 = new GeographicCRS({
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
            polarRadius: 6356774.719195306,
          },
          transforms: [
            {
              method: "GridFiles",
              sourceEllipsoid: {
                id: "CLRK66",
                equatorialRadius: 6378160.0,
                polarRadius: 6356774.719195306,
              },
              targetEllipsoid: {
                id: "WGS84-2",
                equatorialRadius: 6378160.0,
                polarRadius: 6356774.719195306,
              },
              gridFile: {
                fallback: {
                  scalePPM: -0.191,
                  delta: { x: -117.763, y: -51.51, z: 139.061 },
                  rotation: { x: -0.292, y: -0.443, z: -0.277 },
                },
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
            {
              method: "GridFiles",
              sourceEllipsoid: {
                id: "WGS84-2",
                equatorialRadius: 6378160.0,
                polarRadius: 6356774.719195306,
              },
              targetEllipsoid: {
                id: "NSRS98",
                equatorialRadius: 6378160.1,
                polarRadius: 6356774.719195,
              },
              gridFile: {
                fallback: {
                  scalePPM: -0.191,
                  delta: { x: -117.763, y: -51.51, z: 139.061 },
                  rotation: { x: -0.292, y: -0.443, z: -0.277 },
                },
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

    const CRS2 = new GeographicCRS({
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
            polarRadius: 6356774.719195306,
          },
          transforms: [
            {
              method: "GridFiles",
              sourceEllipsoid: {
                id: "CLRK66",
                equatorialRadius: 6378160.0,
                polarRadius: 6356774.719195306,
              },
              targetEllipsoid: {
                id: "WGS84-2",
                equatorialRadius: 6378160.0,
                polarRadius: 6356774.719195306,
              },
              gridFile: {
                fallback: {
                  scalePPM: -0.191,
                  delta: { x: -117.7630000000001, y: -51.51, z: 139.061 },
                  rotation: { x: -0.292, y: -0.4430000000001, z: -0.277 },
                },
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
            {
              method: "GridFiles",
              sourceEllipsoid: {
                id: "WGS84-2",
                equatorialRadius: 6378160.0,
                polarRadius: 6356774.719195306,
              },
              targetEllipsoid: {
                id: "NSRS98",
                equatorialRadius: 6378160.1,
                polarRadius: 6356774.719195,
              },
              gridFile: {
                fallback: {
                  scalePPM: -0.191,
                  delta: { x: -117.763, y: -51.51, z: 139.0610000000001 },
                  rotation: { x: -0.292, y: -0.443, z: -0.2770000000001 },
                },
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
          centralMeridian: -115.0000000000001,
          latitudeOfOrigin: 0.000000000001,
          scaleFactor: 0.99920000000001,
          falseEasting: 1.0000000000001,
          falseNorthing: 2.000000000001,
        },
        extent: {
          southWest: { latitude: 48, longitude: -120.500000000001 },
          northEast: { latitude: 84, longitude: -109.500000000001 },
        },
      },
      verticalCRS: { id: "GEOID" },
      additionalTransform: {
        helmert2DWithZOffset: {
          translationX: 10.0000000000001,
          translationY: 15.0000000000001,
          translationZ: 0.02000000000001,
          rotDeg: 1.2000000000001,
          scale: 1.0001,
        },
      },
    });

    expect(CRS1.equals(CRS2)).to.be.true;
  });

});
