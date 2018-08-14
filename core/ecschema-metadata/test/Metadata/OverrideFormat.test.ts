/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import OverrideFormat from "../../src/Metadata/OverrideFormat";
import Schema from "../../src/Metadata/Schema";
import Format from "../../src/Metadata/Format";
import Unit from "../../src/Metadata/Unit";
import { FractionalPrecision, ShowSignOption, FormatTraits } from "../../src/utils/FormatEnums";

import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";
import { SchemaContext } from "../../src/Context";
import { TestSchemaLocater } from "../TestUtils/FormatTestHelper";
import { InvertedUnit } from "../../src";

function createSchemaJson(format: any) {
  return createSchemaJsonWithItems({
    TestFormat: {
      schemaItemType: "Format",
      ...format,
    },
  }, true, {
      references: [
        {
          name: "Formats",
          version: "1.0.0",
        },
      ],
    });
}

describe("OverrideFormat", () => {
  before(() => {
    Schema.ec32 = true;
  });
  after(() => {
    Schema.ec32 = false;
  });

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
        "PrependUnitLabel"
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
      }
    });

    const schema = Schema.fromJsonSync(schemaJson, context);
    const format = schema.getItemSync<Format>("TestFormat");
    assert.isDefined(format);

    const overrideFormat = new OverrideFormat(format!, "NoOverrides");
    expect(overrideFormat.parent).eq(format);
    expect(overrideFormat.name).eq("NoOverrides");
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
  });

  it("with precision override", () => {
    const schemaJson = createSchemaJson({
      type: "Fractional",
      precision: 2,
    });
    const schema = Schema.fromJsonSync(schemaJson, context);
    const format = schema.getItemSync<Format>("TestFormat");
    assert.isDefined(format);

    const overrideFormat = new OverrideFormat(format!, "TestFormatPrecisionOverride", FractionalPrecision.Eight);
    expect(overrideFormat.precision).eq(FractionalPrecision.Eight);
    expect(overrideFormat.parent.precision).eq(FractionalPrecision.Two);
  });

  it("with unit overrides", () => {
    const schemaJson = createSchemaJson({
      type: "Fractional",
      precision: 2,
    });

    const schema = Schema.fromJsonSync(schemaJson, context);
    const format = schema.getItemSync<Format>("TestFormat");
    assert.isDefined(format);

    const unit = schema.lookupItemSync<Unit>("Formats.MILE");
    assert.isDefined(unit);

    const unitList = new Array<[Unit | InvertedUnit, string | undefined]>();
    unitList.push([unit!, undefined]);

    const overrideFormat = new OverrideFormat(format!, "TestFormatPrecisionOverride", undefined, unitList);
    assert.isDefined(overrideFormat.units);
    expect(overrideFormat.units!.length).eq(1);
    expect(overrideFormat.units![0][0]).eq(unit);
  });
});
