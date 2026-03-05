import { Format, ParsedQuantity, Parser, ParserSpec } from "@itwin/core-quantity";
import { QuantityFormatter } from "../../../quantity-formatting/QuantityFormatter";
import { describe, expect, it } from "vitest";

describe("Parsing examples", () => {

  it("Simple Parsing", async () => {
    // __PUBLISH_EXTRACT_START__ Quantity_Formatting.Simple_Parsing
    const quantityFormatter = new QuantityFormatter();
    const unitsProvider = quantityFormatter.unitsProvider;
    // define output/persistence unit and also used to determine the unit family used during parsing
    const outUnit = await unitsProvider.findUnitByName("Units.M");

    const formatData = {
      composite: {
        includeZero: true,
        spacer: "-",
        units: [{ label: "'", name: "Units.FT" }, { label: "\"", name: "Units.IN" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 8,
      type: "Fractional",
      uomSeparator: "",
    };

    // generate a Format from FormatProps used to determine possible labels
    const format = new Format("test");
    await format.fromJSON(unitsProvider, formatData);

    const inString = "2FT 6IN";

    // create the parserSpec spec which will hold all unit conversions from possible units to the output unit
    const parserSpec = await ParserSpec.create(format, unitsProvider, outUnit);
    const parseResult = parserSpec.parseToQuantityValue(inString);
    //  parseResult.value 0.762  (meters)
    // __PUBLISH_EXTRACT_END__

    expect((parseResult as ParsedQuantity).value).toBe(0.762);
  });

  it("Basic math operations parsing", async () => {
    // __PUBLISH_EXTRACT_START__ Quantity_Formatting.Basic_Math_Operations_Parsing
    const quantityFormatter = new QuantityFormatter();
    const unitsProvider = quantityFormatter.unitsProvider;
    const formatData = {
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 8,
      type: "Fractional",
      uomSeparator: "",
      allowMathematicOperations: true,
    };

    const format = new Format("exampleFormat");
    await format.fromJSON(unitsProvider, formatData);
    // Operation containing many units (feet, inches, yards).
    const mathematicalOperation = "5 ft + 12 in + 1 yd -1 ft 6 in";

    // Asynchronous implementation
    const quantityProps = await Parser.parseIntoQuantity(mathematicalOperation, format, unitsProvider);
    // quantityProps.magnitude 7.5 (value in feet)
    // __PUBLISH_EXTRACT_END__

    expect(quantityProps.magnitude).toBe(7.5);
  });

  it("Math Operations Whitespace", async () => {
    // __PUBLISH_EXTRACT_START__ Quantity_Formatting.Math_Whitespace_Limitation
    const formatProps = {
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 8,
      type: "Fractional",
      uomSeparator: "",
      allowMathematicOperations: true,
      composite: {
        includeZero: true,
        spacer: "-", // When omitted, the spacer defaults to " "
        units: [
          {
            label: "FT",
            name: "Units.FT",
          },
          {
            label: `IN`,
            name: "Units.IN",
          },
        ],
      },
    };

    const quantityFormatter = new QuantityFormatter();
    const unitsProvider = quantityFormatter.unitsProvider;
    const format = await Format.createFromJSON("mathAllowedFormat", unitsProvider, formatProps);
    const outUnit = await unitsProvider.findUnit("m", "Units");
    const parserSpec = await ParserSpec.create(format, unitsProvider, outUnit);
    // The spacer property from formatProps is ignored, so the two results below are the same.
    const result = parserSpec.parseToQuantityValue("-2FT-6IN + 6IN"); // -0.6096 meters
    const result2 = parserSpec.parseToQuantityValue("-2FT 6IN + 6IN"); // -0.6096 meters
    // __PUBLISH_EXTRACT_END__

    expect((result as ParsedQuantity).value).toBe(-0.6096);
    expect((result as ParsedQuantity).value).toBe((result2 as ParsedQuantity).value);
  });

  it("Math Operations Composite", async () => {
    // __PUBLISH_EXTRACT_START__ Quantity_Formatting.Math_Composite_Limitation

    const formatProps = {
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 8,
      type: "Fractional",
      uomSeparator: "",
      allowMathematicOperations: true,
      composite: {
        includeZero: true,
        spacer: "-", // When omitted, the spacer defaults to " "
        units: [
          {
            label: "FT",
            name: "Units.FT",
          },
          {
            label: `IN`,
            name: "Units.IN",
          },
        ],
      },
    };

    const quantityFormatter = new QuantityFormatter();
    const unitsProvider = quantityFormatter.unitsProvider;
    const format = await Format.createFromJSON("mathAllowedFormat", unitsProvider, formatProps);
    const outUnit = await unitsProvider.findUnit("m", "Units");
    const parserSpec = await ParserSpec.create(format, unitsProvider, outUnit);
    // The spacer property from formatProps is ignored, so the two results below are the same.
    const result = parserSpec.parseToQuantityValue("2FT 6IN-0.5"); // 2.5 FT and 0.5 FT -> 0.9144 meters
    const result2 = parserSpec.parseToQuantityValue("2FT 6IN + 6IN"); // 0.9144 meters
    // __PUBLISH_EXTRACT_END__

    expect((result as ParsedQuantity).value).toBe(0.9144);
    expect((result as ParsedQuantity).value).toBe((result2 as ParsedQuantity).value);
  });
});
