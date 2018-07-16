/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";

import Schema from "../../source/Metadata/Schema";
import Format from "../../source/Metadata/Format";
import { ShowSignOption, FormatType, FormatTraits, FractionalPrecision } from "../../source/utils/FormatEnums";
import { ECObjectsError } from "../../source/Exception";
import * as sinon from "sinon";
import Unit from "../../source/Metadata/Unit";
import { schemaItemTypeToString, SchemaItemType } from "../../source/ECObjects";

describe("Format tests", () => {
  let testFormat: Format;
  describe("accept", () => {
    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
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

  describe("SchemaItemType", () => {
    const schema = new Schema("TestSchema", 1, 0, 0);
    testFormat = new Format(schema, "Test");
    it("should return correct item type and string", () => {
      assert.equal(testFormat.schemaItemType, SchemaItemType.Format);
      assert.equal(schemaItemTypeToString(testFormat.schemaItemType), "Format");
    });
  });

  describe("Async Tests without Composite", () => {
    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testFormat = new Format(schema, "AmerMYFI4");
    });
    describe("fromJson", () => {
      it("Basic test", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await testFormat.fromJson(json);
        assert(testFormat.name, "AmerMYFI4");
        assert(testFormat.label, "myfi4");
        assert(testFormat.description === "");
        assert(testFormat.roundFactor === 0.0);
        assert(testFormat.type === FormatType.Fractional);
        assert(testFormat.showSignOption === ShowSignOption.OnlyNegative);
        assert(testFormat.hasFormatTrait(FormatTraits.KeepSingleZero));
        assert(testFormat.hasFormatTrait(FormatTraits.TrailZeroes));
        assert(testFormat.hasFormatTrait(FormatTraits.ApplyRounding) === false);
        assert(testFormat.precision === FractionalPrecision.Four);
        assert(testFormat.decimalSeparator, ".");
        assert(testFormat.thousandSeparator, ",");
        assert(testFormat.uomSeparator, " ");
        assert(testFormat.stationSeparator, "+");
      });
      it("Name must be a valid ECName", async () => {
        const json = {
          schemaItemType: "Format",
          name: "10AmerMYFI4",
          label: "myfi4",
          description: "",
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, ``);
      });
      it("Description must be a string", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: 12345678,
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The SchemaItem AmerMYFI4 has an invalid 'description' attribute. It should be of type 'string'.`);
      });
      it("Round factor is not default value", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          roundFactor: 20,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await testFormat.fromJson(json);
        assert(testFormat.roundFactor ===  20);
      });
      it("Type is required", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 does not have the required 'type' attribute.`);
      });
      it("Type value is invalid", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "fraction",
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'type' attribute.`);
      });
      it("Type is fractional; Precision value is invalid", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "fractional",
          description: "",
          showSignOption: "onlyNegative",
          precision: 3,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'precision' attribute.`);
      });
      it("Type is fractional; Precision value is valid", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "fractional",
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 16,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await testFormat.fromJson(json);
        assert(testFormat.precision === 16);
      });
      it("Type is decimal, scientific, or station; Precision value is invalid", async () => {
        const jsonDecimal = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "decimal",
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 13,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        const jsonScientific = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "scientific",
          scientificType: "normalized",
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 30,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        const jsonStation = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "station",
          stationOffsetSize: 3,
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: -1,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(jsonDecimal)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'precision' attribute.`);
        await expect(testFormat.fromJson(jsonScientific)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'precision' attribute.`);
        await expect(testFormat.fromJson(jsonStation)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'precision' attribute.`);
      });
      it("Type is decimal, scientific, or station; Precision value is valid", async () => {
        const jsonDecimal = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "decimal",
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 3,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        const jsonScientific = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "scientific",
          scientificType: "normalized",
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 0,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        const jsonStation = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "station",
          stationOffsetSize: 3,
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 12,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await testFormat.fromJson(jsonDecimal);
        assert(testFormat.precision === 3);
        await testFormat.fromJson(jsonScientific);
        assert(testFormat.precision === 0);
        await testFormat.fromJson(jsonStation);
        assert(testFormat.precision === 12);
      });
      it("MinWidth is not an int", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          minWidth: 3.3,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'minWidth' attribute.`);
      });
      it("MinWidth is not positive", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          minWidth: -3,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'minWidth' attribute.`);
      });
      it("Type is scientific; ScientificType is required", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "scientific",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has type 'Scientific' therefore attribute 'scientificType' is required.`);
      });
      it("ScientificType value is not valid", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "scientific",
          showSignOption: "onlyNegative",
          scientificType: "normal",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'scientificType' attribute.`);
      });
      it("Type is not scientific; ScientificType is provided and should be ignored", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "decimal",
          scientificType: "normalized",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await testFormat.fromJson(json);
        assert(testFormat.scientificType === undefined);
      });
      it("showSignOption must be a string", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "decimal",
          showSignOption: 456,
          scientificType: "normalized",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'showSignOption' attribute. It should be of type 'string'.`);
      });
      it("showSignOption is not default value", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "decimal",
          showSignOption: "noSign",
          scientificType: "normalized",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await testFormat.fromJson(json);
        assert(testFormat.showSignOption === ShowSignOption.NoSign);
      });
      it("showSignOption is invalid", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "decimal",
          showSignOption: "noSigned",
          scientificType: "normalized",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'showSignOption' attribute.`);
      });
      it("UOMSeparator is not default", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: "-",
        };
        await testFormat.fromJson(json);
        assert(testFormat.uomSeparator, "-");
      });
      it("StationSeparator is not default", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          stationSeparator: "-",
        };
        await testFormat.fromJson(json);
        assert(testFormat.stationSeparator, "-");
      });
      it("StationOffsetSize is not an int", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          stationOffsetSize: 3.3,
          type: "station",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'stationOffsetSize' attribute. It should be a positive integer.`);
      });
      it("StationOffsetSize is not positive", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          stationOffsetSize: -3,
          type: "station",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'stationOffsetSize' attribute. It should be a positive integer.`);
      });
      it("Type is station; StationOffsetSize is required", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "station",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has type 'Station' therefore attribute 'stationOffsetSize' is required.`);
      });
      it("Type is not station; StationOffsetSize is ignored", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          stationOffsetSize: 3,
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await testFormat.fromJson(json);
        assert(testFormat.stationOffsetSize === undefined);
      });
      it("decimalSeparator, thousandSeparator, uomSeparator, stationSeparator cannot be more than one character", async () => {
        const jsonDecimalSeparator = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "decimal",
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 3,
          decimalSeparator: "..",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        const jsonThousandSeparator = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "scientific",
          scientificType: "normalized",
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 0,
          decimalSeparator: ".",
          thousandSeparator: ",.",
          uomSeparator: " ",
        };
        const jsonUOMSeparator = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "station",
          stationOffsetSize: 3,
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 12,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: "  ",
        };
        const jsonStationSeparator = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "station",
          stationOffsetSize: 3,
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 12,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
          stationSeparator: "++",
        };
        await expect(testFormat.fromJson(jsonDecimalSeparator)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'decimalSeparator' attribute.`);
        await expect(testFormat.fromJson(jsonThousandSeparator)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'thousandSeparator' attribute.`);
        await expect(testFormat.fromJson(jsonUOMSeparator)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'uomSeparator' attribute.`);
        await expect(testFormat.fromJson(jsonStationSeparator)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'stationSeparator' attribute.`);
      });
    });
    describe("fromJson FormatTraits Tests", () => {
      it("String with valid options", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "trailZeroes|keepSingleZero|zeroEmpty|keepDecimalPoint|applyRounding|fractionDash|showUnitLabel|prependUnitLabel|use1000Separator|exponentOnlyNegative",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await testFormat.fromJson(json);
        assert((testFormat!.formatTraits & 0x3FF) === testFormat!.formatTraits);
      });
      it("Valid options with multiple separators", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "trailZeroes;keepSingleZero|zeroEmpty|keepDecimalPoint,applyRounding|fractionDash;showUnitLabel,prependUnitLabel;use1000Separator,exponentOnlyNegative",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await testFormat.fromJson(json);
        assert((testFormat!.formatTraits & 0x3FF) === testFormat!.formatTraits);
      });
      it("Valid options with invalid separator", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "trailZeroes;keepSingleZero|zeroEmpty|keepDecimalPoint,applyRounding\fractionDash;showUnitLabel,prependUnitLabel;use1000Separator,exponentOnlyNegative",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `Format has an invalid 'formatTraits' option.`);
      });
      it("String with invalid option", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "trailZero|keepSingleZero|zeroEmpty",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `Format has an invalid 'formatTraits' option.`);
      });
      it("Empty string should make formatTraits undefined", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await testFormat.fromJson(json);
        assert(testFormat.formatTraits ===  0);
      });
      it("String[] with valid options", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
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
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await testFormat.fromJson(json);
        assert((testFormat!.formatTraits & 0x3FF) === testFormat!.formatTraits);
      });
      it("String[] with one valid option", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: [
            "trailZeroes",
          ],
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await testFormat.fromJson(json);
        assert(testFormat.hasFormatTrait(FormatTraits.KeepSingleZero) === false);
        assert(testFormat.hasFormatTrait(FormatTraits.TrailZeroes));
        assert(testFormat.hasFormatTrait(FormatTraits.ApplyRounding) === false);
      });
      it("String[] with invalid option", async () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: [
            "trailZero",
          ],
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `Format has an invalid 'formatTraits' option.`);
      });
    });
  });
  describe("Sync Tests without Composite", () => {
    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testFormat = new Format(schema, "AmerMYFI4");
    });
    describe("fromJson", () => {
      it("Basic test", () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        testFormat.fromJsonSync(json);
        assert(testFormat.name, "AmerMYFI4");
        assert(testFormat.label, "myfi4");
        assert(testFormat.description === "");
        assert(testFormat.roundFactor === 0.0);
        assert(testFormat.type === FormatType.Fractional);
        assert(testFormat.showSignOption === ShowSignOption.OnlyNegative);
        assert(testFormat.hasFormatTrait(FormatTraits.KeepSingleZero));
        assert(testFormat.hasFormatTrait(FormatTraits.TrailZeroes));
        assert(testFormat.hasFormatTrait(FormatTraits.ApplyRounding) === false);
        assert(testFormat.precision === FractionalPrecision.Four);
        assert(testFormat.decimalSeparator, ".");
        assert(testFormat.thousandSeparator, ",");
        assert(testFormat.uomSeparator, " ");
        assert(testFormat.stationSeparator, "+");
      });
      it("Name must be a valid ECName", () => {
        const json = {
          schemaItemType: "Format",
          name: "10AmerMYFI4",
          label: "myfi4",
          description: "",
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        assert.throws(() => testFormat.fromJsonSync(json), ECObjectsError, "");
      });
      it("Description must be a string", () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: 12345678,
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        assert.throws(() => testFormat.fromJsonSync(json), ECObjectsError, `The SchemaItem AmerMYFI4 has an invalid 'description' attribute. It should be of type 'string'.`);
      });
      it("Round factor is not default value", () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          roundFactor: 20,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        testFormat.fromJsonSync(json);
        assert(testFormat.roundFactor ===  20);
      });
      it("Type is required", () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        assert.throws(() => testFormat.fromJsonSync(json), ECObjectsError, `The Format AmerMYFI4 does not have the required 'type' attribute.`);
      });
      it("Type value is invalid", () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "fraction",
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        assert.throws(() => testFormat.fromJsonSync(json), ECObjectsError, `The Format AmerMYFI4 has an invalid 'type' attribute.`);
      });
      it("Type is fractional; Precision value is invalid", () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "fractional",
          description: "",
          showSignOption: "onlyNegative",
          precision: 3,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        assert.throws(() => testFormat.fromJsonSync(json), ECObjectsError, `The Format AmerMYFI4 has an invalid 'precision' attribute.`);
      });
      it("Type is fractional; Precision value is valid", () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "fractional",
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 16,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        testFormat.fromJsonSync(json);
        assert(testFormat.precision === 16);
      });
      it("Type is decimal, scientific, or station; Precision value is invalid", () => {
        const jsonDecimal = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "decimal",
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 13,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        const jsonScientific = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "scientific",
          scientificType: "normalized",
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 30,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        const jsonStation = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "station",
          stationOffsetSize: 3,
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: -1,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        assert.throws(() => testFormat.fromJsonSync(jsonDecimal), ECObjectsError, `The Format AmerMYFI4 has an invalid 'precision' attribute.`);
        assert.throws(() => testFormat.fromJsonSync(jsonScientific), ECObjectsError, `The Format AmerMYFI4 has an invalid 'precision' attribute.`);
        assert.throws(() => testFormat.fromJsonSync(jsonStation), ECObjectsError, `The Format AmerMYFI4 has an invalid 'precision' attribute.`);
      });
      it("Type is decimal, scientific, or station; Precision value is valid", () => {
        const jsonDecimal = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "decimal",
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 3,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        const jsonScientific = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "scientific",
          scientificType: "normalized",
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 0,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        const jsonStation = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "station",
          stationOffsetSize: 3,
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 12,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };

        testFormat.fromJsonSync(jsonDecimal);
        assert(testFormat.precision === 3);
        testFormat.fromJsonSync(jsonScientific);
        assert(testFormat.precision === 0);
        testFormat.fromJsonSync(jsonStation);
        assert(testFormat.precision === 12);
      });
      it("MinWidth is not an int", () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          minWidth: 3.3,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        assert.throws(() => testFormat.fromJsonSync(json), ECObjectsError, `The Format AmerMYFI4 has an invalid 'minWidth' attribute.`);
      });
      it("MinWidth is not positive", () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          minWidth: -3,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        assert.throws(() => testFormat.fromJsonSync(json), ECObjectsError, `The Format AmerMYFI4 has an invalid 'minWidth' attribute.`);
      });
      it("Type is scientific; ScientificType is required", () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "scientific",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        assert.throws(() => testFormat.fromJsonSync(json), ECObjectsError, `The Format AmerMYFI4 has type 'Scientific' therefore attribute 'scientificType' is required.`);
      });
      it("ScientificType value is not valid", () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "scientific",
          showSignOption: "onlyNegative",
          scientificType: "normal",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        assert.throws(() => testFormat.fromJsonSync(json), ECObjectsError, `The Format AmerMYFI4 has an invalid 'scientificType' attribute.`);
      });
      it("Type is not scientific; ScientificType is provided and should be ignored", () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "decimal",
          scientificType: "normalized",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        testFormat.fromJsonSync(json);
        assert(testFormat.scientificType === undefined);
      });
      it("showSignOption must be a string", () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "decimal",
          showSignOption: 456,
          scientificType: "normalized",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        assert.throws(() => testFormat.fromJsonSync(json), ECObjectsError, `The Format AmerMYFI4 has an invalid 'showSignOption' attribute. It should be of type 'string'.`);
      });
      it("showSignOption is not default value", () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "decimal",
          showSignOption: "noSign",
          scientificType: "normalized",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        testFormat.fromJsonSync(json);
        assert(testFormat.showSignOption === ShowSignOption.NoSign);
      });
      it("showSignOption is invalid", () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "decimal",
          showSignOption: "noSigned",
          scientificType: "normalized",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
        };
        assert.throws(() => testFormat.fromJsonSync(json), ECObjectsError, `The Format AmerMYFI4 has an invalid 'showSignOption' attribute.`);
      });
      it("UOMSeparator is not default", () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: "-",
        };
        testFormat.fromJsonSync(json);
        assert(testFormat.uomSeparator, "-");
      });
      it("StationSeparator is not default", () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          stationSeparator: "-",
        };
        testFormat.fromJsonSync(json);
        assert(testFormat.stationSeparator, "-");
      });
      it("StationOffsetSize is not an int", () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          stationOffsetSize: 3.3,
          type: "station",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        assert.throws(() => testFormat.fromJsonSync(json), ECObjectsError, `The Format AmerMYFI4 has an invalid 'stationOffsetSize' attribute. It should be a positive integer.`);
      });
      it("StationOffsetSize is not positive", () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          stationOffsetSize: -3,
          type: "station",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        assert.throws(() => testFormat.fromJsonSync(json), ECObjectsError, `The Format AmerMYFI4 has an invalid 'stationOffsetSize' attribute. It should be a positive integer.`);
      });
      it("Type is station; StationOffsetSize is required", () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "station",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        assert.throws(() => testFormat.fromJsonSync(json), ECObjectsError, `The Format AmerMYFI4 has type 'Station' therefore attribute 'stationOffsetSize' is required.`);
      });
      it("Type is not station; StationOffsetSize is ignored", () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          stationOffsetSize: 3,
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        testFormat.fromJsonSync(json);
        assert(testFormat.stationOffsetSize === undefined);
      });
      it("decimalSeparator, thousandSeparator, uomSeparator, stationSeparator cannot be more than one character", () => {
        const jsonDecimalSeparator = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "decimal",
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 3,
          decimalSeparator: "..",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        const jsonThousandSeparator = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "scientific",
          scientificType: "normalized",
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 0,
          decimalSeparator: ".",
          thousandSeparator: ",.",
          uomSeparator: " ",
        };
        const jsonUOMSeparator = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "station",
          stationOffsetSize: 3,
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 12,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: "  ",
        };
        const jsonStationSeparator = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          type: "station",
          stationOffsetSize: 3,
          description: "",
          showSignOption: "onlyNegative",
          formatTraits: "keepSingleZero|trailZeroes",
          precision: 12,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
          stationSeparator: "++",
        };
        assert.throws(() => testFormat.fromJsonSync(jsonDecimalSeparator), ECObjectsError, `The Format AmerMYFI4 has an invalid 'decimalSeparator' attribute.`);
        assert.throws(() => testFormat.fromJsonSync(jsonThousandSeparator), ECObjectsError, `The Format AmerMYFI4 has an invalid 'thousandSeparator' attribute.`);
        assert.throws(() => testFormat.fromJsonSync(jsonUOMSeparator), ECObjectsError, `The Format AmerMYFI4 has an invalid 'uomSeparator' attribute.`);
        assert.throws(() => testFormat.fromJsonSync(jsonStationSeparator), ECObjectsError, `The Format AmerMYFI4 has an invalid 'stationSeparator' attribute.`);
      });
    });
    describe("fromJson FormatTraits Tests", () => {
      it("String with valid options", () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "trailZeroes|keepSingleZero|zeroEmpty|keepDecimalPoint|applyRounding|fractionDash|showUnitLabel|prependUnitLabel|use1000Separator|exponentOnlyNegative",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        testFormat.fromJsonSync(json);
        assert((testFormat!.formatTraits & 0x3FF) === testFormat!.formatTraits);
      });
      it("Valid options with multiple separators", () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "trailZeroes;keepSingleZero|zeroEmpty|keepDecimalPoint,applyRounding|fractionDash;showUnitLabel,prependUnitLabel;use1000Separator,exponentOnlyNegative",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        testFormat.fromJsonSync(json);
        assert((testFormat!.formatTraits & 0x3FF) === testFormat!.formatTraits);
      });
      it("Valid options with invalid separator", () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "trailZeroes;keepSingleZero|zeroEmpty|keepDecimalPoint,applyRounding\fractionDash;showUnitLabel,prependUnitLabel;use1000Separator,exponentOnlyNegative",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        assert.throws(() => testFormat.fromJsonSync(json), ECObjectsError, `Format has an invalid 'formatTraits' option.`);
      });
      it("String with invalid option", () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "trailZero|keepSingleZero|zeroEmpty",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        assert.throws(() => testFormat.fromJsonSync(json), ECObjectsError, `Format has an invalid 'formatTraits' option.`);
      });
      it("Empty string should make formatTraits undefined", () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: "",
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        testFormat.fromJsonSync(json);
        assert(testFormat.formatTraits ===  0);
      });
      it("String[] with valid options", () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
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
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        testFormat.fromJsonSync(json);
        assert((testFormat!.formatTraits & 0x3FF) === testFormat!.formatTraits);
      });
      it("String[] with one valid option", () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: [
            "trailZeroes",
          ],
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        testFormat.fromJsonSync(json);
        assert(testFormat.hasFormatTrait(FormatTraits.KeepSingleZero) === false);
        assert(testFormat.hasFormatTrait(FormatTraits.TrailZeroes));
        assert(testFormat.hasFormatTrait(FormatTraits.ApplyRounding) === false);
      });
      it("String[] with invalid option", () => {
        const json = {
          schemaItemType: "Format",
          name: "AmerMYFI4",
          label: "myfi4",
          description: "",
          roundFactor: 0.0,
          type: "fractional",
          showSignOption: "onlyNegative",
          formatTraits: [
            "trailZero",
          ],
          precision: 4,
          decimalSeparator: ".",
          thousandSeparator: ",",
          uomSeparator: " ",
        };
        assert.throws(() => testFormat.fromJsonSync(json), ECObjectsError, `Format has an invalid 'formatTraits' option.`);
      });
    });
  });
  describe("Async Tests with Composite", () => {
    beforeEach(() => {
      Schema.ec32 = true;
      const schema = new Schema("TestSchema", 1, 0, 0);
      testFormat = new Format(schema, "AmerMYFI4");
    });

    afterEach(() => {
      Schema.ec32 = false;
    });

    it("Basic test", async () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          AmerMYFI4: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
            composite: {
              includeZero: false,
              spacer: "-",
              units: [
                {
                  name: "TestSchema.MILE",
                  label: "mile(s)",
                },
              ],
            },
          },
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Imperial: {
            schemaItemType: "UnitSystem",
          },
          MILE: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Imperial",
            definition: "mile",
          },
        },
      };
      const ecSchema = await Schema.fromJson(testSchema);
      assert.isDefined(ecSchema);
      const testItem = await ecSchema.getItem("AmerMYFI4");
      assert.isDefined(testItem);
      assert.isTrue(testItem instanceof Format);
      const formatTest: Format = testItem as Format;
      assert.isDefined(formatTest);
      expect(formatTest.type === FormatType.Fractional);
      const testUnitItem = await ecSchema.getItem("MILE");
      assert.isDefined(testUnitItem);
      const unitTest: Unit = testUnitItem as Unit;
      assert(unitTest!.name, "MILE");
     });
    it("Throw for Composite with missing units attribute", async () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          AmerMYFI4: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
            composite: {
              includeZero: false,
              spacer: "-",
            },
          },
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Imperial: {
            schemaItemType: "UnitSystem",
          },
          MILE: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Imperial",
            definition: "mile",
          },
        },
      };
      await expect(Schema.fromJson(testSchema)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'Composite' attribute. It must have 1-4 units.`);
    });
    it("Throw for Composite with empty units array", async () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          AmerMYFI4: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
            composite: {
              includeZero: false,
              spacer: "-",
              units: [

              ],
            },
          },
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Imperial: {
            schemaItemType: "UnitSystem",
          },
          MILE: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Imperial",
            definition: "mile",
          },
        },
      };
      await expect(Schema.fromJson(testSchema)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'Composite' attribute. It must have 1-4 units.`);
    });
    it("includeZero must be boolean", async () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          AmerMYFI4: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
            composite: {
              includeZero: "false",
              spacer: "-",
              units: [
                {
                  name: "TestSchema.MILE",
                  label: "mile(s)",
                },
              ],
            },
          },
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Imperial: {
            schemaItemType: "UnitSystem",
          },
          MILE: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Imperial",
            definition: "mile",
          },
        },
      };
      await expect(Schema.fromJson(testSchema)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has a Composite with an invalid 'includeZero' attribute. It should be of type 'boolean'.`);
    });
    it("spacer must be a one character string", async () => {
      const json = {
        schemaItemType: "Format",
        name: "AmerMYFI4",
        type: "fractional",
        precision: 4,
        composite: {
          includeZero: false,
          spacer: "space",
          units: [
            {
              name: "TestSchema.MILE",
              label: "mile(s)",
            },
          ],
        },
      };
      await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has a Composite with an invalid 'spacer' attribute.`);
    });
    it("spacer must be a string", async () => {
      const json = {
        includeZero: false,
        schemaItemType: "Format",
        name: "AmerMYFI4",
        type: "fractional",
        precision: 4,
        composite: {
          includeZero: false,
          spacer: 1,
          units: [
            {
              name: "TestSchema.MILE",
              label: "mile(s)",
            },
          ],
        },
      };
      await expect(testFormat.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has a Composite with an invalid 'spacer' attribute.`);
    });
    it("Unit names must be unique", async () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          AmerMYFI4: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
            composite: {
              includeZero: false,
              spacer: "-",
              units: [
                {
                  name: "TestSchema.MILE",
                  label: "mile(s)",
                },
                {
                  name: "TestSchema.MILE",
                  label: "yrd(s)",
                },
              ],
            },
          },
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Imperial: {
            schemaItemType: "UnitSystem",
          },
          MILE: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Imperial",
            definition: "mile",
          },
        },
      };
      await expect(Schema.fromJson(testSchema)).to.be.rejectedWith(ECObjectsError, `The unit MILE has a duplicate name.`);

    });
    it("Cannot have more than 4 units", async () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          AmerMYFI4: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
            composite: {
              includeZero: false,
              spacer: "-",
              units: [
                {
                  name: "MILE",
                  label: "mile(s)",
                },
                {
                  name: "YRD",
                  label: "yrd(s)",
                },
                {
                  name: "FT",
                  label: "'",
                },
                {
                  name: "IN",
                  label: "\"",
                },
                {
                  name: "METER",
                  label: "meter(s)",
                },
              ],
            },
          },
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Imperial: {
            schemaItemType: "UnitSystem",
          },
          MILE: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Imperial",
            definition: "mile",
          },
        },
      };
      await expect(Schema.fromJson(testSchema)).to.be.rejectedWith(ECObjectsError, `The Format AmerMYFI4 has an invalid 'Composite' attribute. It must have 1-4 units.`);
    });
  });
  describe("Sync Tests with Composite", () => {
    beforeEach(() => {
      Schema.ec32 = true;
      const schema = new Schema("TestSchema", 1, 0, 0);
      testFormat = new Format(schema, "AmerMYFI4");
    });

    afterEach(() => {
      Schema.ec32 = false;
    });

    it("Basic test", () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          AmerMYFI4: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
            composite: {
              includeZero: false,
              spacer: "-",
              units: [
                {
                  name: "TestSchema.MILE",
                  label: "mile(s)",
                },
              ],
            },
          },
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Imperial: {
            schemaItemType: "UnitSystem",
          },
          MILE: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Imperial",
            definition: "mile",
          },
        },
      };
      const ecSchema = Schema.fromJsonSync(testSchema);
      assert.isDefined(ecSchema);
      const testItem = ecSchema.getItemSync("AmerMYFI4");
      assert.isDefined(testItem);
      assert.isTrue(testItem instanceof Format);
      const formatTest: Format = testItem as Format;
      assert.isDefined(formatTest);
      expect(formatTest.type === FormatType.Fractional);
      const testUnitItem = ecSchema.getItemSync("MILE");
      assert.isDefined(testUnitItem);
      const unitTest: Unit = testUnitItem as Unit;
      assert(unitTest!.name, "MILE");
     });
    it("Throw for Composite with missing units attribute", () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          AmerMYFI4: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
            composite: {
              includeZero: false,
              spacer: "-",
            },
          },
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Imperial: {
            schemaItemType: "UnitSystem",
          },
          MILE: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Imperial",
            definition: "mile",
          },
        },
      };
      assert.throws(() => Schema.fromJsonSync(testSchema), ECObjectsError, `The Format AmerMYFI4 has an invalid 'Composite' attribute. It must have 1-4 units.`);
    });
    it("Throw for Composite with empty units array", () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          AmerMYFI4: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
            composite: {
              includeZero: false,
              spacer: "-",
              units: [

              ],
            },
          },
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Imperial: {
            schemaItemType: "UnitSystem",
          },
          MILE: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Imperial",
            definition: "mile",
          },
        },
      };
      assert.throws(() => Schema.fromJsonSync(testSchema), ECObjectsError, `The Format AmerMYFI4 has an invalid 'Composite' attribute. It must have 1-4 units.`);
    });
    it("includeZero must be boolean", () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          AmerMYFI4: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
            composite: {
              includeZero: "false",
              spacer: "-",
              units: [
                {
                  name: "TestSchema.MILE",
                  label: "mile(s)",
                },
              ],
            },
          },
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Imperial: {
            schemaItemType: "UnitSystem",
          },
          MILE: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Imperial",
            definition: "mile",
          },
        },
      };
      assert.throws(() => Schema.fromJsonSync(testSchema), ECObjectsError, `The Format AmerMYFI4 has a Composite with an invalid 'includeZero' attribute. It should be of type 'boolean'.`);
    });
    it("spacer must be a one character string", () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          AmerMYFI4: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
            composite: {
              includeZero: false,
              spacer: "spacer",
            },
          },
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Imperial: {
            schemaItemType: "UnitSystem",
          },
          MILE: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Imperial",
            definition: "mile",
          },
        },
      };
      assert.throws(() => Schema.fromJsonSync(testSchema), ECObjectsError, `The Format AmerMYFI4 has a Composite with an invalid 'spacer' attribute.`);
    });
    it("spacer must be a string", () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          AmerMYFI4: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
            composite: {
              includeZero: false,
              spacer: 8,
            },
          },
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Imperial: {
            schemaItemType: "UnitSystem",
          },
          MILE: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Imperial",
            definition: "mile",
          },
        },
      };
      assert.throws(() => Schema.fromJsonSync(testSchema), ECObjectsError, `The Format AmerMYFI4 has a Composite with an invalid 'spacer' attribute.`);
    });
    it("Unit names must be unique", () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          AmerMYFI4: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
            composite: {
              includeZero: false,
              spacer: "-",
              units: [
                {
                  name: "TestSchema.MILE",
                  label: "mile(s)",
                },
                {
                  name: "TestSchema.MILE",
                  label: "yrd(s)",
                },
              ],
            },
          },
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Imperial: {
            schemaItemType: "UnitSystem",
          },
          MILE: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Imperial",
            definition: "mile",
          },
        },
      };
      assert.throws(() => Schema.fromJsonSync(testSchema), ECObjectsError, `The unit MILE has a duplicate name.`);

    });
    it("Cannot have more than 4 units", () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          AmerMYFI4: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
            composite: {
              includeZero: false,
              spacer: "-",
              units: [
                {
                  name: "MILE",
                  label: "mile(s)",
                },
                {
                  name: "YRD",
                  label: "yrd(s)",
                },
                {
                  name: "FT",
                  label: "'",
                },
                {
                  name: "IN",
                  label: "\"",
                },
                {
                  name: "METER",
                  label: "meter(s)",
                },
              ],
            },
          },
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Imperial: {
            schemaItemType: "UnitSystem",
          },
          MILE: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Imperial",
            definition: "mile",
          },
        },
      };
      assert.throws(() => Schema.fromJsonSync(testSchema), ECObjectsError, `The Format AmerMYFI4 has an invalid 'Composite' attribute. It must have 1-4 units.`);
    });
  });
});
