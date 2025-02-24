/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { QuantityError } from "../Exception";
import { Format } from "../Formatter/Format";
import { DecimalPrecision, FormatTraits, parseFormatTrait } from "../Formatter/FormatEnums";
import { CustomFormatProps, FormatProps } from "../Formatter/Interfaces";
import { TestUnitsProvider } from "./TestUtils/TestHelper";

describe("Formatting tests:", () => {
  it("A valid 'string' Type is required", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: ["keepSingleZero", "showUnitLabel", "fractionDash"],
      precision: 8,
      type: "badType",
      uomSeparator: " ",
    };
    const testFormat = new Format("test");

    await testFormat.fromJSON(unitsProvider, json).catch((err) => {
      expect(err).toBeInstanceOf(QuantityError);
      expect(err.message).toEqual(`The Format test has an invalid 'type' attribute.`);
    });
  });

  it("Precision is required", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      type: "Decimal",
      uomSeparator: " ",
    };
    const testFormat = new Format("test");

    await testFormat.fromJSON(unitsProvider, json).catch((err) => {
      expect(err).toBeInstanceOf(QuantityError);
      expect(err.message).toEqual(`The Format test does not have the required 'precision' attribute.`);
    });
  });

  it("Precision (int number) is required", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 8.8,
      type: "Decimal",
      uomSeparator: " ",
    };
    const testFormat = new Format("test");

    await testFormat.fromJSON(unitsProvider, json).catch((err) => {
      expect(err).toBeInstanceOf(QuantityError);
      expect(err.message).toEqual(`The Format test has an invalid 'precision' attribute. It should be an integer.`);
    });
  });

  it("Precision (int number < 12) is required", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 13,
      type: "Decimal",
      uomSeparator: " ",
    };
    const testFormat = new Format("test");

    await testFormat.fromJSON(unitsProvider, json).catch((err) => {
      expect(err).toBeInstanceOf(QuantityError);
      expect(err.message).toEqual(`The Format test has an invalid 'precision' attribute.`);
    });
  });

  it("Bad Show sign option", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 8,
      type: "Decimal",
      showSignOption: "bad",
      uomSeparator: " ",
    };
    const testFormat = new Format("test");

    await testFormat.fromJSON(unitsProvider, json).catch((err) => {
      expect(err).toBeInstanceOf(QuantityError);
      expect(err.message).toEqual(`The Format test has an invalid 'showSignOption' attribute.`);
    });
  });

  it("Bad fractional precision", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 0,
      type: "Fractional",
      uomSeparator: " ",
    };
    const testFormat = new Format("test");

    await testFormat.fromJSON(unitsProvider, json).catch((err) => {
      expect(err).toBeInstanceOf(QuantityError);
      expect(err.message).toEqual(`The Format test has an invalid 'precision' attribute.`);
    });
  });

  it("Bad format trait", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: ["test"],
      precision: 12,
      type: "Decimal",
      uomSeparator: " ",
    };
    const testFormat = new Format("test");

    await testFormat.fromJSON(unitsProvider, json).catch((err) => {
      expect(err).toBeInstanceOf(QuantityError);
      expect(err.message).toEqual(`The Format test has an invalid 'formatTraits' attribute.`);
    });
  });

  it("Good round factor", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: [],
      precision: 12,
      type: "Decimal",
      uomSeparator: " ",
      roundFactor: 0.5,
    };
    const testFormat = new Format("test");

    await testFormat.fromJSON(unitsProvider, json);
  });

  it("Good default round factor", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: [],
      precision: 12,
      type: "Decimal",
      uomSeparator: " ",
      roundFactor: 0.0,
    };
    const testFormat = new Format("test");

    await testFormat.fromJSON(unitsProvider, json);
  });

  it("Bad minWidth value", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: [],
      precision: 12,
      type: "Decimal",
      uomSeparator: " ",
      minWidth: -5,
    };
    const testFormat = new Format("test");

    await testFormat.fromJSON(unitsProvider, json).catch((err) => {
      expect(err).toBeInstanceOf(QuantityError);
      expect(err.message).toEqual(`The Format test has an invalid 'minWidth' attribute. It should be a positive integer.`);
    });
  });

  it("Good showSign entry", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: [],
      precision: 12,
      type: "Decimal",
      uomSeparator: " ",
      showSignOption: "onlyNegative",
    };
    const testFormat = new Format("test");

    await expect(testFormat.fromJSON(unitsProvider, json)).resolves.not.toThrow();
  });

  it("Bad decimal separator value", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      precision: 12,
      type: "Decimal",
      uomSeparator: " ",
      decimalSeparator: "**",
    };
    const testFormat = new Format("test");

    await testFormat.fromJSON(unitsProvider, json).catch((err) => {
      expect(err).toBeInstanceOf(QuantityError);
      expect(err.message).toEqual(`The Format test has an invalid 'decimalSeparator' attribute. It should be an empty or one character string.`);
    });
  });

  it("Good decimal separator value", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      precision: 12,
      type: "Decimal",
      uomSeparator: " ",
      decimalSeparator: " ",
    };
    const testFormat = new Format("test");

    await expect(testFormat.fromJSON(unitsProvider, json)).resolves.not.toThrow();
  });

  it("Bad thousand separator value", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      precision: 12,
      type: "Decimal",
      uomSeparator: " ",
      thousandSeparator: "**",
    };
    const testFormat = new Format("test");

    await testFormat.fromJSON(unitsProvider, json).catch((err) => {
      expect(err).toBeInstanceOf(QuantityError);
      expect(err.message).toEqual(`The Format test has an invalid 'thousandSeparator' attribute. It should be an empty or one character string.`);
    });
  });

  it("Good thousand separator value", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      precision: 12,
      type: "Decimal",
      uomSeparator: " ",
      thousandSeparator: " ",
    };
    const testFormat = new Format("test");

    await expect(testFormat.fromJSON(unitsProvider, json)).resolves.not.toThrow();
  });

  it("Bad uom separator value", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      precision: 12,
      type: "Decimal",
      uomSeparator: "**",
    };
    const testFormat = new Format("test");

    await testFormat.fromJSON(unitsProvider, json).catch((err) => {
      expect(err).toBeInstanceOf(QuantityError);
      expect(err.message).toEqual(`The Format test has an invalid 'uomSeparator' attribute. It should be an empty or one character string.`);
    });
  });

  it("Good uom separator value", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      precision: 12,
      type: "Decimal",
      uomSeparator: " ",
    };
    const testFormat = new Format("test");

    await expect(testFormat.fromJSON(unitsProvider, json)).resolves.not.toThrow();
  });

  it("Bad station separator value", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      precision: 12,
      uomSeparator: " ",
      stationOffsetSize: 2,
      type: "Station",
      stationSeparator: "**",
    };
    const testFormat = new Format("test");

    await testFormat.fromJSON(unitsProvider, json).catch((err) => {
      expect(err).toBeInstanceOf(QuantityError);
      expect(err.message).toEqual(`The Format test has an invalid 'stationSeparator' attribute. It should be an empty or one character string.`);
    });
  });

  it("Good station separator value", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      precision: 12,
      uomSeparator: " ",
      stationOffsetSize: 2,
      type: "Station",
      stationSeparator: "+",
    };
    const testFormat = new Format("test");

    await expect(testFormat.fromJSON(unitsProvider, json)).resolves.not.toThrow();
  });

  it("Scientific type is required", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 8,
      type: "Scientific",
      uomSeparator: " ",
    };
    const testFormat = new Format("test");

    await testFormat.fromJSON(unitsProvider, json).catch((err) => {
      expect(err).toBeInstanceOf(QuantityError);
      expect(err.message).toEqual(`The Format test is 'Scientific' type therefore the attribute 'scientificType' is required.`);
    });
  });

  it("A valid Scientific type is required", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 8,
      type: "Scientific",
      scientificType: "bad",
      uomSeparator: " ",
    };
    const testFormat = new Format("test");

    await testFormat.fromJSON(unitsProvider, json).catch((err) => {
      expect(err).toBeInstanceOf(QuantityError);
      expect(err.message).toEqual(`The Format test has an invalid 'scientificType' attribute.`);
    });
  });

  it("No Composite Units", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      composite: {
        includeZero: true,
        spacer: "",
        units: [],
      },
      formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      precision: 8,
      type: "Fractional",
      uomSeparator: "",
    };
    const testFormat = new Format("test");

    await testFormat.fromJSON(unitsProvider, json).catch((err) => {
      expect(err).toBeInstanceOf(QuantityError);
      expect(err.message).toEqual(`The Format test has a Composite with no valid 'units'`);
    });
  });

  it("Invalid Composite cUnit name", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          {
            name: "Units.F",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      precision: 8,
      type: "Fractional",
      uomSeparator: "",
    };
    const testFormat = new Format("test");

    await testFormat.fromJSON(unitsProvider, json).catch((err) => {
      expect(err).toBeInstanceOf(QuantityError);
      expect(err.message).toEqual(`Invalid unit name 'Units.F'.`);
    });
  });

  it("Invalid Composite duplicate units", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          {
            label: "ft",
            name: "Units.FT",
          },
          {
            label: "'",
            name: "Units.FT",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      precision: 8,
      type: "Fractional",
      uomSeparator: "",
    };
    const testFormat = new Format("test");

    await testFormat.fromJSON(unitsProvider, json).catch((err) => {
      expect(err).toBeInstanceOf(QuantityError);
      expect(err.message).toEqual(`The unit Units.FT has a duplicate name.`);
    });
  });

  it("Missing station offset", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: ["trailZeroes", "keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      minWidth: 2,
      precision: 2,
      type: "Station",
    };
    const testFormat = new Format("test");

    await testFormat.fromJSON(unitsProvider, json).catch((err) => {
      expect(err).toBeInstanceOf(QuantityError);
      expect(err.message).toEqual(`The Format test is 'Station' type therefore the attribute 'stationOffsetSize' is required.`);
    });
  });

  it("Bad station offset value", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: ["trailZeroes", "keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      minWidth: 2,
      precision: 2,
      stationOffsetSize: 0,
      type: "Station",
    };
    const testFormat = new Format("test");

    await testFormat.fromJSON(unitsProvider, json).catch((err) => {
      expect(err).toBeInstanceOf(QuantityError);
      expect(err.message).toEqual(`The Format test has an invalid 'stationOffsetSize' attribute. It should be a positive integer.`);
    });
  });

  it("Bad spacer (too many characters) in Composite", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      composite: {
        includeZero: true,
        spacer: "**",
        units: [
          {
            label: "'",
            name: "Units.FT",
          },
          {
            label: "\"",
            name: "Units.IN",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      precision: 8,
      type: "Fractional",
      uomSeparator: "",
    };
    const testFormat = new Format("test");

    await testFormat.fromJSON(unitsProvider, json).catch((err) => {
      expect(err).toBeInstanceOf(QuantityError);
      expect(err.message).toEqual(`The Format test has a Composite with an invalid 'spacer' attribute. It should be an empty or one character string.`);
    });
  });

  it("Read/Write All Format Traits", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: ["trailZeroes", "keepSingleZero", "zeroEmpty", "keepDecimalPoint", "applyRounding", "fractionDash", "showUnitLabel", "prependUnitLabel", "use1000Separator", "exponentOnlyNegative"],
      precision: 8,
      type: "Decimal",
      uomSeparator: " ",
    };
    const testFormat = new Format("test");

    await testFormat.fromJSON(unitsProvider, json);
    expect(testFormat.hasFormatTraitSet(FormatTraits.ApplyRounding)).to.be.true;
    expect(testFormat.hasFormatTraitSet(FormatTraits.ExponentOnlyNegative)).to.be.true;
    expect(testFormat.hasFormatTraitSet(FormatTraits.FractionDash)).to.be.true;
    expect(testFormat.hasFormatTraitSet(FormatTraits.KeepDecimalPoint)).to.be.true;
    expect(testFormat.hasFormatTraitSet(FormatTraits.KeepSingleZero)).to.be.true;
    expect(testFormat.hasFormatTraitSet(FormatTraits.PrependUnitLabel)).to.be.true;
    expect(testFormat.hasFormatTraitSet(FormatTraits.ShowUnitLabel)).to.be.true;
    expect(testFormat.hasFormatTraitSet(FormatTraits.TrailZeroes)).to.be.true;
    expect(testFormat.hasFormatTraitSet(FormatTraits.Use1000Separator)).to.be.true;
    expect(testFormat.hasFormatTraitSet(FormatTraits.ZeroEmpty)).to.be.true;

    const outJson = testFormat.toJSON();
    expect(outJson.formatTraits!.length).toEqual(10);

    // ensure we can modify
    const modifiedFormatProps = { ...outJson, formatTraits: ["keepSingleZero"], precision: 3 };
    const modifiedFormat = new Format("modified");
    await modifiedFormat.fromJSON(unitsProvider, modifiedFormatProps);
    expect(modifiedFormat.hasFormatTraitSet(FormatTraits.KeepSingleZero)).to.be.true;
    expect(modifiedFormat.hasFormatTraitSet(FormatTraits.ShowUnitLabel)).to.be.false;
    expect(modifiedFormat.precision).toEqual(DecimalPrecision.Three);
  });

  it("Read/Write Empty Format Traits", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: [],
      precision: 8,
      type: "Decimal",
      uomSeparator: " ",
    };
    const testFormat = new Format("test");

    await testFormat.fromJSON(unitsProvider, json);
    expect(testFormat.hasFormatTraitSet(FormatTraits.ApplyRounding)).to.be.false;
    expect(testFormat.hasFormatTraitSet(FormatTraits.ExponentOnlyNegative)).to.be.false;
    expect(testFormat.hasFormatTraitSet(FormatTraits.FractionDash)).to.be.false;
    expect(testFormat.hasFormatTraitSet(FormatTraits.KeepDecimalPoint)).to.be.false;
    expect(testFormat.hasFormatTraitSet(FormatTraits.KeepSingleZero)).to.be.false;
    expect(testFormat.hasFormatTraitSet(FormatTraits.PrependUnitLabel)).to.be.false;
    expect(testFormat.hasFormatTraitSet(FormatTraits.ShowUnitLabel)).to.be.false;
    expect(testFormat.hasFormatTraitSet(FormatTraits.TrailZeroes)).to.be.false;
    expect(testFormat.hasFormatTraitSet(FormatTraits.Use1000Separator)).to.be.false;
    expect(testFormat.hasFormatTraitSet(FormatTraits.ZeroEmpty)).to.be.false;

    const outJson = testFormat.toJSON();
    expect(outJson.formatTraits!.length).toEqual(0);
  });

  it("Load Formats from Json", async () => {
    const unitsProvider = new TestUnitsProvider();

    const formatDataArray = [{
      formatTraits: ["keepSingleZero", "showUnitLabel", "fractionDash"],
      precision: 1,
      type: "Fractional",
      uomSeparator: " ",
    }, {
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 2,
      type: "Fractional",
      uomSeparator: "",
    }, {
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Fractional",
      uomSeparator: "",
    }, {
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 8,
      type: "Fractional",
      uomSeparator: " ",
    }, {
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 16,
      type: "Fractional",
      uomSeparator: " ",
    }, {
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 32,
      type: "Fractional",
      uomSeparator: " ",
    }, {
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 64,
      type: "Fractional",
      uomSeparator: " ",
    }, {
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 128,
      type: "Fractional",
      uomSeparator: " ",
    }, {
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 256,
      type: "Fractional",
      uomSeparator: " ",
    }, {
      formatTraits: ["keepSingleZero", "applyRounding", "keepDecimalPoint", "showUnitLabel"],
      precision: 0,
      type: "Decimal",
      uomSeparator: " ",
      showSignOption: "negativeParentheses",
    }, {
      formatTraits: ["keepSingleZero", "applyRounding", "keepDecimalPoint", "showUnitLabel"],
      precision: 1,
      type: "Decimal",
      uomSeparator: " ",
      showSignOption: "noSign",
    }, {
      formatTraits: ["keepSingleZero", "applyRounding", "keepDecimalPoint", "showUnitLabel"],
      precision: 2,
      type: "Decimal",
      uomSeparator: " ",
      showSignOption: "signAlways",
    }, {
      formatTraits: ["keepSingleZero", "applyRounding", "keepDecimalPoint", "showUnitLabel"],
      precision: 3,
      type: "Decimal",
      uomSeparator: " ",
      showSignOption: "onlyNegative",
    }, {
      formatTraits: ["keepSingleZero", "applyRounding", "keepDecimalPoint", "showUnitLabel", "use1000Separator"],
      precision: 4,
      type: "Decimal",
      uomSeparator: " ",
    }, {
      formatTraits: ["keepSingleZero", "applyRounding", "keepDecimalPoint", "showUnitLabel", "use1000Separator"],
      precision: 5,
      type: "Decimal",
      uomSeparator: " ",
    }, {
      formatTraits: ["keepSingleZero", "applyRounding", "keepDecimalPoint", "showUnitLabel", "use1000Separator"],
      precision: 6,
      type: "Decimal",
      uomSeparator: " ",
    }, {
      formatTraits: ["keepSingleZero", "applyRounding", "keepDecimalPoint", "showUnitLabel", "use1000Separator"],
      precision: 7,
      type: "Decimal",
      uomSeparator: " ",
    }, {
      formatTraits: ["keepSingleZero", "applyRounding", "keepDecimalPoint", "showUnitLabel", "use1000Separator"],
      precision: 8,
      type: "Decimal",
      uomSeparator: " ",
    }, {
      formatTraits: ["keepSingleZero", "applyRounding", "keepDecimalPoint", "showUnitLabel", "use1000Separator"],
      precision: 9,
      type: "Decimal",
      uomSeparator: " ",
    }, {
      formatTraits: ["keepSingleZero", "applyRounding", "keepDecimalPoint", "showUnitLabel", "use1000Separator"],
      precision: 10,
      type: "Decimal",
      uomSeparator: " ",
    }, {
      formatTraits: ["keepSingleZero", "applyRounding", "keepDecimalPoint", "showUnitLabel", "use1000Separator"],
      precision: 11,
      type: "Decimal",
      uomSeparator: " ",
    }, {
      formatTraits: ["keepSingleZero", "applyRounding", "keepDecimalPoint", "showUnitLabel", "use1000Separator"],
      precision: 12,
      type: "Decimal",
      uomSeparator: " ",
    }, {
      formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      precision: 4,
      type: "Scientific",
      scientificType: "zeroNormalized",
      uomSeparator: " ",
    }, {
      formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      precision: 4,
      type: "Scientific",
      scientificType: "normalized",
      uomSeparator: " ",
    }, {
      formatTraits: ["trailZeroes", "keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      minWidth: 2,
      precision: 2,
      stationOffsetSize: 2,
      type: "Station",
    }, {
      formatTraits: ["trailZeroes", "keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      minWidth: 2,
      precision: 2,
      stationOffsetSize: 2,
      type: "Station",
    }, {
      composite: {
        units: [
          {
            name: "Units.FT",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "applyRounding", "keepDecimalPoint", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
      uomSeparator: "",
    }, {
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          {
            label: "'",
            name: "Units.FT",
          },
          {
            label: "\"",
            name: "Units.IN",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      precision: 8,
      type: "Fractional",
      uomSeparator: "",
    }];

    for (const formatData of formatDataArray) {
      const format = new Format("test");
      await format.fromJSON(unitsProvider, formatData);
      if (formatData.hasOwnProperty("precision"))
        expect(format.precision).toEqual(formatData.precision);
      expect(format.type.toUpperCase()).toEqual(formatData.type.toUpperCase());
      if (formatData.hasOwnProperty("uomSeparator"))
        expect(format.uomSeparator).toEqual(formatData.uomSeparator);
      for (const traitStr of formatData.formatTraits) {
        const traitToValidate = parseFormatTrait(traitStr, "format.test");
        if (traitToValidate !== undefined)
          expect(format.hasFormatTraitSet(traitToValidate)).to.be.true;
      }

      if (formatData.hasOwnProperty("composite")) {
        expect(format.hasUnits).to.be.true;
        expect(format.units!.length).toEqual(formatData.composite!.units.length);
      }

      const jsonData = format.toJSON();
      expect(jsonData.type.toUpperCase()).toEqual(format.type.toUpperCase());
      if (formatData.hasOwnProperty("showSignOption")) {
        expect(formatData.showSignOption!.toUpperCase()).toEqual(jsonData.showSignOption!.toUpperCase());
      }
    }
  });

  it("isFormatTraitSetInProps works properly", () => {
    const formatProps: FormatProps = {
      type: "decimal",
      formatTraits: [
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

    expect(Format.isFormatTraitSetInProps(formatProps, FormatTraits.ApplyRounding)).to.be.true;
    expect(Format.isFormatTraitSetInProps(formatProps, FormatTraits.ExponentOnlyNegative)).to.be.true;
    expect(Format.isFormatTraitSetInProps(formatProps, FormatTraits.FractionDash)).to.be.true;
    expect(Format.isFormatTraitSetInProps(formatProps, FormatTraits.KeepDecimalPoint)).to.be.true;
    expect(Format.isFormatTraitSetInProps(formatProps, FormatTraits.KeepSingleZero)).to.be.true;
    expect(Format.isFormatTraitSetInProps(formatProps, FormatTraits.PrependUnitLabel)).to.be.true;
    expect(Format.isFormatTraitSetInProps(formatProps, FormatTraits.ShowUnitLabel)).to.be.true;
    expect(Format.isFormatTraitSetInProps(formatProps, FormatTraits.TrailZeroes)).to.be.false;
    expect(Format.isFormatTraitSetInProps(formatProps, FormatTraits.Use1000Separator)).to.be.true;
    expect(Format.isFormatTraitSetInProps(formatProps, FormatTraits.ZeroEmpty)).to.be.true;
  });

  it("isFormatTraitSetInProps works properly", () => {
    const formatProps: FormatProps = {
      type: "decimal",
      formatTraits: [
        "trailZeroes",
      ],
    };

    expect(Format.isFormatTraitSetInProps(formatProps, FormatTraits.ApplyRounding)).to.be.false;
    expect(Format.isFormatTraitSetInProps(formatProps, FormatTraits.ExponentOnlyNegative)).to.be.false;
    expect(Format.isFormatTraitSetInProps(formatProps, FormatTraits.FractionDash)).to.be.false;
    expect(Format.isFormatTraitSetInProps(formatProps, FormatTraits.KeepDecimalPoint)).to.be.false;
    expect(Format.isFormatTraitSetInProps(formatProps, FormatTraits.KeepSingleZero)).to.be.false;
    expect(Format.isFormatTraitSetInProps(formatProps, FormatTraits.PrependUnitLabel)).to.be.false;
    expect(Format.isFormatTraitSetInProps(formatProps, FormatTraits.ShowUnitLabel)).to.be.false;
    expect(Format.isFormatTraitSetInProps(formatProps, FormatTraits.Use1000Separator)).to.be.false;
    expect(Format.isFormatTraitSetInProps(formatProps, FormatTraits.ZeroEmpty)).to.be.false;
    expect(Format.isFormatTraitSetInProps(formatProps, FormatTraits.TrailZeroes)).to.be.true;
  });

  it("show old/optional trait format works properly", () => {
    const formatProps: FormatProps = {
      type: "decimal",
      formatTraits: "trailZeroes,keepSingleZero,zeroEmpty,keepDecimalPoint,applyRounding,fractionDash,showUnitLabel,prependUnitLabel,use1000Separator,exponentOnlyNegative",
    };

    expect(Format.isFormatTraitSetInProps(formatProps, FormatTraits.ApplyRounding)).to.be.true;
    expect(Format.isFormatTraitSetInProps(formatProps, FormatTraits.ExponentOnlyNegative)).to.be.true;
    expect(Format.isFormatTraitSetInProps(formatProps, FormatTraits.FractionDash)).to.be.true;
    expect(Format.isFormatTraitSetInProps(formatProps, FormatTraits.KeepDecimalPoint)).to.be.true;
    expect(Format.isFormatTraitSetInProps(formatProps, FormatTraits.KeepSingleZero)).to.be.true;
    expect(Format.isFormatTraitSetInProps(formatProps, FormatTraits.PrependUnitLabel)).to.be.true;
    expect(Format.isFormatTraitSetInProps(formatProps, FormatTraits.ShowUnitLabel)).to.be.true;
    expect(Format.isFormatTraitSetInProps(formatProps, FormatTraits.TrailZeroes)).to.be.true;
    expect(Format.isFormatTraitSetInProps(formatProps, FormatTraits.Use1000Separator)).to.be.true;
    expect(Format.isFormatTraitSetInProps(formatProps, FormatTraits.ZeroEmpty)).to.be.true;
  });

  it("deserialization of custom Formats is consistent", async () => {
    const unitsProvider = new TestUnitsProvider();
    const formatProps: CustomFormatProps = {
      formatTraits: ["KeepSingleZero", "ApplyRounding", "KeepDecimalPoint", "ShowUnitLabel", "Use1000Separator"],
      precision: 6,
      type: "Decimal",
      uomSeparator: " ",
      custom: {
        foo: "bar",
      },
    };

    const format = await Format.createFromJSON("test", unitsProvider, formatProps);

    const jsonObj: FormatProps = format.toJSON();

    // Assertions
    // eslint-disable-next-line guard-for-in
    for (const key in formatProps) {
      expect(jsonObj.hasOwnProperty(key)).to.be.true;
      const formatPropValue = formatProps[key as keyof FormatProps];
      const jsonObjValue = jsonObj[key as keyof FormatProps];

      expect(typeof formatPropValue).toEqual(typeof jsonObjValue);
      if (Array.isArray(formatPropValue) && Array.isArray(jsonObjValue)) {
        expect(formatPropValue).to.have.members(jsonObjValue, `Property ${key} does not match`);
      } else {
        expect(formatPropValue).to.deep.equal(jsonObjValue, `Property ${key} does not match`);
      }
    }
  });

  it("deserialization of Formats is consistent", async () => {
    const unitsProvider = new TestUnitsProvider();
    const formatPropsArray: FormatProps[] = [
      {
        formatTraits: ["KeepSingleZero", "ApplyRounding", "KeepDecimalPoint", "ShowUnitLabel", "Use1000Separator"],
        precision: 6,
        type: "Decimal",
        uomSeparator: " ",
      },
      {

        formatTraits: ["KeepSingleZero", "KeepDecimalPoint", "ShowUnitLabel"],
        precision: 8,
        type: "Fractional",
        uomSeparator: "",
        composite: {
          includeZero: true,
          spacer: "",
          units: [
            {
              label: "'",
              name: "Units.FT",
            },
            {
              label: "\"",
              name: "Units.IN",
            },
          ],
        },
      },
      {
        formatTraits: ["TrailZeroes", "KeepSingleZero", "KeepDecimalPoint", "ShowUnitLabel"],
        minWidth: 6,
        precision: 3,
        type: "Bearing",
        uomSeparator: "",
        revolutionUnit: "Units.REVOLUTION",
        composite: {
          includeZero: true,
          spacer: "",
          units: [
            { name: "Units.ARC_DEG", label: "°" },
          ],
        },
      },
      {
        formatTraits: ["TrailZeroes", "KeepSingleZero", "KeepDecimalPoint", "ShowUnitLabel"],
        minWidth: 4,
        precision: 1,
        type: "Azimuth",
        uomSeparator: "",
        revolutionUnit: "Units.REVOLUTION",
        azimuthBase: 270.0,
        azimuthBaseUnit: "Units.ARC_DEG",
        azimuthCounterClockwise: false,
        composite: {
          includeZero: true,
          spacer: "",
          units: [
            { name: "Units.ARC_DEG", label: "°" },
          ],
        },
      },
      {
        type: "Ratio",
        ratioType: "OneToN",
        precision: 3,
        composite: {
          includeZero: true,
          spacer: "",
          units: [
            { name: "Units.VERTICAL_PER_HORIZONTAL" }, // presentation unit
          ],
        },
      },
    ];

    for (const formatProps of formatPropsArray) {
      const format = await Format.createFromJSON("test", unitsProvider, formatProps);

      const jsonObj: FormatProps = format.toJSON();

      // Assertions
      // eslint-disable-next-line guard-for-in
      for (const key in formatProps) {
        expect(jsonObj.hasOwnProperty(key)).to.be.true;
        const formatPropValue = formatProps[key as keyof FormatProps];
        const jsonObjValue = jsonObj[key as keyof FormatProps];

        expect(typeof formatPropValue).toEqual(typeof jsonObjValue);
        if (Array.isArray(formatPropValue) && Array.isArray(jsonObjValue)) {
          expect(formatPropValue).to.have.members(jsonObjValue, `Property ${key} does not match`);
        } else {
          expect(formatPropValue).to.deep.equal(jsonObjValue, `Property ${key} does not match`);
        }
      }
    }
  });
});
