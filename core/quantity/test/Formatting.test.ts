/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";

import { TestUnitsProvider } from "./TestUtils/TestHelper";
import { Format } from "../src/Formatter/Format";
import { QuantityError } from "../src/Exception";
import { FormatTraits } from "../src/Formatter/FormatEnums";

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at:', p, 'reason:', reason);
  // application specific logging, throwing an error, or other logic here
});

describe("Formatting tests:", () => {
  it("Type is required", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: ["keepSingleZero", "showUnitLabel", "fractionDash"],
      precision: 8,
      uomSeparator: " ",
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The Format test does not have the required 'type' attribute.`);
    });
  });

  it("A 'string' Type is required", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: ["keepSingleZero", "showUnitLabel", "fractionDash"],
      precision: 8,
      type: 1,
      uomSeparator: " ",
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The Format test has an invalid 'type' attribute. It should be of type 'string'.`);
    });
  });

  it("A valid 'string' Type is required", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: ["keepSingleZero", "showUnitLabel", "fractionDash"],
      precision: 8,
      type: "badType",
      uomSeparator: " ",
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The Format test has an invalid 'type' attribute.`);
    });
  });

  it("Precision is required", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      type: "Decimal",
      uomSeparator: " ",
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The Format test does not have the required 'precision' attribute.`);
    });
  });

  it("Precision (number) is required", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: "8",
      type: "Decimal",
      uomSeparator: " ",
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The Format test has an invalid 'precision' attribute. It should be of type 'number'.`);
    });
  });

  it("Precision (int number) is required", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 8.8,
      type: "Decimal",
      uomSeparator: " ",
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The Format test has an invalid 'precision' attribute. It should be an integer.`);
    });
  });

  it("Precision (int number < 12) is required", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 13,
      type: "Decimal",
      uomSeparator: " ",
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The 'precision' attribute must be an integer in the range 0-12.`);
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
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The Format test has an invalid 'showSignOption' attribute.`);
    });
  });

  it("Bad fractional precision", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 0,
      type: "Fractional",
      uomSeparator: " ",
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The Format test has an invalid 'precision' attribute.`);
    });
  });

  it("Bad format trait", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: ["test"],
      precision: 12,
      type: "Decimal",
      uomSeparator: " ",
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `Format has an invalid 'formatTraits' option.`);
    });
  });

  it("Bad round factor", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: [],
      precision: 12,
      type: "Decimal",
      uomSeparator: " ",
      roundFactor: "0.5"
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The Format test has an invalid 'roundFactor' attribute. It should be of type 'number'.`);
    });
  });

  it("Good round factor", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: [],
      precision: 12,
      type: "Decimal",
      uomSeparator: " ",
      roundFactor: 0.5
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch(() => { });
  });

  it("Good default round factor", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: [],
      precision: 12,
      type: "Decimal",
      uomSeparator: " ",
      roundFactor: 0.0
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch(() => { });
  });

  it("Bad minWidth format", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: [],
      precision: 12,
      type: "Decimal",
      uomSeparator: " ",
      minWidth: "25"
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The Format test has an invalid 'minWidth' attribute. It should be of type 'number'.`);
    });
  });

  it("Bad minWidth value", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: [],
      precision: 12,
      type: "Decimal",
      uomSeparator: " ",
      minWidth: -5
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The Format test has an invalid 'minWidth' attribute. It should be a positive integer.`);
    });
  });

  it("Bad showSign entry", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: [],
      precision: 12,
      type: "Decimal",
      uomSeparator: " ",
      showSignOption: 4
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The Format test has an invalid 'showSignOption' attribute. It should be of type 'string'.`);
    });
  });

  it("Good showSign entry", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: [],
      precision: 12,
      type: "Decimal",
      uomSeparator: " ",
      showSignOption: "onlyNegative"
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch(() => {
      assert.isTrue(false);
    });
  });

  it("Bad formatTraits entry", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: 1,
      precision: 12,
      type: "Decimal",
      uomSeparator: " ",
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The Format test has an invalid 'formatTraits' attribute. It should be of type 'string' or 'string[]'.`);
    });
  });

  it("Bad decimal separator type", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      precision: 12,
      type: "Decimal",
      uomSeparator: " ",
      decimalSeparator: 2,
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The Format test has an invalid 'decimalSeparator' attribute. It should be of type 'string'.`);
    });
  });

  it("Bad decimal separator value", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      precision: 12,
      type: "Decimal",
      uomSeparator: " ",
      decimalSeparator: "**",
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The Format test has an invalid 'decimalSeparator' attribute. It must be a one character string.`);
    });
  });

  it("Good decimal separator value", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      precision: 12,
      type: "Decimal",
      uomSeparator: " ",
      decimalSeparator: " ",
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch(() => {
      assert.isTrue(false);
    });
  });

  it("Bad thousand separator type", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      precision: 12,
      type: "Decimal",
      uomSeparator: " ",
      thousandSeparator: 2,
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The Format test has an invalid 'thousandSeparator' attribute. It should be of type 'string'.`);
    });
  });

  it("Bad thousand separator value", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      precision: 12,
      type: "Decimal",
      uomSeparator: " ",
      thousandSeparator: "**",
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The Format test has an invalid 'thousandSeparator' attribute. It must be a one character string.`);
    });
  });

  it("Good thousand separator value", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      precision: 12,
      type: "Decimal",
      uomSeparator: " ",
      thousandSeparator: " ",
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch(() => {
      assert.isTrue(false);
    });
  });

  it("Bad uom separator type", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      precision: 12,
      type: "Decimal",
      uomSeparator: 1,
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The Format test has an invalid 'uomSeparator' attribute. It should be of type 'string'.`);
    });
  });

  it("Bad uom separator value", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      precision: 12,
      type: "Decimal",
      uomSeparator: "**",
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The Format test has an invalid 'uomSeparator' attribute. It must be empty or a string with a single character.`);
    });
  });

  it("Good uom separator value", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      precision: 12,
      type: "Decimal",
      uomSeparator: " ",
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch(() => {
      assert.isTrue(false);
    });
  });

  it("Bad station separator type", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      precision: 12,
      uomSeparator: " ",
      stationOffsetSize: 2,
      type: "Station",
      stationSeparator: 1
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The Format test has an invalid 'stationSeparator' attribute. It should be of type 'string'.`);
    });
  });

  it("Bad station separator value", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      precision: 12,
      uomSeparator: " ",
      stationOffsetSize: 2,
      type: "Station",
      stationSeparator: "**"
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The Format test has an invalid 'stationSeparator' attribute. It must be a one character string.`);
    });
  });

  it("Good station separator value", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      precision: 12,
      uomSeparator: " ",
      stationOffsetSize: 2,
      type: "Station",
      stationSeparator: "+"
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch(() => {
      assert.isTrue(false);
    });
  });

  it("Scientific type is required", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 8,
      type: "Scientific",
      uomSeparator: " ",
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The Format test has type 'Scientific' therefore attribute 'scientificType' is required.`);
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
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The Format test has an invalid 'SCIENTIFIC_TYPE' attribute.`);
    });
  });

  it("Scientific type (string) is required", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 8,
      type: "Scientific",
      scientificType: 1,
      uomSeparator: " ",
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The Format test has an invalid 'scientificType' attribute. It should be of type 'string'.`);
    });
  });

  it("Bad Composite Units", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      composite: {
        includeZero: true,
        spacer: "",
        units: "bad"
      },
      formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      precision: 8,
      type: "Fractional",
      uomSeparator: "",
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The Format test has a Composite with an invalid 'units' attribute. It must be of type 'array'`);
    });
  });

  it("Null Composite Units", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      composite: {
        includeZero: true,
        spacer: "",
      },
      formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      precision: 8,
      type: "Fractional",
      uomSeparator: "",
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The Format test has a Composite with no valid 'units'`);
    });
  });

  it("No Composite Units", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      composite: {
        includeZero: true,
        spacer: "",
        units: []
      },
      formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      precision: 8,
      type: "Fractional",
      uomSeparator: "",
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The Format test has a Composite with no valid 'units'`);
    });
  });

  it("Invalid Composite Units (name)", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          {
            label: "'",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      precision: 8,
      type: "Fractional",
      uomSeparator: "",
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `This Composite has a unit with an invalid 'name' or 'label' attribute.`);
    });
  });

  it("Invalid Composite Units (label)", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          {
            label: 1,
            name: "Units.FT",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      precision: 8,
      type: "Fractional",
      uomSeparator: "",
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `This Composite has a unit with an invalid 'name' or 'label' attribute.`);
    });
  });

  it("Invalid Composite Unit name", async () => {
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
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `Invalid unit name 'Units.F'.`);
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
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The unit Units.FT has a duplicate name.`);
    });
  });

  it("Missing station offset", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: ["trailZeroes", "keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      minWidth: 2,
      precision: 2,
      type: "Station",
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The Format test has type 'Station' therefore attribute 'stationOffsetSize' is required.`);
    });
  });

  it("Bad station offset type", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: ["trailZeroes", "keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
      minWidth: 2,
      precision: 2,
      stationOffsetSize: "2",
      type: "Station",
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The Format test has an invalid 'stationOffsetSize' attribute. It should be of type 'number'.`);
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
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The Format test has an invalid 'stationOffsetSize' attribute. It should be a positive integer.`);
    });
  });

  it("Bad includeZero in Composite", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      composite: {
        includeZero: 1,
        spacer: "-",
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
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The Format test has a Composite with an invalid 'includeZero' attribute. It should be of type 'boolean'.`);
    });
  });

  it("Bad spacer (not a string) in Composite", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      composite: {
        includeZero: true,
        spacer: 1,
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
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The Format test has a Composite with an invalid 'spacer' attribute. It must be of type 'string'.`);
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
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json).catch((err) => {
      assert.isTrue(err instanceof QuantityError && err.message === `The Format test has a Composite with an invalid 'spacer' attribute. It must be empty or a string with a single character.`);
    });
  });

  it("Read/Write All Format Traits", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: ["trailZeroes", "keepSingleZero", "zeroEmpty", "keepDecimalPoint", "applyRounding", "fractionDash", "showUnitLabel", "prependUnitLabel", "use1000Separator", "exponentOnlyNegative"],
      precision: 8,
      type: "Decimal",
      uomSeparator: " ",
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json);
    assert.isTrue(testFormat.hasFormatTraitSet(FormatTraits.ApplyRounding));
    assert.isTrue(testFormat.hasFormatTraitSet(FormatTraits.ExponentOnlyNegative));
    assert.isTrue(testFormat.hasFormatTraitSet(FormatTraits.FractionDash));
    assert.isTrue(testFormat.hasFormatTraitSet(FormatTraits.KeepDecimalPoint));
    assert.isTrue(testFormat.hasFormatTraitSet(FormatTraits.KeepSingleZero));
    assert.isTrue(testFormat.hasFormatTraitSet(FormatTraits.PrependUnitLabel));
    assert.isTrue(testFormat.hasFormatTraitSet(FormatTraits.ShowUnitLabel));
    assert.isTrue(testFormat.hasFormatTraitSet(FormatTraits.TrailZeroes));
    assert.isTrue(testFormat.hasFormatTraitSet(FormatTraits.Use1000Separator));
    assert.isTrue(testFormat.hasFormatTraitSet(FormatTraits.ZeroEmpty));

    const outJson = testFormat.toJson();
    assert.isTrue(outJson["formatTraits"].length === 10);
  });

  it("Read/Write Empty Format Traits", async () => {
    const unitsProvider = new TestUnitsProvider();

    const json = {
      formatTraits: [],
      precision: 8,
      type: "Decimal",
      uomSeparator: " ",
    }
    const testFormat = new Format("test");

    await testFormat.fromJson(unitsProvider, json);
    assert.isFalse(testFormat.hasFormatTraitSet(FormatTraits.ApplyRounding));
    assert.isFalse(testFormat.hasFormatTraitSet(FormatTraits.ExponentOnlyNegative));
    assert.isFalse(testFormat.hasFormatTraitSet(FormatTraits.FractionDash));
    assert.isFalse(testFormat.hasFormatTraitSet(FormatTraits.KeepDecimalPoint));
    assert.isFalse(testFormat.hasFormatTraitSet(FormatTraits.KeepSingleZero));
    assert.isFalse(testFormat.hasFormatTraitSet(FormatTraits.PrependUnitLabel));
    assert.isFalse(testFormat.hasFormatTraitSet(FormatTraits.ShowUnitLabel));
    assert.isFalse(testFormat.hasFormatTraitSet(FormatTraits.TrailZeroes));
    assert.isFalse(testFormat.hasFormatTraitSet(FormatTraits.Use1000Separator));
    assert.isFalse(testFormat.hasFormatTraitSet(FormatTraits.ZeroEmpty));

    const outJson = testFormat.toJson();
    assert.isTrue(outJson["formatTraits"].length === 0);
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
      await format.fromJson(unitsProvider, formatData).catch(() => { });
      if (formatData.hasOwnProperty("precision"))
        assert.isTrue(format.precision === formatData.precision);
      assert.isTrue(Format.formatTypeToString(format.type).toUpperCase() === formatData.type.toUpperCase());
      if (formatData.hasOwnProperty("uomSeparator"))
        assert.isTrue(format.uomSeparator === formatData.uomSeparator);
      for (const traitStr of formatData.formatTraits) {
        const traitToValidate: FormatTraits = Format.parseFormatTrait(traitStr, 0);
        assert.isTrue(format.hasFormatTraitSet(traitToValidate));
      }

      if (formatData.hasOwnProperty("composite")) {
        assert.isTrue(format.hasUnits === true);
        assert.isTrue(format.units!.length === formatData.composite!.units.length);
      }

      const jsonData = format.toJson();
      assert.isTrue(jsonData.type.toUpperCase() === Format.formatTypeToString(format.type).toUpperCase());
      if (formatData.hasOwnProperty("showSignOption")) {
        assert.isTrue(formatData.showSignOption!.toUpperCase() === jsonData.showSignOption.toUpperCase());
      }
    }
  });

});
