import { Logger } from "@itwin/core-bentley";
import { describe, expect, it, vi } from "vitest";
import { BasicUnitsProvider, Format, type FormatProps, FormatterSpec, QuantityLoggerCategory, type UnitProps } from "../core-quantity";

class ErroringConversionProvider extends BasicUnitsProvider {
  public override async getConversion() {
    return { factor: 1.0, offset: 0.0, error: true };
  }

  public override getConversionSync() {
    return { factor: 1.0, offset: 0.0, error: true };
  }
}

describe("synchronous quantity formatting", () => {
  const provider = new BasicUnitsProvider();

  it("resolves canonical units and conversions synchronously", async () => {
    const meter = provider.findUnitByNameSync("Units.M");
    const foot = provider.findUnitByNameSync("Units.FT");

    expect(meter.isValid).toBe(true);
    expect(meter.label).toBe("m");
    expect(provider.findUnitByNameSync("Units.NOT_A_UNIT").isValid).toBe(false);

    const syncConversion = provider.getConversionSync(meter, foot);
    const asyncConversion = await provider.getConversion(meter, foot);
    expect(syncConversion.factor).toBeCloseTo(asyncConversion.factor, 12);
    expect(syncConversion.offset).toBeCloseTo(asyncConversion.offset, 12);
    expect(syncConversion.error).toBe(asyncConversion.error);

    const seconds = provider.findUnitByNameSync("Units.S");
    expect(provider.getConversionSync(meter, seconds)).toEqual({ factor: 1.0, offset: 0.0, error: true });

    const customUnit: UnitProps = {
      name: "Custom.M",
      label: "custom m",
      phenomenon: meter.phenomenon,
      isValid: true,
      system: meter.system,
    };
    expect(provider.getConversionSync(customUnit, meter)).toEqual({ factor: 1.0, offset: 0.0, error: true });
  });

  it("matches asynchronous format and FormatterSpec construction", async () => {
    const cases: Array<{ name: string; props: FormatProps; inputUnit: string; value: number }> = [
      {
        name: "Decimal",
        props: {
          type: "Decimal",
          precision: 2,
          formatTraits: ["showUnitLabel"],
          composite: { units: [{ name: "Units.FT", label: "ft" }] },
        },
        inputUnit: "Units.M",
        value: 1.25,
      },
      {
        name: "Composite",
        props: {
          type: "Decimal",
          precision: 0,
          formatTraits: ["showUnitLabel"],
          composite: {
            spacer: " ",
            units: [
              { name: "Units.FT", label: "'" },
              { name: "Units.IN", label: "\"" },
            ],
          },
        },
        inputUnit: "Units.M",
        value: 1.5,
      },
      {
        name: "Ratio",
        props: {
          type: "Ratio",
          ratioType: "NToOne",
          precision: 2,
          composite: {
            units: [
              { name: "Units.FT" },
              { name: "Units.IN" },
            ],
          },
        },
        inputUnit: "Units.FT",
        value: 2,
      },
      {
        name: "Bearing",
        props: {
          type: "Bearing",
          precision: 2,
          revolutionUnit: "Units.REVOLUTION",
          composite: { units: [{ name: "Units.ARC_DEG", label: "°" }] },
        },
        inputUnit: "Units.RAD",
        value: Math.PI / 4,
      },
      {
        name: "Azimuth",
        props: {
          type: "Azimuth",
          precision: 2,
          azimuthBase: 90,
          azimuthBaseUnit: "Units.ARC_DEG",
          revolutionUnit: "Units.REVOLUTION",
          composite: { units: [{ name: "Units.ARC_DEG", label: "°" }] },
        },
        inputUnit: "Units.RAD",
        value: Math.PI / 4,
      },
      {
        name: "NumericOnly",
        props: { type: "Decimal", precision: 3 },
        inputUnit: "Units.M",
        value: 1.25,
      },
    ];

    for (const testCase of cases) {
      const syncFormat = Format.createFromJSONSync(testCase.name, provider, testCase.props);
      const asyncFormat = await Format.createFromJSON(testCase.name, provider, testCase.props);
      expect(syncFormat.toJSON()).toEqual(asyncFormat.toJSON());

      const inputUnit = provider.findUnitByNameSync(testCase.inputUnit);
      const syncSpec = FormatterSpec.createSync(testCase.name, syncFormat, provider, inputUnit);
      const asyncSpec = await FormatterSpec.create(testCase.name, asyncFormat, provider, inputUnit);
      expect(syncSpec.applyFormatting(testCase.value)).toBe(asyncSpec.applyFormatting(testCase.value));
    }
  });

  it("preserves ratio conversion errors in synchronous and asynchronous specs", async () => {
    const erroringProvider = new ErroringConversionProvider();
    const props: FormatProps = {
      type: "Ratio",
      ratioType: "NToOne",
      composite: { units: [{ name: "Units.FT" }, { name: "Units.IN" }] },
    };
    const syncFormat = Format.createFromJSONSync("Ratio", erroringProvider, props);
    const asyncFormat = await Format.createFromJSON("Ratio", erroringProvider, props);
    const syncInputUnit = erroringProvider.findUnitByNameSync("Units.FT");
    const asyncInputUnit = await erroringProvider.findUnitByName("Units.FT");

    const warnings = vi.spyOn(Logger, "logWarning");
    try {
      const syncSpec = FormatterSpec.createSync("Ratio", syncFormat, erroringProvider, syncInputUnit);
      const asyncSpec = await FormatterSpec.create("Ratio", asyncFormat, erroringProvider, asyncInputUnit);

      expect(syncSpec.unitConversions[0].conversion).toEqual({ factor: 1.0, offset: 0.0, error: true });
      expect(asyncSpec.unitConversions[0].conversion).toEqual({ factor: 1.0, offset: 0.0, error: true });
      const warning = [QuantityLoggerCategory.Formatting, `Unit conversion from "Units.IN" to "Units.FT" could not be resolved.`];
      expect(warnings.mock.calls).toEqual([warning, warning]);
    } finally {
      warnings.mockRestore();
    }
  });

  it("rejects unavailable units without awaiting", () => {
    expect(() => Format.createFromJSONSync("Invalid", provider, {
      type: "Decimal",
      composite: { units: [{ name: "Custom.M" }] },
    })).toThrow("Invalid unit name 'Custom.M'.");
  });

  it("accepts a non-string composite unit label in both factories, matching master", async () => {
    const props = JSON.parse(`{"type":"Decimal","composite":{"units":[{"name":"Units.M","label":null}]}}`) as FormatProps;
    await expect(Format.createFromJSON("NullLabel", provider, props)).resolves.toBeInstanceOf(Format);
    expect(Format.createFromJSONSync("NullLabel", provider, props)).toBeInstanceOf(Format);
  });
});
