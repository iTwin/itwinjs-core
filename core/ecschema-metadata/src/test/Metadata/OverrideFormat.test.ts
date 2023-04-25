/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { SchemaContext } from "../../Context";
import { Format } from "../../Metadata/Format";
import { InvertedUnit } from "../../Metadata/InvertedUnit";
import { OverrideFormat } from "../../Metadata/OverrideFormat";
import { Schema } from "../../Metadata/Schema";
import { Unit } from "../../Metadata/Unit";
import { FormatTraits, FractionalPrecision, ShowSignOption } from "@itwin/core-quantity";
import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";
import { TestSchemaLocater } from "../TestUtils/FormatTestHelper";

/* eslint-disable @typescript-eslint/naming-convention */

function createSchemaJson(format: any) {
  return createSchemaJsonWithItems({
    TestFormat: {
      schemaItemType: "Format",
      ...format,
    },
  }, {
    references: [
      {
        name: "Formats",
        version: "1.0.0",
      },
    ],
  });
}

describe("OverrideFormat", () => {
  let context: SchemaContext;
  beforeEach(() => {
    context = new SchemaContext();

    // contains the Formats schema
    context.addLocater(new TestSchemaLocater());
  });

  it("with no overrides should have the same values as parent", () => {
    const schemaJson = createSchemaJson({
      type: "Fractional",
      precision: 2,
      roundFactor: 5.0,
      minWidth: 4,
      showSignOption: "NoSign",
      decimalSeparator: ",",
      thousandSeparator: ".",
      uomSeparator: "-",
      formatTraits: [
        "TrailZeroes",
        "PrependUnitLabel",
      ],
      composite: {
        includeZero: false,
        spacer: "-",
        units: [
          {
            name: "Formats.YRD",
            label: "yard(s)",
          },
        ],
      },
    });

    const schema = Schema.fromJsonSync(schemaJson, context);
    const format = schema.getItemSync<Format>("TestFormat");
    assert.isDefined(format);

    const overrideFormat = new OverrideFormat(format!);
    expect(overrideFormat.parent).eq(format);
    expect(overrideFormat.name).eq(format!.fullName);
    expect(overrideFormat.roundFactor).eq(5.0);
    expect(overrideFormat.minWidth).eq(4);
    expect(overrideFormat.showSignOption).eq(ShowSignOption.NoSign);
    expect(overrideFormat.decimalSeparator).eq(",");
    expect(overrideFormat.thousandSeparator).eq(".");
    expect(overrideFormat.uomSeparator).eq("-");
    expect(overrideFormat.hasFormatTrait(FormatTraits.TrailZeroes | FormatTraits.PrependUnitLabel));
    expect(overrideFormat.includeZero).false;
    expect(overrideFormat.spacer).eq("-");

    assert.isDefined(overrideFormat.units);
    expect(overrideFormat.units!.length).eq(1);

    const expectedJson = {
      schemaItemType: "Format",
      type: "Fractional",
      precision: 2,
      roundFactor: 5,
      showSignOption: "NoSign",
      formatTraits: ["TrailZeroes", "PrependUnitLabel"],
      decimalSeparator: ",",
      thousandSeparator: ".",
      uomSeparator: "-",
      minWidth: 4,
      composite: {
        spacer: "-",
        includeZero: false,
        units: [{ name: "Formats.YRD", label: "yard(s)" }],
      },
    };
    expect(JSON.parse(JSON.stringify(overrideFormat.getFormatProps()))).to.be.deep.equal(expectedJson);
  });

  it("with only precision override", () => {
    const schemaJson = createSchemaJson({
      type: "Fractional",
      precision: 2,
    });
    const schema = Schema.fromJsonSync(schemaJson, context);
    const format = schema.getItemSync<Format>("TestFormat");
    assert.isDefined(format);

    const overrideFormat = new OverrideFormat(format!, FractionalPrecision.Eight);
    expect(overrideFormat.precision).eq(FractionalPrecision.Eight);
    expect(overrideFormat.parent.precision).eq(FractionalPrecision.Two);
    assert.equal(overrideFormat.fullName, "TestSchema.TestFormat(8)");
    assert.equal(overrideFormat.name, "TestSchema.TestFormat(8)"); // name and full name are the same for override strings

    const expectedJson = {
      name: "TestSchema.TestFormat(8)",
      parent: "TestSchema.TestFormat",
      schemaItemType: "Format",
      type: "Fractional",
      precision: 8,
    };
    expect(JSON.parse(JSON.stringify(overrideFormat.getFormatProps()))).to.be.deep.equal(expectedJson);
  });

  it("with only unit overrides", () => {
    const schemaJson = createSchemaJson({
      type: "Fractional",
      precision: 2,
    });

    const schema = Schema.fromJsonSync(schemaJson, context);
    const format = schema.getItemSync<Format>("TestFormat");
    assert.isDefined(format);

    const mileU = schema.lookupItemSync<Unit>("Formats.MILE");
    assert.isDefined(mileU);

    const yrdU = schema.lookupItemSync<Unit>("Formats.YRD");
    assert.isDefined(yrdU);

    const unitListMile = new Array<[Unit | InvertedUnit, string | undefined]>();
    unitListMile.push([mileU!, undefined]);
    const unitListYrd = new Array<[Unit | InvertedUnit, string | undefined]>();
    unitListYrd.push([yrdU!, "yd"]);

    const overrideFormatMile = new OverrideFormat(format!, undefined, unitListMile);
    assert.isDefined(overrideFormatMile.units);
    expect(overrideFormatMile.units!.length).eq(1);
    expect(overrideFormatMile.units![0][0]).eq(mileU);
    assert.equal(overrideFormatMile.fullName, "TestSchema.TestFormat[Formats.MILE]");
    assert.equal(overrideFormatMile.name, "TestSchema.TestFormat[Formats.MILE]");

    const expectedJsonFormatMile = {
      name: "TestSchema.TestFormat[Formats.MILE]",
      parent: "TestSchema.TestFormat",
      schemaItemType: "Format",
      type: "Fractional",
      precision: 2,
      composite: {
        units: [{ name: "Formats.MILE" }],
      },
    };
    expect(JSON.parse(JSON.stringify(overrideFormatMile.getFormatProps()))).to.be.deep.equal(expectedJsonFormatMile);

    const overrideFormatYrd = new OverrideFormat(format!, undefined, unitListYrd);
    assert.isDefined(overrideFormatYrd.units);
    expect(overrideFormatYrd.units!.length).eq(1);
    expect(overrideFormatYrd.units![0][0]).eq(yrdU);
    expect(overrideFormatYrd.units![0][1]).eq("yd");
    assert.equal(overrideFormatYrd.fullName, "TestSchema.TestFormat[Formats.YRD|yd]");
    assert.equal(overrideFormatYrd.name, "TestSchema.TestFormat[Formats.YRD|yd]");

    const expectedJsonFormatYard = {
      name: "TestSchema.TestFormat[Formats.YRD|yd]",
      parent: "TestSchema.TestFormat",
      schemaItemType: "Format",
      type: "Fractional",
      precision: 2,
      composite: {
        units: [{ name: "Formats.YRD", label: "yd" }],
      },
    };
    expect(JSON.parse(JSON.stringify(overrideFormatYrd.getFormatProps()))).to.be.deep.equal(expectedJsonFormatYard);
  });

  it("with precision and unit overrides", () => {
    const schemaJson = createSchemaJson({
      type: "Fractional",
      precision: 2,
      composite: {
        includeZero: false,
        spacer: "-",
        units: [
          {
            name: "Formats.YRD",
            label: "yard(s)",
          },
        ],
      },
    });

    const schema = Schema.fromJsonSync(schemaJson, context);
    const format = schema.getItemSync<Format>("TestFormat");
    assert.isDefined(format);

    const mileU = schema.lookupItemSync<Unit>("Formats.MILE");
    assert.isDefined(mileU);

    const unitListMile = new Array<[Unit | InvertedUnit, string | undefined]>();
    unitListMile.push([mileU!, "mi"]);

    const overridePrecisionAndUnit = new OverrideFormat(format!, FractionalPrecision.Four, unitListMile);
    assert.isDefined(overridePrecisionAndUnit.units);
    expect(overridePrecisionAndUnit.units!.length).eq(1);
    expect(overridePrecisionAndUnit.units![0][0]).eq(mileU);
    assert.equal(overridePrecisionAndUnit.fullName, "TestSchema.TestFormat(4)[Formats.MILE|mi]");
    assert.equal(overridePrecisionAndUnit.name, "TestSchema.TestFormat(4)[Formats.MILE|mi]");

    const expectedJson = {
      name: "TestSchema.TestFormat(4)[Formats.MILE|mi]",
      parent: "TestSchema.TestFormat",
      schemaItemType: "Format",
      type: "Fractional",
      precision: 4,
      composite: {
        spacer: "-",
        includeZero: false,
        units: [{ name: "Formats.MILE", label: "mi" }],
      },
    };
    expect(JSON.parse(JSON.stringify(overridePrecisionAndUnit.getFormatProps()))).to.be.deep.equal(expectedJson);
  });
});
