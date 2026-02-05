import { QuantityFormatter } from "@itwin/core-frontend";
import { BasicUnit, Format, FormatterSpec } from "@itwin/core-quantity";
import { assert } from "chai";


describe('Formatting examples', () => {
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
});

