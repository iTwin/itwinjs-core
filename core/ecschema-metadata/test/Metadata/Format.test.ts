/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import * as sinon from "sinon";
import { TestSchemaLocater } from "../TestUtils/FormatTestHelper";
import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";

import { Schema, MutableSchema } from "./../../src/Metadata/Schema";
import { Format } from "./../../src/Metadata/Format";
import { ShowSignOption, FormatType, FormatTraits, DecimalPrecision } from "./../../src/utils/FormatEnums";
import { ECObjectsError } from "./../../src/Exception";
import { FormatProps } from "../../src/Deserialization/JsonProps";
import { JsonParser } from "../../src/Deserialization/JsonParser";
import { SchemaContext } from "../../src/Context";

type Mutable<T> = { -readonly [P in keyof T]: T[P] };

function createSchemaJson(koq: any) {
  return createSchemaJsonWithItems({
    TestFormat: {
      schemaItemType: "Format",
      ...koq,
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

describe("Format", () => {
  let schema: Schema;
  let testFormat: Format;
  describe("accept", () => {
    beforeEach(() => {
      schema = new Schema("TestSchema", 1, 0, 0);
      testFormat = new Format(schema, "TestFormat");
    });

    it("should call visitFormat on a SchemaItemVisitor object", async () => {
      expect(testFormat).to.exist;
      const mockVisitor = { visitFormat: sinon.spy() };
      await testFormat.accept(mockVisitor);
      expect(mockVisitor.visitFormat.calledOnce).to.be.true;
      expect(mockVisitor.visitFormat.calledWithExactly(testFormat)).to.be.true;
    });

    it("should safely handle a SchemaItemVisitor without visitFormat defined", async () => {
      expect(testFormat).to.exist;
      await testFormat.accept({});
    });
  });

  describe("type checking json", () => {
    let jsonParser: JsonParser; // This is an easy way to test the logic directly in the parser without having to go through deserialization every time.

    const rawSchema = {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
      name: "TestSchema",
      version: "1.2.3",
      items: {
        TestFormat: {
          schemaItemType: "Format",
        },
      },
    };

    function createFormatJson(extraStuff: any): any {
      return {
        schemaItemType: "Format",
        type: "Decimal",
        ...extraStuff,
      };
    }

    beforeEach(() => {
      jsonParser = new JsonParser(rawSchema);
      jsonParser.findItem("TestFormat"); // Hack for testing to force the Format name cache to populated within the Parser to allow for valid error messages.
    });

    it("check valid Format ECJSON", () => {
      const correctFormat = {
        type: "Decimal",
        precision: 5,
        roundFactor: 5,
        minWidth: 5,
        showSignOption: "",
        formatTraits: "",
        decimalSeparator: "",
        thousandSeparator: "",
        uomSeparator: "",
        scientificType: "",
        stationOffsetSize: 4,
        stationSeparator: "",
        composite: {
          spacer: "",
          includeZero: true,
          units: [
            {
              name: "",
              label: "",
            },
          ],
        },
      };

      const formatProps = jsonParser.parseFormat(correctFormat);
      assert.isDefined(formatProps);
    });

    it("missing type attribute", () => {
      const missingType = { schemaItemType: "Format" };
      assert.throws(() => jsonParser.parseFormat(missingType), ECObjectsError, `The Format TestSchema.TestFormat does not have the required 'type' attribute.`);
    });

    it("invalid type attribute", () => {
      const invalidType = { schemaItemType: "Format", type: true };
      assert.throws(() => jsonParser.parseFormat(invalidType), ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'type' attribute. It should be of type 'string'.`);
    });

    it("invalid precision attribute", () => {
      const invalidPrecision = { precision: "" };
      assert.throws(() => jsonParser.parseFormat(createFormatJson(invalidPrecision)), ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'precision' attribute. It should be of type 'number'.`);
    });

    it("invalid roundFactor attribute", () => {
      const invalidRoundFactor = { roundFactor: "" };
      assert.throws(() => jsonParser.parseFormat(createFormatJson(invalidRoundFactor)), ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'roundFactor' attribute. It should be of type 'number'.`);
    });

    it("invalid minWidth attribute", () => {
      const invalidMinWidth = { minWidth: "" };
      assert.throws(() => jsonParser.parseFormat(createFormatJson(invalidMinWidth)), ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'minWidth' attribute. It should be of type 'number'.`);
    });

    it("invalid showSignOption attribute", () => {
      const invalidShowSignOption = { showSignOption: true };
      assert.throws(() => jsonParser.parseFormat(createFormatJson(invalidShowSignOption)), ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'showSignOption' attribute. It should be of type 'string'.`);
    });

    it("invalid formatTraits attribute", () => {
      const invalidFormatTraits = { formatTraits: true };
      assert.throws(() => jsonParser.parseFormat(createFormatJson(invalidFormatTraits)), ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'formatTraits' attribute. It should be of type 'string' or 'string[]'.`);
    });

    it("invalid decimalSeparator attribute", () => {
      const invalidDecimalSeparator = { decimalSeparator: true };
      assert.throws(() => jsonParser.parseFormat(createFormatJson(invalidDecimalSeparator)), ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'decimalSeparator' attribute. It should be of type 'string'.`);
    });

    it("invalid thousandSeparator attribute", () => {
      const invalidThousandSeparator = { thousandSeparator: true };
      assert.throws(() => jsonParser.parseFormat(createFormatJson(invalidThousandSeparator)), ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'thousandSeparator' attribute. It should be of type 'string'.`);
    });

    it("invalid uomSeparator attribute", () => {
      const invalidUOMSeparator = { uomSeparator: true };
      assert.throws(() => jsonParser.parseFormat(createFormatJson(invalidUOMSeparator)), ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'uomSeparator' attribute. It should be of type 'string'.`);
    });

    it("invalid scientificType attribute", () => {
      const invalidScientificType = { scientificType: true };
      assert.throws(() => jsonParser.parseFormat(createFormatJson(invalidScientificType)), ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'scientificType' attribute. It should be of type 'string'.`);
    });

    it("invalid stationOffsetSize attribute", () => {
      const invalidStationOffsetSize = { stationOffsetSize: true };
      assert.throws(() => jsonParser.parseFormat(createFormatJson(invalidStationOffsetSize)), ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'stationOffsetSize' attribute. It should be of type 'number'.`);
    });

    it("invalid stationSeparator attribute", () => {
      const invalidStationSeparator = { stationSeparator: true };
      assert.throws(() => jsonParser.parseFormat(createFormatJson(invalidStationSeparator)), ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'stationSeparator' attribute. It should be of type 'string'.`);
    });

    it("invalid composite attribute", () => {
      const invalidComposite = { composite: true };
      assert.throws(() => jsonParser.parseFormat(createFormatJson(invalidComposite)), ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'composite' object.`);
    });

    const invalidCompositeSpacer = {
      composite: {
        spacer: true,
      },
    };
    it("invalid composite spacer attribute", () => {
      assert.throws(() => jsonParser.parseFormat(createFormatJson(invalidCompositeSpacer)), ECObjectsError, `The Format TestSchema.TestFormat has a Composite with an invalid 'spacer' attribute. It should be of type 'string'.`);
    });

    const invalidCompositeIncludeZero = {
      composite: {
        includeZero: "",
      },
    };
    it("invalid composite include zero attribute", () => {
      assert.throws(() => jsonParser.parseFormat(createFormatJson(invalidCompositeIncludeZero)), ECObjectsError, `The Format TestSchema.TestFormat has a Composite with an invalid 'includeZero' attribute. It should be of type 'boolean'.`);
    });

    const invalidCompositeUnits = {
      composite: {
        units: true,
      },
    };
    it("invalid composite units attribute", () => {
      assert.throws(() => jsonParser.parseFormat(createFormatJson(invalidCompositeUnits)), ECObjectsError, `The Format TestSchema.TestFormat has a Composite with an invalid 'units' attribute. It should be of type 'object[]'.`);
    });
  }); // type checking json

  describe("deserialize formatted ECJSON", () => {
    beforeEach(() => {
      schema = new Schema("TestSchema", 1, 0, 0);
      testFormat = (schema as MutableSchema).createFormatSync("TestFormat");
    });

    const validPropsWithoutUnits: FormatProps = {
      schemaItemType: "Format",
      label: "myfi4",
      description: "Some tests description",
      roundFactor: 15.0, // Non-default value
      type: "decimal",
      showSignOption: "noSign",
      formatTraits: "keepSingleZero|trailZeroes",
      precision: 12,
      decimalSeparator: "-",
      thousandSeparator: "!",
      uomSeparator: "$",
    };
    it("sync - valid decimal format", () => {
      testFormat.deserializeSync(validPropsWithoutUnits);
      expect(testFormat.label, "myfi4");
      expect(testFormat.description).eq("Some tests description");
      expect(testFormat.roundFactor).eq(15.0);
      expect(testFormat.type).eq(FormatType.Decimal);
      expect(testFormat.showSignOption).eq(ShowSignOption.NoSign);
      expect(testFormat.hasFormatTrait(FormatTraits.KeepSingleZero)).true;
      expect(testFormat.hasFormatTrait(FormatTraits.TrailZeroes)).true;
      expect(testFormat.hasFormatTrait(FormatTraits.ApplyRounding)).false;
      expect(testFormat.precision).eq(DecimalPrecision.Twelve);
      expect(testFormat.decimalSeparator).eq("-");
      expect(testFormat.thousandSeparator).eq("!");
      expect(testFormat.uomSeparator).eq("$");
    });
    it("async - valid decimal format", async () => {
      await testFormat.deserialize(validPropsWithoutUnits);
      expect(testFormat.label, "myfi4");
      expect(testFormat.description).eq("Some tests description");
      expect(testFormat.roundFactor).eq(15.0);
      expect(testFormat.type).eq(FormatType.Decimal);
      expect(testFormat.showSignOption).eq(ShowSignOption.NoSign);
      expect(testFormat.hasFormatTrait(FormatTraits.KeepSingleZero)).true;
      expect(testFormat.hasFormatTrait(FormatTraits.TrailZeroes)).true;
      expect(testFormat.hasFormatTrait(FormatTraits.ApplyRounding)).false;
      expect(testFormat.precision).eq(DecimalPrecision.Twelve);
      expect(testFormat.decimalSeparator).eq("-");
      expect(testFormat.thousandSeparator).eq("!");
      expect(testFormat.uomSeparator).eq("$");
    });

    const invalidTypeAttributeValue: FormatProps = {
      schemaItemType: "Format",
      type: "BadType",
    };
    it("sync - invalid type attribute value", () => {
      assert.throws(() => testFormat.deserializeSync(invalidTypeAttributeValue), ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'type' attribute.`);
    });
    it("async - invalid type attribute value", async () => {
      await expect(testFormat.deserialize(invalidTypeAttributeValue)).to.be.rejectedWith(ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'type' attribute.`);
    });

    const invalidPrecisionDecimal: FormatProps = {
      schemaItemType: "Format",
      type: "decimal",
      precision: 13,
    };
    const invalidPrecisionScientific: FormatProps = {
      schemaItemType: "Format",
      type: "scientific",
      scientificType: "normalized",
      precision: 30,
    };
    const invalidPrecisionStation: FormatProps = {
      schemaItemType: "Format",
      type: "station",
      stationOffsetSize: 3,
      precision: -1,
    };
    it("sync - precision value is invalid with different format types", () => {
      assert.throws(() => testFormat.deserializeSync(invalidPrecisionDecimal), ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'precision' attribute.`);
      assert.throws(() => testFormat.deserializeSync(invalidPrecisionScientific), ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'precision' attribute.`);
      assert.throws(() => testFormat.deserializeSync(invalidPrecisionStation), ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'precision' attribute.`);
    });
    it("async - precision value is invalid with different format types", async () => {
      await expect(testFormat.deserialize(invalidPrecisionDecimal)).to.be.rejectedWith(ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'precision' attribute.`);
      await expect(testFormat.deserialize(invalidPrecisionScientific)).to.be.rejectedWith(ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'precision' attribute.`);
      await expect(testFormat.deserialize(invalidPrecisionStation)).to.be.rejectedWith(ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'precision' attribute.`);
    });

    const validPrecisionDecimal: FormatProps = {
      schemaItemType: "Format",
      type: "decimal",
      precision: 3,
    };
    const validPrecisionScientific: FormatProps = {
      schemaItemType: "Format",
      type: "scientific",
      scientificType: "normalized",
      precision: 0,
    };
    const validPrecisionStation: FormatProps = {
      schemaItemType: "Format",
      type: "station",
      stationOffsetSize: 3,
      precision: 12,
    };
    it("sync - precision value is valid with different format types", () => {
      testFormat.deserializeSync(validPrecisionDecimal);
      assert(testFormat.precision === 3);

      testFormat = (schema as MutableSchema).createFormatSync("TestFormatA");
      testFormat.deserializeSync(validPrecisionScientific);
      assert(testFormat.precision === 0);

      testFormat = (schema as MutableSchema).createFormatSync("TestFormatB");
      testFormat.deserializeSync(validPrecisionStation);
      assert(testFormat.precision === 12);
    });

    it("async - precision value is valid with different format types", async () => {
      await testFormat.deserialize(validPrecisionDecimal);
      assert(testFormat.precision === 3);

      testFormat = (schema as MutableSchema).createFormatSync("TestFormatA");
      await testFormat.deserialize(validPrecisionScientific);
      assert(testFormat.precision === 0);

      testFormat = (schema as MutableSchema).createFormatSync("TestFormatB");
      await testFormat.deserialize(validPrecisionStation);
      assert(testFormat.precision === 12);
    });

    const invalidMinWidth: Mutable<FormatProps> = {
      schemaItemType: "Format",
      type: "Decimal",
      minWidth: 5.5,
    };
    it("sync - minWidth value is invalid", () => {
      assert.throws(() => testFormat.deserializeSync(invalidMinWidth), ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'minWidth' attribute. It should be a positive integer.`);

      invalidMinWidth.minWidth = -1;
      assert.throws(() => testFormat.deserializeSync(invalidMinWidth), ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'minWidth' attribute. It should be a positive integer.`);
    });
    it("async - minWidth value is invalid", async () => {
      invalidMinWidth.minWidth = 5.5; // TODO fix this
      await expect(testFormat.deserialize(invalidMinWidth)).to.be.rejectedWith(ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'minWidth' attribute. It should be a positive integer.`);

      invalidMinWidth.minWidth = -1;
      await expect(testFormat.deserialize(invalidMinWidth)).to.be.rejectedWith(ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'minWidth' attribute. It should be a positive integer.`);
    });

    const missingScientificType: FormatProps = {
      schemaItemType: "Format",
      type: "Scientific",
    };
    it("sync - scientific type is required when type is scientific", () => {
      assert.throws(() => testFormat.deserializeSync(missingScientificType), ECObjectsError, `The Format TestSchema.TestFormat is 'Scientific' type therefore the attribute 'scientificType' is required.`);
    });
    it("async - scientific type is required when type is scientific", async () => {
      await expect(testFormat.deserialize(missingScientificType)).to.be.rejectedWith(ECObjectsError, `The Format TestSchema.TestFormat is 'Scientific' type therefore the attribute 'scientificType' is required.`);
    });

    const invalidScientificType: FormatProps = {
      schemaItemType: "Format",
      type: "Scientific",
      scientificType: "badType",
    };
    it("sync - scientific type is not supported", () => {
      assert.throws(() => testFormat.deserializeSync(invalidScientificType), ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'scientificType' attribute.`);
    });
    it("async - scientific type is not supported", async () => {
      await expect(testFormat.deserialize(invalidScientificType)).to.be.rejectedWith(ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'scientificType' attribute.`);
    });

    const missingStationOffsetSize: FormatProps = {
      schemaItemType: "Format",
      type: "station",
    };
    it("sync - stationOffsetSize is required when type is station", () => {
      assert.throws(() => testFormat.deserializeSync(missingStationOffsetSize), ECObjectsError, `The Format TestSchema.TestFormat is 'Station' type therefore the attribute 'stationOffsetSize' is required.`);
    });
    it("async - stationOffsetSize is required when type is station", async () => {
      await expect(testFormat.deserialize(missingStationOffsetSize)).to.be.rejectedWith(ECObjectsError, `The Format TestSchema.TestFormat is 'Station' type therefore the attribute 'stationOffsetSize' is required.`);
    });

    const invalidStationOffsetSize: FormatProps = {
      schemaItemType: "Format",
      type: "station",
      stationOffsetSize: -1,
    };
    it("sync - stationOffsetSize is invalid value", () => {
      assert.throws(() => testFormat.deserializeSync(invalidStationOffsetSize), ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'stationOffsetSize' attribute. It should be a positive integer.`);
    });
    it("async - stationOffsetSize is invalid value", async () => {
      await expect(testFormat.deserialize(invalidStationOffsetSize)).to.be.rejectedWith(ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'stationOffsetSize' attribute. It should be a positive integer.`);
    });

    const invalidShowSignOption: FormatProps = {
      schemaItemType: "Format",
      type: "decimal",
      showSignOption: "noSigned",
    };
    it("sync - scientific type is not supported", () => {
      assert.throws(() => testFormat.deserializeSync(invalidShowSignOption), ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'showSignOption' attribute.`);
    });
    it("async - scientific type is not supported", async () => {
      await expect(testFormat.deserialize(invalidShowSignOption)).to.be.rejectedWith(ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'showSignOption' attribute.`);
    });

    const invalidDecimalSeparator: FormatProps = {
      schemaItemType: "Format",
      type: "decimal",
      decimalSeparator: "badSeparator",
    };
    it("sync - decimal separator cannot be larger than 1 character", () => {
      assert.throws(() => testFormat.deserializeSync(invalidDecimalSeparator), ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'decimalSeparator' attribute.`);
    });
    it("async - decimal separator cannot be larger than 1 character", async () => {
      await expect(testFormat.deserialize(invalidDecimalSeparator)).to.be.rejectedWith(ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'decimalSeparator' attribute.`);
    });

    const invalidThousandSeparator: FormatProps = {
      schemaItemType: "Format",
      type: "decimal",
      thousandSeparator: "badSeparator",
    };
    it("sync - thousand separator cannot be larger than 1 character", () => {
      assert.throws(() => testFormat.deserializeSync(invalidThousandSeparator), ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'thousandSeparator' attribute.`);
    });
    it("async - thousand separator cannot be larger than 1 character", async () => {
      await expect(testFormat.deserialize(invalidThousandSeparator)).to.be.rejectedWith(ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'thousandSeparator' attribute.`);
    });

    const invalidUOMSeparator: FormatProps = {
      schemaItemType: "Format",
      type: "decimal",
      uomSeparator: "badSeparator",
    };
    it("sync - UOM separator cannot be larger than 1 character", () => {
      assert.throws(() => testFormat.deserializeSync(invalidUOMSeparator), ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'uomSeparator' attribute.`);
    });
    it("async - UOM separator cannot be larger than 1 character", async () => {
      await expect(testFormat.deserialize(invalidUOMSeparator)).to.be.rejectedWith(ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'uomSeparator' attribute.`);
    });

    const invalidStationSeparator: FormatProps = {
      schemaItemType: "Format",
      type: "decimal",
      stationSeparator: "badSeparator",
    };
    it("sync - station separator cannot be larger than 1 character", () => {
      assert.throws(() => testFormat.deserializeSync(invalidStationSeparator), ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'stationSeparator' attribute.`);
    });
    it("async - station separator cannot be larger than 1 character", async () => {
      await expect(testFormat.deserialize(invalidStationSeparator)).to.be.rejectedWith(ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'stationSeparator' attribute.`);
    });

    describe("format traits", () => {
      const validEmptyFormatTraitSring: FormatProps = {
        schemaItemType: "Format",
        type: "decimal",
        formatTraits: "",
      };
      it("sync - ", () => {
        testFormat.deserializeSync(validEmptyFormatTraitSring);
        assert.isTrue(testFormat.hasFormatTrait(0x0));
      });
      it("async - ", async () => {
        await testFormat.deserialize(validEmptyFormatTraitSring);
        assert.isTrue(testFormat.hasFormatTrait(0x0));
      });

      const validFormatTraitString: FormatProps = {
        schemaItemType: "Format",
        type: "decimal",
        formatTraits: "trailZeroes|keepSingleZero|zeroEmpty|keepDecimalPoint|applyRounding|fractionDash|showUnitLabel|prependUnitLabel|use1000Separator|exponentOnlyNegative",
      };
      it("sync - all valid options defined in a string", () => {
        testFormat.deserializeSync(validFormatTraitString);
        expect(testFormat.hasFormatTrait(FormatTraits.TrailZeroes)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.KeepSingleZero)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.ZeroEmpty)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.KeepDecimalPoint)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.ApplyRounding)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.FractionDash)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.ShowUnitLabel)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.PrependUnitLabel)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.Use1000Separator)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.ExponentOnlyNegative)).true;
      });
      it("async - all valid options defined in a string", async () => {
        await testFormat.deserialize(validFormatTraitString);
        expect(testFormat.hasFormatTrait(FormatTraits.TrailZeroes)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.KeepSingleZero)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.ZeroEmpty)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.KeepDecimalPoint)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.ApplyRounding)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.FractionDash)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.ShowUnitLabel)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.PrependUnitLabel)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.Use1000Separator)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.ExponentOnlyNegative)).true;
      });

      // TODO: Consolidate this and above test to reduce code...
      const validFormatTraitArray: FormatProps = {
        schemaItemType: "Format",
        type: "decimal",
        formatTraits: [
          "trailZeroes",
          "keepSingleZero",
          "zeroEmpty",
          "keepDecimalPoint",
          "applyRounding",
          "fractionDash",
          "showUnitLabel",
          "prependUnitLabel",
          "use1000Separator",
          "exponentOnlyNegative",
        ],
      };
      it("sync - all valid options defined in a array", () => {
        testFormat.deserializeSync(validFormatTraitArray);
        expect(testFormat.hasFormatTrait(FormatTraits.TrailZeroes)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.KeepSingleZero)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.ZeroEmpty)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.KeepDecimalPoint)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.ApplyRounding)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.FractionDash)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.ShowUnitLabel)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.PrependUnitLabel)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.Use1000Separator)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.ExponentOnlyNegative)).true;
      });
      it("async - all valid options defined in a array", async () => {
        await testFormat.deserialize(validFormatTraitArray);
        expect(testFormat.hasFormatTrait(FormatTraits.TrailZeroes)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.KeepSingleZero)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.ZeroEmpty)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.KeepDecimalPoint)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.ApplyRounding)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.FractionDash)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.ShowUnitLabel)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.PrependUnitLabel)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.Use1000Separator)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.ExponentOnlyNegative)).true;
      });

      const validFormatTraitSeparator: FormatProps = {
        schemaItemType: "Format",
        type: "decimal",
        formatTraits: "trailZeroes;keepSingleZero|zeroEmpty,applyRounding",
      };
      it("sync - valid multiple separators", () => {
        testFormat.deserializeSync(validFormatTraitSeparator);
        expect(testFormat.hasFormatTrait(FormatTraits.TrailZeroes)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.KeepSingleZero)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.ZeroEmpty)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.ApplyRounding)).true;
      });
      it("async - valid multiple separators", async () => {
        await testFormat.deserialize(validFormatTraitSeparator);
        expect(testFormat.hasFormatTrait(FormatTraits.TrailZeroes)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.KeepSingleZero)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.ZeroEmpty)).true;
        expect(testFormat.hasFormatTrait(FormatTraits.ApplyRounding)).true;
      });

      const invalidSeparator: FormatProps = {
        schemaItemType: "Format",
        type: "decimal",
        formatTraits: "applyRounding\fractionDash;showUnitLabel",
      };
      it("sync - invalid format trait separator", () => {
        assert.throws(() => testFormat.deserializeSync(invalidSeparator), ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'formatTraits' attribute. The string 'applyRounding\fractionDash' is not a valid format trait.`);
      });
      it("async - invalid format trait separator", async () => {
        await expect(testFormat.deserialize(invalidSeparator)).to.be.rejectedWith(ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'formatTraits' attribute. The string 'applyRounding\fractionDash' is not a valid format trait.`);
      });

      const invalidFormatTraitInString: FormatProps = {
        schemaItemType: "Format",
        type: "decimal",
        formatTraits: "badTraits",
      };
      it("sync - invalid format trait within a string", () => {
        assert.throws(() => testFormat.deserializeSync(invalidFormatTraitInString), ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'formatTraits' attribute. The string 'badTraits' is not a valid format trait.`);
      });
      it("async - invalid format trait within a string", async () => {
        await expect(testFormat.deserialize(invalidFormatTraitInString)).to.be.rejectedWith(ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'formatTraits' attribute. The string 'badTraits' is not a valid format trait.`);
      });

      const invalidFormatTraitInArray: FormatProps = {
        schemaItemType: "Format",
        type: "decimal",
        formatTraits: [
          "badTraits",
        ],
      };
      it("sync - invalid format trait within a array", () => {
        assert.throws(() => testFormat.deserializeSync(invalidFormatTraitInArray), ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'formatTraits' attribute. The string 'badTraits' is not a valid format trait.`);
      });
      it("async - invalid format trait within a array", async () => {
        await expect(testFormat.deserialize(invalidFormatTraitInArray)).to.be.rejectedWith(ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'formatTraits' attribute. The string 'badTraits' is not a valid format trait.`);
      });
    }); // formatTraits

    describe("composite", () => {
      let context: SchemaContext;
      beforeEach(() => {
        context = new SchemaContext();
        context.addLocater(new TestSchemaLocater());
      });

      const invalidSpacer = {
        type: "fractional",
        composite: {
          includeZero: false,
          spacer: "spacer",
          units: [
            { name: "Formats.MILE" },
          ],
        },
      };
      it("sync - spacer must be a one character string", () => {
        assert.throws(() => Schema.fromJsonSync(createSchemaJson(invalidSpacer), context), ECObjectsError, `The Format TestSchema.TestFormat has a composite with an invalid 'spacer' attribute. It should be an empty or one character string.`);
      });
      it("async - spacer must be a one character string", async () => {
        assert.throws(() => Schema.fromJsonSync(createSchemaJson(invalidSpacer), context), ECObjectsError, `The Format TestSchema.TestFormat has a composite with an invalid 'spacer' attribute. It should be an empty or one character string.`);
      });

      const invalidCompositeWithoutUnits = {
        type: "fractional",
        composite: {},
      };
      it("sync - invalid composite without units", () => {
        assert.throws(() => Schema.fromJsonSync(createSchemaJson(invalidCompositeWithoutUnits), context), ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'Composite' attribute. It should have 1-4 units.`);
      });
      it("async - invalid composite without units", async () => {
        await expect(Schema.fromJson(createSchemaJson(invalidCompositeWithoutUnits), context)).to.be.rejectedWith(ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'Composite' attribute. It should have 1-4 units.`);
      });

      const invalidCompositeEmptyUnits = {
        type: "fractional",
        composite: {
          units: [],
        },
      };
      it("sync - invalid composite without units", () => {
        assert.throws(() => Schema.fromJsonSync(createSchemaJson(invalidCompositeEmptyUnits), context), ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'Composite' attribute. It should have 1-4 units.`);
      });
      it("async - invalid composite without units", async () => {
        await expect(Schema.fromJson(createSchemaJson(invalidCompositeEmptyUnits), context)).to.be.rejectedWith(ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'Composite' attribute. It should have 1-4 units.`);
      });

      const invalidCompositeTooManyUnits = {
        type: "fractional",
        composite: {
          units: [
            { name: "Formats.MILE" },
            { name: "Formats.YRD" },
            { name: "Formats.FT" },
            { name: "Formats.IN" },
            { name: "Formats.MILLIINCH" },
          ],
        },
      };
      it("sync - invalid composite with too many units", () => {
        assert.throws(() => Schema.fromJsonSync(createSchemaJson(invalidCompositeTooManyUnits), context), ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'Composite' attribute. It should have 1-4 units.`);
      });
      it("async - invalid composite with too many units", async () => {
        await expect(Schema.fromJson(createSchemaJson(invalidCompositeTooManyUnits), context)).to.be.rejectedWith(ECObjectsError, `The Format TestSchema.TestFormat has an invalid 'Composite' attribute. It should have 1-4 units.`);
      });

      const invalidCompositeDuplicateUnits = {
        type: "fractional",
        composite: {
          units: [
            { name: "Formats.MILE" },
            { name: "Formats.MILE" },
          ],
        },
      };
      it("sync - invalid composite with duplicate units", () => {
        assert.throws(() => Schema.fromJsonSync(createSchemaJson(invalidCompositeDuplicateUnits), context), ECObjectsError, `The Format TestSchema.TestFormat has duplicate units, 'Formats.MILE'.`);
      });
      it("async - invalid composite with duplicate units", async () => {
        await expect(Schema.fromJson(createSchemaJson(invalidCompositeDuplicateUnits), context)).to.be.rejectedWith(ECObjectsError, `The Format TestSchema.TestFormat has duplicate units, 'Formats.MILE'.`);
      });

      const validComposite = {
        type: "decimal",
        composite: {
          includeZero: false,
          spacer: "-",
          units: [
            {
              name: "Formats.MILE",
              label: "mile(s)",
            },
            {
              name: "Formats.YRD",
              label: "yrd(s)",
            },
            {
              name: "Formats.FT",
              label: "'",
            },
            {
              name: "Formats.IN",
              label: "\"",
            },
          ],
        },
      };
      function validateTestFormat(testFormat: Format | undefined) {
        assert.isDefined(testFormat);

        expect(testFormat!.includeZero).false;
        expect(testFormat!.spacer).eq("-");

        assert.isDefined(testFormat!.units);
        expect(testFormat!.units!.length).eq(4);
        expect(testFormat!.units![0][0].fullName).eq("Formats.MILE");
        expect(testFormat!.units![0][1]).eq("mile(s)");

        expect(testFormat!.units![1][0].fullName).eq("Formats.YRD");
        expect(testFormat!.units![1][1]).eq("yrd(s)");

        expect(testFormat!.units![2][0].fullName).eq("Formats.FT");
        expect(testFormat!.units![2][1]).eq("'");

        expect(testFormat!.units![3][0].fullName).eq("Formats.IN");
        expect(testFormat!.units![3][1]).eq("\"");
      }
      it("sync - ", () => {
        const schema = Schema.fromJsonSync(createSchemaJson(validComposite), context);
        assert.isDefined(schema);
        const testFormat = schema.getItemSync<Format>("TestFormat");
        validateTestFormat(testFormat);
      });
      it("async - ", async () => {
        const schema = await Schema.fromJson(createSchemaJson(validComposite), context);
        assert.isDefined(schema);
        const testFormat = await schema.getItem<Format>("TestFormat");
        validateTestFormat(testFormat);
      });
    }); // composite

  }); // deserialize properly formatted ECJSON

  describe("toJson", () => {
    let context: SchemaContext;
    beforeEach(() => {
      context = new SchemaContext();
      context.addLocater(new TestSchemaLocater());
    });

    it("Basic test I", () => {
      const testFormatJson = {
        schemaItemType: "Format",
        type: "Fractional",
        precision: 4,
        composite: {
          includeZero: false,
          spacer: "-",
          units: [
            {
              name: "Formats.MILE",
              label: "mile(s)",
            },
          ],
        },
      };
      const ecSchema = Schema.fromJsonSync(createSchemaJson(testFormatJson), context);
      assert.isDefined(ecSchema);
      const testFormat = ecSchema.getItemSync<Format>("TestFormat");
      assert.isDefined(testFormat);
      const formatSerialization = testFormat!.toJson(false, true);
      expect(formatSerialization).to.deep.equal(testFormatJson);
    });
  }); // toJson
});
