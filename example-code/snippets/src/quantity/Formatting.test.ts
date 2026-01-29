import { IModelApp, NoRenderApp, QuantityFormatter } from "@itwin/core-frontend";
import { BasicUnit, Format, FormatterSpec, ParserSpec } from "@itwin/core-quantity";
import { assert } from "chai";


describe('Formatting examples', () => {

  before(async () => {
    // configure QuantityFormatter for the examples
    await NoRenderApp.startup();
  });

  after(async () => {
    await IModelApp.shutdown();
  });

  it("Numeric Formatting", async () => {
    // __PUBLISH_EXTRACT_START__ Quantity_Formatting.Numeric
    const quantityFormatter = new QuantityFormatter();
    const unitsProvider = quantityFormatter.unitsProvider;
    const formatData = {
      formatTraits: ["keepSingleZero", "applyRounding", "showUnitLabel", "trailZeroes", "use1000Separator"],
      precision: 4,
      type: "Decimal",
      uomSeparator: " ",
      thousandSeparator: ",",
      decimalSeparator: ".",
    };

    // generate a Format from FormatProps to display 4 decimal place value
    const format = new Format("4d");
    // load the format props into the format, since unit provider is used to validate units the call must be asynchronous.
    await format.fromJSON(unitsProvider, formatData);

    // define input/output unit
    const unitName = "Units.FT";
    const unitLabel = "ft";
    const unitFamily = "Units.LENGTH";
    const inUnit = new BasicUnit(unitName, unitLabel, unitFamily);

    const magnitude = -12.5416666666667;

    // create the formatter spec - the name is not used by the formatter it is only
    // provided so user can cache formatter spec and then retrieve spec via its name.
    const spec = await FormatterSpec.create("test", format, unitsProvider, inUnit);

    // apply the formatting held in FormatterSpec
    const formattedValue = spec.applyFormatting(magnitude);
    // result in formattedValue of "-12.5417 ft"
    // __PUBLISH_EXTRACT_END__

    assert.equal(formattedValue, "-12.5417 ft");
  });

  it("Composite Formatting", async () => {
    // __PUBLISH_EXTRACT_START__ Quantity_Formatting.Composite
    const quantityFormatter = new QuantityFormatter();
    const unitsProvider = quantityFormatter.unitsProvider;
    const formatData = {
      composite: {
        includeZero: true,
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
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 8,
      type: "Fractional",
      uomSeparator: "",
    };

    // generate a Format from FormatProps to display feet and inches
    const format = new Format("fi8");
    // load the format props into the format, since unit provider is used to validate units the call must be asynchronous.
    await format.fromJSON(unitsProvider, formatData);

    // define input unit
    const unitName = "Units.M";
    const unitLabel = "m";
    const unitFamily = "Units.LENGTH";
    const inUnit = new BasicUnit(unitName, unitLabel, unitFamily);

    const magnitude = 1.0;

    // create the formatter spec - the name is not used by the formatter it is only
    // provided so user can cache formatter spec and then retrieve spec via its name.
    const spec = await FormatterSpec.create("test", format, unitsProvider, inUnit);

    // apply the formatting held in FormatterSpec
    const formattedValue = spec.applyFormatting(magnitude);
    // result in formattedValue of 3'-3 3/8"
    // __PUBLISH_EXTRACT_END__

    assert.equal(formattedValue, "3'-3 3/8\"");
  });

  it("General Pattern - Complete Workflow", async () => {
    // Step 1: Get FormatProps with fallback
    // __PUBLISH_EXTRACT_START__ Quantity_Formatting.General_Pattern_Get_FormatProps
    await IModelApp.quantityFormatter.setActiveUnitSystem("metric"); // When the default formats provider is used, ensure the desired unit system is active

    let formatProps = await IModelApp.formatsProvider.getFormat("DefaultToolsUnits.LENGTH");
    if (!formatProps) {
      // Fallback: Define a hardcoded format for your tool
      formatProps = {
        composite: {
          units: [{ label: "m", name: "Units.M" }]
        },
        precision: 1,
        type: "Decimal"
      };
    }
    // __PUBLISH_EXTRACT_END__

    // Step 2: Convert to Format and get persistence unit
    // __PUBLISH_EXTRACT_START__ Quantity_Formatting.General_Pattern_Convert_To_Format
    const unitsProvider = IModelApp.quantityFormatter.unitsProvider;
    const format = new Format("length");
    await format.fromJSON(unitsProvider, formatProps);
    const persistenceUnit = await unitsProvider.findUnitByName("Units.M");
    // __PUBLISH_EXTRACT_END__

    // Step 3: Create specs
    // __PUBLISH_EXTRACT_START__ Quantity_Formatting.General_Pattern_Create_Specs
    const formatterSpec = await FormatterSpec.create("length", format, unitsProvider, persistenceUnit);
    const parserSpec = await ParserSpec.create(format, unitsProvider, persistenceUnit);
    // __PUBLISH_EXTRACT_END__



    // __PUBLISH_EXTRACT_START__ Quantity_Formatting.General_Pattern_Format_Parse
    const value = 5.5;
    const userInput = "10.5 m";
    const formatted = formatterSpec.applyFormatting(value); // "5.5000 m"
    const parsed = parserSpec.parseToQuantityValue(userInput); // 10.5
    // __PUBLISH_EXTRACT_END__

    assert.equal(formatted, "5.5 m");
    assert.isTrue(parsed.ok);
    if (parsed.ok) {
      assert.equal(parsed.value, 10.5);
    }
  });
});

