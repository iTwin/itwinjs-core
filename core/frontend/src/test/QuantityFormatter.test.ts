/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { assert as bAssert } from "@itwin/core-bentley";
import { EmptyLocalization } from "@itwin/core-common";
import { FormattingReadyCollector, ParsedQuantity, Parser, UnitProps } from "@itwin/core-quantity";
import { IModelApp } from "../IModelApp";
import { LocalUnitFormatProvider } from "../quantity-formatting/LocalUnitFormatProvider";
import { OverrideFormatEntry, QuantityFormatter, QuantityType, QuantityTypeArg, QuantityTypeFormatsProvider } from "../quantity-formatting/QuantityFormatter";
import { BearingQuantityType } from "./BearingQuantityType";

function withinTolerance(x: number, y: number, tolerance?: number): boolean {
  const tol: number = undefined !== tolerance ? tolerance : 0.1e-6;
  const z = x - y;
  return z >= -tol && z <= tol;
}

/** setup a local storage mock that contains a unit system and QuantityType.Length override format */
const storageMock = () => {
  const storage: { [key: string]: any } = {
    "quantityTypeFormat#user#q:QuantityTypeEnumValue-1": `{"metric":{"type":"Decimal","precision":2,"roundFactor":0,"showSignOption":"OnlyNegative","formatTraits":["keepSingleZero","showUnitLabel"],"decimalSeparator":".","thousandSeparator":",","uomSeparator":" ","stationSeparator":"+","composite":{"spacer":"","includeZero":true,"units":[{"name":"Units.CM","label":"cm"}]}}}`,
    "unitsystem#user": "metric",
  };

  return {
    setItem: (key: string, value: string) => {
      storage[key] = value || "";
    },
    getItem: (key: string) => {
      return key in storage ? storage[key] : null;
    },
    removeItem: (key: string) => {
      delete storage[key];
    },
    get length() {
      return Object.keys(storage).length;
    },
    key: (i: number) => {
      const keys = Object.keys(storage);
      return keys[i] || null;
    },
  };
};

describe("Quantity formatter", async () => {
  let quantityFormatter: QuantityFormatter;
  const propertyDescriptorToRestore = Object.getOwnPropertyDescriptor(window, "localStorage")!;
  const myLocalStorage = storageMock();

  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
    Object.defineProperty(window, "localStorage", {
      get: () => myLocalStorage,
    });
  });

  beforeEach(async () => {
    quantityFormatter = new QuantityFormatter();
    await quantityFormatter.onInitialized();
  });

  afterAll(async () => {
    // restore the overriden property getter
    Object.defineProperty(window, "localStorage", propertyDescriptorToRestore);
    await IModelApp.shutdown();
  });

  it("Length should honor overrides from LocalUnitFormatProvider", async () => {
    // set the units settings provider that will set the QuantityFormatter to "metric" and provide overrides to display "cm"
    await quantityFormatter.setUnitFormattingSettingsProvider(new LocalUnitFormatProvider(quantityFormatter, false));

    const expected = `12345.6 cm`;
    const newFormatterSpec = quantityFormatter.findFormatterSpecByQuantityType(QuantityType.Length);
    expect(newFormatterSpec).toBeDefined();
    const actual = quantityFormatter.formatQuantity(123.456, newFormatterSpec);
    expect(actual).toBe(expected);
  });

  it("Length default parser should handle format", async () => {
    const numericVal = 6.2484; // 20'-6" in meters

    await quantityFormatter.setActiveUnitSystem("imperial");
    expect(quantityFormatter.activeUnitSystem).toBe("imperial");
    const imperialParserSpec = await quantityFormatter.getParserSpecByQuantityType(QuantityType.Length);
    const imperialFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Length);
    const stringVal = quantityFormatter.formatQuantity(numericVal, imperialFormatSpec);
    expect(stringVal).toBe(`20'-6"`);
    const parsedVal = quantityFormatter.parseToQuantityValue(stringVal, imperialParserSpec);
    expect(parsedVal.ok).toBe(true);
    expect(withinTolerance((parsedVal as ParsedQuantity).value, numericVal)).toBe(true);
  });

  it("Save overrides to localStorage", async () => {
    const overrideLengthAndCoordinateEntry = {
      metric: {
        composite: {
          includeZero: true,
          spacer: " ",
          units: [{ label: "mm", name: "Units.MM" }],
        },
        formatTraits: ["keepSingleZero", "showUnitLabel"],
        precision: 4,
        type: "Decimal",
      },

    };

    // set the units settings provider that will set the QuantityFormatter to "metric" and provide overrides to display "cm"
    await quantityFormatter.setUnitFormattingSettingsProvider(new LocalUnitFormatProvider(quantityFormatter, false));

    let expected = `12345.6 cm`;
    let newFormatterSpec = quantityFormatter.findFormatterSpecByQuantityType(QuantityType.Length);
    expect(newFormatterSpec).toBeDefined();
    let actual = quantityFormatter.formatQuantity(123.456, newFormatterSpec);
    expect(actual).toBe(expected);

    // update the overrides to display "mm"
    expected = `123456 mm`;
    await quantityFormatter.setOverrideFormats(QuantityType.Length, overrideLengthAndCoordinateEntry);
    const storedOverride = JSON.parse(localStorage.getItem("quantityTypeFormat#user#q:QuantityTypeEnumValue-1")!) as OverrideFormatEntry;
    expect(storedOverride.metric?.composite?.units[0].label).toBe("mm");
    expect(storedOverride.metric?.composite?.units[0].name).toBe("Units.MM");

    newFormatterSpec = quantityFormatter.findFormatterSpecByQuantityType(QuantityType.Length);
    actual = quantityFormatter.formatQuantity(123.456, newFormatterSpec);
    expect(actual).toBe(expected);

    // now delete the overrides to restore to default of "m"
    expected = `123.456 m`;
    await quantityFormatter.clearOverrideFormats(QuantityType.Length);
    newFormatterSpec = quantityFormatter.findFormatterSpecByQuantityType(QuantityType.Length);
    actual = quantityFormatter.formatQuantity(123.456, newFormatterSpec);
    expect(actual).toBe(expected);

    expect(localStorage.getItem("quantityTypeFormat#user#q:QuantityTypeEnumValue-1")).toBeNull();
  });

  it("Length should be cached during onInitialized processing", async () => {
    const expected = `405'-0 1/2"`;
    const newFormatterSpec = quantityFormatter.findFormatterSpecByQuantityType(QuantityType.Length);
    expect(newFormatterSpec).toBeDefined();
    const actual = quantityFormatter.formatQuantity(123.456, newFormatterSpec);
    expect(actual).toBe(expected);
  });

  it("Length format spec retrieved asynchronously", async () => {
    const expected = `405'-0 1/2"`;
    const newFormatterSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Length);
    const actual = quantityFormatter.formatQuantity(123.456, newFormatterSpec);
    expect(actual).toBe(expected);
  });

  it("Set and use length override format", async () => {
    const overrideLengthAndCoordinateEntry = {
      metric: {
        composite: {
          includeZero: true,
          spacer: " ",
          units: [{ label: "cm", name: "Units.CM" }],
        },
        formatTraits: ["keepSingleZero", "showUnitLabel"],
        precision: 4,
        type: "Decimal",
      },
      imperial: {
        composite: {
          includeZero: true,
          spacer: " ",
          units: [{ label: "in", name: "Units.IN" }],
        },
        formatTraits: ["keepSingleZero", "showUnitLabel"],
        precision: 4,
        type: "Decimal",
      },
    };

    const metricFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Length, false);
    const metricFormattedValue = quantityFormatter.formatQuantity(1.5, metricFormatSpec);
    expect(metricFormattedValue).toBe("1.5 m");

    const imperialFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Length, true);
    const imperialFormattedValue = quantityFormatter.formatQuantity(1.5, imperialFormatSpec);
    expect(imperialFormattedValue).toBe(`4'-11"`);

    await quantityFormatter.setOverrideFormats(QuantityType.Length, overrideLengthAndCoordinateEntry);
    const overrideMetricFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Length, false);
    const overrideMetricFormattedValue = quantityFormatter.formatQuantity(1.5, overrideMetricFormatSpec);
    expect(overrideMetricFormattedValue).toBe("150 cm");

    const overrideImperialFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Length, true);
    const overrideImperialFormattedValue = quantityFormatter.formatQuantity(1.5, overrideImperialFormatSpec);
    expect(overrideImperialFormattedValue).toBe("59.0551 in");
    quantityFormatter.addAlternateLabels("Units.FT", "shoe", "sock");
    const alternateLabels = quantityFormatter.alternateUnitLabelsProvider.getAlternateUnitLabels({ name: "Units.FT" } as UnitProps);
    bAssert(undefined !== alternateLabels);
    expect(alternateLabels).toContain("shoe");
    expect(alternateLabels).toContain("sock");
    const overrideImperialParserSpec = await quantityFormatter.getParserSpecByQuantityType(QuantityType.Length, true);
    const overrideValueInMeters1 = quantityFormatter.parseToQuantityValue(`48"`, overrideImperialParserSpec);
    const overrideValueInMeters2 = quantityFormatter.parseToQuantityValue(`48 in`, overrideImperialParserSpec);
    const overrideValueInMeters3 = quantityFormatter.parseToQuantityValue(`4 ft`, overrideImperialParserSpec);
    const overrideValueInMeters4 = quantityFormatter.parseToQuantityValue(`4 shoe`, overrideImperialParserSpec);
    const overrideValueInMeters5 = quantityFormatter.parseToQuantityValue(`4 sock`, overrideImperialParserSpec);
    expect(Parser.isParsedQuantity(overrideValueInMeters1)).toBe(true);
    expect(Parser.isParsedQuantity(overrideValueInMeters2)).toBe(true);
    expect(Parser.isParsedQuantity(overrideValueInMeters3)).toBe(true);
    expect(Parser.isParsedQuantity(overrideValueInMeters4)).toBe(true);
    expect(Parser.isParsedQuantity(overrideValueInMeters5)).toBe(true);
    if (Parser.isParsedQuantity(overrideValueInMeters1) && Parser.isParsedQuantity(overrideValueInMeters2) &&
      Parser.isParsedQuantity(overrideValueInMeters3) && Parser.isParsedQuantity(overrideValueInMeters4)
      && Parser.isParsedQuantity(overrideValueInMeters5)) {
      expect(withinTolerance(overrideValueInMeters1.value, 1.2192)).toBe(true);
      expect(withinTolerance(overrideValueInMeters1.value, overrideValueInMeters2.value)).toBe(true);
      expect(withinTolerance(overrideValueInMeters3.value, overrideValueInMeters2.value)).toBe(true);
      expect(withinTolerance(overrideValueInMeters4.value, overrideValueInMeters5.value)).toBe(true);
    }
  });

  it("Set and use coordinate and length overrides format (Survey Feet) - deprecate way", async () => {
    const overrideLengthAndCoordinateEntry = {
      metric: {
        composite: {
          includeZero: true,
          spacer: " ",
          units: [{ label: "m", name: "Units.M" }],
        },
        formatTraits: ["keepSingleZero", "showUnitLabel"],
        precision: 4,
        type: "Decimal",
      },
      imperial: {
        composite: {
          includeZero: true,
          spacer: " ",
          units: [{ label: "ft (US Survey)", name: "Units.US_SURVEY_FT" }],
        },
        formatTraits: ["keepSingleZero", "showUnitLabel"],
        precision: 4,
        type: "Decimal",
      },
    };

    // deprecated way of passing in useImperial
    let metricFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Coordinate, false);
    let metricFormattedValue = quantityFormatter.formatQuantity(100000.0, metricFormatSpec);
    expect(metricFormattedValue).toBe("100000 m");

    let imperialFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Coordinate, true);
    let imperialFormattedValue = quantityFormatter.formatQuantity(100000.0, imperialFormatSpec);
    expect(imperialFormattedValue).toBe("328083.99 ft");

    await quantityFormatter.setOverrideFormats(QuantityType.Length, overrideLengthAndCoordinateEntry);
    await quantityFormatter.setOverrideFormats(QuantityType.Coordinate, overrideLengthAndCoordinateEntry);

    let overrideMetricFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Length, false);
    let overrideMetricFormattedValue = quantityFormatter.formatQuantity(100000.0, overrideMetricFormatSpec);
    expect(overrideMetricFormattedValue).toBe("100000 m");

    overrideMetricFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Coordinate, false);
    overrideMetricFormattedValue = quantityFormatter.formatQuantity(100000.0, overrideMetricFormatSpec);
    expect(overrideMetricFormattedValue).toBe("100000 m");

    let overrideImperialFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Length, true);
    let overrideImperialFormattedValue = quantityFormatter.formatQuantity(100000.0, overrideImperialFormatSpec);
    expect(overrideImperialFormattedValue).toBe("328083.3333 ft (US Survey)");

    overrideImperialFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Coordinate, true);
    overrideImperialFormattedValue = quantityFormatter.formatQuantity(100000.0, overrideImperialFormatSpec);
    expect(overrideImperialFormattedValue).toBe("328083.3333 ft (US Survey)");

    let overrideImperialParserSpec = await quantityFormatter.getParserSpecByQuantityType(QuantityType.Length, true);
    let overrideValueInMeters1 = quantityFormatter.parseToQuantityValue("328083.333333333 ft (US Survey)", overrideImperialParserSpec);
    let overrideValueInMeters2 = quantityFormatter.parseToQuantityValue("328083.333333333", overrideImperialParserSpec);
    expect(Parser.isParsedQuantity(overrideValueInMeters1)).toBe(true);
    expect(Parser.isParsedQuantity(overrideValueInMeters2)).toBe(true);
    if (Parser.isParsedQuantity(overrideValueInMeters1) && Parser.isParsedQuantity(overrideValueInMeters2)) {
      expect(withinTolerance(overrideValueInMeters1.value, 100000)).toBe(true);
      expect(withinTolerance(overrideValueInMeters1.value, overrideValueInMeters2.value)).toBe(true);
    }

    overrideImperialParserSpec = await quantityFormatter.getParserSpecByQuantityType(QuantityType.Coordinate, true);
    overrideValueInMeters1 = quantityFormatter.parseToQuantityValue("328083.333333333 ft (US Survey)", overrideImperialParserSpec);
    overrideValueInMeters2 = quantityFormatter.parseToQuantityValue("328083.333333333", overrideImperialParserSpec);
    expect(Parser.isParsedQuantity(overrideValueInMeters1)).toBe(true);
    expect(Parser.isParsedQuantity(overrideValueInMeters2)).toBe(true);
    if (Parser.isParsedQuantity(overrideValueInMeters1) && Parser.isParsedQuantity(overrideValueInMeters2)) {
      expect(withinTolerance(overrideValueInMeters1.value, 100000)).toBe(true);
      expect(withinTolerance(overrideValueInMeters1.value, overrideValueInMeters2.value)).toBe(true);
    }

    await quantityFormatter.clearAllOverrideFormats();
    metricFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Coordinate, false);
    metricFormattedValue = quantityFormatter.formatQuantity(100000.0, metricFormatSpec);
    expect(metricFormattedValue).toBe("100000 m");

    imperialFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Coordinate, true);
    imperialFormattedValue = quantityFormatter.formatQuantity(100000.0, imperialFormatSpec);
    expect(imperialFormattedValue).toBe("328083.99 ft");
  });

  it("Set and use coordinate and length overrides format (Survey Feet)", async () => {
    const overrideLengthAndCoordinateEntry = {
      metric: {
        composite: {
          includeZero: true,
          spacer: " ",
          units: [{ label: "m", name: "Units.M" }],
        },
        formatTraits: ["keepSingleZero", "showUnitLabel"],
        precision: 4,
        type: "Decimal",
      },
      imperial: {
        composite: {
          includeZero: true,
          spacer: " ",
          units: [{ label: "ft (US Survey)", name: "Units.US_SURVEY_FT" }],
        },
        formatTraits: ["keepSingleZero", "showUnitLabel"],
        precision: 4,
        type: "Decimal",
      },
    };

    await quantityFormatter.setActiveUnitSystem("metric");
    let metricFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Coordinate);
    let metricFormattedValue = quantityFormatter.formatQuantity(100000.0, metricFormatSpec);
    expect(metricFormattedValue).toBe("100000 m");

    await quantityFormatter.setActiveUnitSystem("imperial");
    let imperialFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Coordinate);
    let imperialFormattedValue = quantityFormatter.formatQuantity(100000.0, imperialFormatSpec);
    expect(imperialFormattedValue).toBe("328083.99 ft");

    await quantityFormatter.setOverrideFormats(QuantityType.Length, overrideLengthAndCoordinateEntry);
    await quantityFormatter.setOverrideFormats(QuantityType.Coordinate, overrideLengthAndCoordinateEntry);

    await quantityFormatter.setActiveUnitSystem("metric");
    let overrideMetricFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Length);
    let overrideMetricFormattedValue = quantityFormatter.formatQuantity(100000.0, overrideMetricFormatSpec);
    expect(overrideMetricFormattedValue).toBe("100000 m");

    overrideMetricFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Coordinate);
    overrideMetricFormattedValue = quantityFormatter.formatQuantity(100000.0, overrideMetricFormatSpec);
    expect(overrideMetricFormattedValue).toBe("100000 m");

    await quantityFormatter.setActiveUnitSystem("imperial");
    let overrideImperialFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Length);
    let overrideImperialFormattedValue = quantityFormatter.formatQuantity(100000.0, overrideImperialFormatSpec);
    expect(overrideImperialFormattedValue).toBe("328083.3333 ft (US Survey)");

    overrideImperialFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Coordinate);
    overrideImperialFormattedValue = quantityFormatter.formatQuantity(100000.0, overrideImperialFormatSpec);
    expect(overrideImperialFormattedValue).toBe("328083.3333 ft (US Survey)");

    let overrideImperialParserSpec = await quantityFormatter.getParserSpecByQuantityType(QuantityType.Length);
    let overrideValueInMeters1 = quantityFormatter.parseToQuantityValue("328083.333333333 ft (US Survey)", overrideImperialParserSpec);
    let overrideValueInMeters2 = quantityFormatter.parseToQuantityValue("328083.333333333", overrideImperialParserSpec);
    expect(Parser.isParsedQuantity(overrideValueInMeters1)).toBe(true);
    expect(Parser.isParsedQuantity(overrideValueInMeters2)).toBe(true);
    if (Parser.isParsedQuantity(overrideValueInMeters1) && Parser.isParsedQuantity(overrideValueInMeters2)) {
      expect(withinTolerance(overrideValueInMeters1.value, 100000)).toBe(true);
      expect(withinTolerance(overrideValueInMeters1.value, overrideValueInMeters2.value)).toBe(true);
    }

    overrideImperialParserSpec = await quantityFormatter.getParserSpecByQuantityType(QuantityType.Coordinate);
    overrideValueInMeters1 = quantityFormatter.parseToQuantityValue("328083.333333333 ft (US Survey)", overrideImperialParserSpec);
    overrideValueInMeters2 = quantityFormatter.parseToQuantityValue("328083.333333333", overrideImperialParserSpec);
    expect(Parser.isParsedQuantity(overrideValueInMeters1)).toBe(true);
    expect(Parser.isParsedQuantity(overrideValueInMeters2)).toBe(true);
    if (Parser.isParsedQuantity(overrideValueInMeters1) && Parser.isParsedQuantity(overrideValueInMeters2)) {
      expect(withinTolerance(overrideValueInMeters1.value, 100000)).toBe(true);
      expect(withinTolerance(overrideValueInMeters1.value, overrideValueInMeters2.value)).toBe(true);
    }

    await quantityFormatter.clearAllOverrideFormats();
    imperialFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Coordinate);
    imperialFormattedValue = quantityFormatter.formatQuantity(100000.0, imperialFormatSpec);
    expect(imperialFormattedValue).toBe("328083.99 ft");

    await quantityFormatter.setActiveUnitSystem("metric");
    metricFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Coordinate);
    metricFormattedValue = quantityFormatter.formatQuantity(100000.0, metricFormatSpec);
    expect(metricFormattedValue).toBe("100000 m");
  });

  it("Set and use area overrides format (Survey Feet)", async () => {
    const overrideEntry = {
      metric: {
        composite: {
          includeZero: true,
          spacer: " ",
          units: [{ label: "m²", name: "Units.SQ_M" }],
        },
        formatTraits: ["keepSingleZero", "showUnitLabel"],
        precision: 4,
        type: "Decimal",
      },
      imperial: {
        composite: {
          includeZero: true,
          spacer: " ",
          units: [{ label: "ft² (US Survey)", name: "Units.SQ_US_SURVEY_FT" }],
        },
        formatTraits: ["keepSingleZero", "showUnitLabel"],
        precision: 4,
        type: "Decimal",
      },
    };

    let metricFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Area, false);
    let metricFormattedValue = quantityFormatter.formatQuantity(100000.0, metricFormatSpec);
    expect(metricFormattedValue).toBe("100000 m²");

    let imperialFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Area, true);
    let imperialFormattedValue = quantityFormatter.formatQuantity(100000.0, imperialFormatSpec);
    expect(imperialFormattedValue).toBe("1076391.0417 ft²");

    await quantityFormatter.setOverrideFormats(QuantityType.Area, overrideEntry);

    const overrideMetricFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Area, false);
    const overrideMetricFormattedValue = quantityFormatter.formatQuantity(100000.0, overrideMetricFormatSpec);
    expect(overrideMetricFormattedValue).toBe("100000 m²");

    const overrideImperialFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Area, true);
    const overrideImperialFormattedValue = quantityFormatter.formatQuantity(100000.0, overrideImperialFormatSpec);
    expect(overrideImperialFormattedValue).toBe("1076386.7361 ft² (US Survey)");

    const overrideImperialParserSpec = await quantityFormatter.getParserSpecByQuantityType(QuantityType.Area, true);
    const overrideValueInMeters1 = quantityFormatter.parseToQuantityValue("1076386.7361", overrideImperialParserSpec);
    const overrideValueInMeters2 = quantityFormatter.parseToQuantityValue("1076386.7361 sussf", overrideImperialParserSpec);
    // console.log(`overrideValueInMeters1=${JSON.stringify(overrideValueInMeters1)}`);
    expect(Parser.isParsedQuantity(overrideValueInMeters1)).toBe(true);
    expect(Parser.isParsedQuantity(overrideValueInMeters2)).toBe(true);
    if (Parser.isParsedQuantity(overrideValueInMeters1) && Parser.isParsedQuantity(overrideValueInMeters2)) {
      expect(withinTolerance(overrideValueInMeters1.value, 100000, 1.0e-5)).toBe(true);
      expect(withinTolerance(overrideValueInMeters1.value, overrideValueInMeters2.value)).toBe(true);
    }

    await quantityFormatter.clearOverrideFormats(QuantityType.Area);

    metricFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Area, false);
    metricFormattedValue = quantityFormatter.formatQuantity(100000.0, metricFormatSpec);
    expect(metricFormattedValue).toBe("100000 m²");

    imperialFormatSpec = await quantityFormatter.getFormatterSpecByQuantityType(QuantityType.Area, true);
    imperialFormattedValue = quantityFormatter.formatQuantity(100000.0, imperialFormatSpec);
    expect(imperialFormattedValue).toBe("1076391.0417 ft²");
  });

  it("creates a formatterSpec given a persistence unit name and a formatProps", async () => {
    const formatProps = {
      type: "Decimal",
      precision: 2,
      roundFactor: 0,
      showSignOption: "OnlyNegative",
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      decimalSeparator: ".",
      thousandSeparator: ",",
      uomSeparator: " ",
      stationSeparator: "+",
    };
    const unitName = "Units.MILE";
    const formatterSpec = await quantityFormatter.createFormatterSpec({
      persistenceUnitName: "Units.MILE",
      formatProps,
      formatName: "mile",
    });
    expect(formatterSpec).toBeDefined();
    expect(formatterSpec.name).toBe("mile_format_spec");
    expect(formatterSpec.persistenceUnit.name).toBe(unitName);
  });

  it("creates a parserSpec given a persistence unit name and a formatProps", async () => {
    const formatProps = {
      type: "Decimal",
      precision: 2,
      roundFactor: 0,
      showSignOption: "OnlyNegative",
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      decimalSeparator: ".",
      thousandSeparator: ",",
      uomSeparator: " ",
      stationSeparator: "+",
    };
    const unitName = "Units.MILE";
    const parserSpec = await quantityFormatter.createParserSpec({
      persistenceUnitName: "Units.MILE",
      formatProps,
      formatName: "mile",
    });
    expect(parserSpec).toBeDefined();
    expect(parserSpec.format.name).toBe("mile");
    expect(parserSpec.outUnit.name).toBe(unitName);
  });

  it("formats a quantity given a value, a persistence unit name and a koq name", async () => {
    const quantityString = await quantityFormatter.formatQuantity({
      value: 0.3048,
      valueUnitName: "Units.M",
      kindOfQuantityName: "DefaultToolsUnits.LENGTH"
    });

    expect(quantityString).toBe("1'-0\"");
  });

  it("parses a quantity given a value, a persistence unit name and a koq name", async () => {
    const parsedQuantity = await quantityFormatter.parseToQuantityValue({
      value: "1'-0\"",
      valueUnitName: "Units.M",
      kindOfQuantityName: "DefaultToolsUnits.LENGTH"
    });

    expect(parsedQuantity).toBeDefined();
    expect(Parser.isParsedQuantity(parsedQuantity)).toBe(true);
    if (Parser.isParsedQuantity(parsedQuantity))
      expect(parsedQuantity.value).toBe(0.3048);
  });

  it("should be able to get formatSpec for DefaultToolsUnits.LENGTH_COORDINATE", async () => {
    const specsMap = quantityFormatter.getSpecsByName("DefaultToolsUnits.LENGTH_COORDINATE");
    expect(specsMap).toBeDefined();
    const formatSpec = specsMap?.get("Units.M");
    expect(formatSpec).toBeDefined();
    expect(formatSpec?.formatterSpec).toBeDefined();
    expect(formatSpec?.parserSpec).toBeDefined();

    // Verify that the formatSpec can be used for formatting
    const testValue = 1000.0; // 1000 meters
    const formattedValue = quantityFormatter.formatQuantity(testValue, formatSpec?.formatterSpec);
    expect(formattedValue).toBeDefined();
    expect(typeof formattedValue).toBe("string");

    // Verify that the parserSpec can be used for parsing
    const parsedValue = quantityFormatter.parseToQuantityValue(formattedValue, formatSpec?.parserSpec);
    expect(parsedValue.ok).toBe(true);
    if (Parser.isParsedQuantity(parsedValue)) {
      expect(withinTolerance(parsedValue.value, testValue, 0.01)).toBe(true);
    }
  });

  describe("Test native unit conversions", async () => {
    async function testUnitConversion(magnitude: number, fromUnitName: string, expectedValue: number, toUnitName: string, tolerance?: number) {
      const fromUnit = await quantityFormatter.findUnitByName(fromUnitName);
      const toUnit = await quantityFormatter.findUnitByName(toUnitName);
      const unitConversion = await quantityFormatter.getConversion(fromUnit, toUnit);
      const convertedValue = (magnitude * unitConversion.factor) + unitConversion.offset;
      expect(withinTolerance(convertedValue, expectedValue, tolerance)).toBe(true);
    }

    it("UnitConversionTests, USCustomaryLengths", async () => {
      // Conversion tests where expected value is taken directly out of  http://www.nist.gov/pml/wmd/pubs/upload/hb44-15-web-final.pdf, Appendix C. Section 4, Page C-8
      // Directly from exact values in tables
      await testUnitConversion(1.0, "Units.MILE", 63360, "Units.IN");
      await testUnitConversion(1.0, "Units.MILE", 5280, "Units.FT");
      await testUnitConversion(1.0, "Units.MILE", 1760, "Units.YRD");
      await testUnitConversion(1.0, "Units.MILE", 80, "Units.CHAIN");
      await testUnitConversion(1.0, "Units.IN", 2.54, "Units.CM");
      await testUnitConversion(1.0, "Units.FT", 30.48, "Units.CM");
      await testUnitConversion(1.0, "Units.YRD", 91.44, "Units.CM");
      await testUnitConversion(1.0, "Units.CHAIN", 66.0 * 30.48, "Units.CM");
      await testUnitConversion(1.0, "Units.MILE", 160934.4, "Units.CM");
      await testUnitConversion(1.0, "Units.SQ_KM", 1000000, "Units.SQ_M");
    });

    it("UnitConversionTests, UsSurveyLengths", async () => {
      // Conversion tests where expected value is taken directly out of  http://www.nist.gov/pml/wmd/pubs/upload/hb44-15-web-final.pdf, Appendix C. Section 4, Page C-8
      // Exact values from document used for these conversions
      await testUnitConversion(1.0, "Units.FT", 0.999998, "Units.US_SURVEY_FT");
      await testUnitConversion(1.0, "Units.FT", 0.0254 * 39.37, "Units.US_SURVEY_FT");
      await testUnitConversion(1.0, "Units.US_SURVEY_FT", 1.0 / 0.999998, "Units.FT");
      await testUnitConversion(1.0, "Units.US_SURVEY_FT", 1200.0 / 3937.0, "Units.M");
      await testUnitConversion(1.0, "Units.M", 3937.0 / 1200.0, "Units.US_SURVEY_FT");
      await testUnitConversion(1.0, "Units.US_SURVEY_MILE", 5280.0 * 1200.0 / 3937.0, "Units.M");
      await testUnitConversion(1.0, "Units.US_SURVEY_MILE", 1.0 / 0.999998, "Units.MILE");
      await testUnitConversion(1.0, "Units.MILE", 0.999998, "Units.US_SURVEY_MILE");
      await testUnitConversion(1.0, "Units.M", 3937.0 / 1200.0 / 5280.0, "Units.US_SURVEY_MILE");
      await testUnitConversion(1.0, "Units.US_SURVEY_FT", 1.0 / 66.0, "Units.US_SURVEY_CHAIN");
      await testUnitConversion(1.0, "Units.M", 39.37, "Units.US_SURVEY_IN");
      await testUnitConversion(12.0, "Units.US_SURVEY_IN", 1200.0 / 3937.0, "Units.M");

      // Directly from exact values in tables
      await testUnitConversion(1.0, "Units.US_SURVEY_MILE", 63360, "Units.US_SURVEY_IN");
      await testUnitConversion(1.0, "Units.US_SURVEY_MILE", 5280, "Units.US_SURVEY_FT");
      await testUnitConversion(1.0, "Units.US_SURVEY_MILE", 1760, "Units.US_SURVEY_YRD");
      await testUnitConversion(1.0, "Units.US_SURVEY_MILE", 80, "Units.US_SURVEY_CHAIN", 1.0e-6);

      // Exact values do not exist in document
      await testUnitConversion(1.0, "Units.US_SURVEY_FT", 0.3048006, "Units.M");
      await testUnitConversion(1.0, "Units.US_SURVEY_CHAIN", 20.11684, "Units.M");
      await testUnitConversion(1.0, "Units.US_SURVEY_YRD", 3.0 * 0.3048006, "Units.M");
      await testUnitConversion(1.0, "Units.US_SURVEY_MILE", 1609.347, "Units.M", 1.0e-3);
    });
  });

  describe("FormatsProviderManager", async () => {

    it("Should raise formatsChanged event when updating formatsProvider", () => {
      const spy = vi.fn();
      IModelApp.formatsProvider.onFormatsChanged.addListener(spy);

      const testProvider = new QuantityTypeFormatsProvider();
      IModelApp.formatsProvider = testProvider;

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({ formatsChanged: "all" });
    });

    it("should raise formatsChanged event when calling resetFormatsProvider", () => {
      const spy = vi.fn();
      IModelApp.formatsProvider.onFormatsChanged.addListener(spy);

      IModelApp.resetFormatsProvider();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({ formatsChanged: "all" });
    });

    it("should raise formatsChanged event when underlying formatsProvider raises formatsChanged event", async () => {

      const testProvider = new QuantityTypeFormatsProvider();
      IModelApp.formatsProvider = testProvider;

      const spy = vi.fn();
      IModelApp.formatsProvider.onFormatsChanged.addListener(spy);
      testProvider.onFormatsChanged.raiseEvent({ formatsChanged: ["foobar"]});


      IModelApp.resetFormatsProvider();
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy.mock.calls[0][0]).toEqual({ formatsChanged: ["foobar"] });
      expect(spy.mock.calls[1][0]).toEqual({ formatsChanged: "all" });

    });

    it("should not leak listeners when formatsProvider is replaced multiple times", () => {
      const provider1 = new QuantityTypeFormatsProvider();
      const provider2 = new QuantityTypeFormatsProvider();

      IModelApp.formatsProvider = provider1;
      IModelApp.formatsProvider = provider2;

      const spy = vi.fn();
      IModelApp.formatsProvider.onFormatsChanged.addListener(spy);

      // Raising on provider1 should NOT fire — the old listener was removed
      provider1.onFormatsChanged.raiseEvent({ formatsChanged: ["old"] });
      expect(spy).toHaveBeenCalledTimes(0);

      // Raising on provider2 SHOULD fire — it's the current provider
      provider2.onFormatsChanged.raiseEvent({ formatsChanged: ["new"] });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toEqual({ formatsChanged: ["new"] });
    });
  });
});

describe("Test Custom QuantityType", async () => {
  let quantityFormatter: QuantityFormatter;
  beforeEach(async () => {
    quantityFormatter = new QuantityFormatter();
    await quantityFormatter.onInitialized();
  });

  it("QuantityFormatter should handle unit system changes properly", async () => {
    const persistenceUnit = await quantityFormatter.findUnitByName("Units.RAD");
    const quantityTypeDefinition = new BearingQuantityType(persistenceUnit);

    let wasRegistered = await quantityFormatter.registerQuantityType(quantityTypeDefinition);
    expect(wasRegistered).toBe(true);
    // only allow a single registration
    wasRegistered = await quantityFormatter.registerQuantityType(quantityTypeDefinition);
    expect(wasRegistered).toBe(false);

    const formatterSpec = await quantityFormatter.getFormatterSpecByQuantityType("Bearing");
    expect(formatterSpec).toBeDefined();

    const rad45 = Math.PI / 4;
    const formattedAngle = formatterSpec!.applyFormatting(rad45);
    expect(formattedAngle).toBe(`N 45°0'0" E`);

    const parserSpec = await quantityFormatter.getParserSpecByQuantityType("Bearing");
    expect(parserSpec).toBeDefined();

    const parsedRadians = parserSpec!.parseToQuantityValue("n45e");
    expect(Parser.isParsedQuantity(parsedRadians)).toBe(true);
    if (Parser.isParsedQuantity(parsedRadians))
      expect(parsedRadians.value).toBe(rad45);
  });
});

describe("Test Formatted Quantities", async () => {
  let quantityFormatter: QuantityFormatter;
  beforeEach(async () => {
    quantityFormatter = new QuantityFormatter();
    await quantityFormatter.onInitialized();
  });

  async function testFormatting(type: QuantityTypeArg, magnitude: number, expectedValue: string) {
    const formatterSpec = await quantityFormatter.getFormatterSpecByQuantityType(type);
    const parserSpec = await quantityFormatter.getParserSpecByQuantityType(type);

    const formattedValue = quantityFormatter.formatQuantity(magnitude, formatterSpec);
    const parsedValue = quantityFormatter.parseToQuantityValue(expectedValue, parserSpec);
    expect(formattedValue).toBe(expectedValue);
    expect(parsedValue.ok).toBe(true);
    expect(withinTolerance((parsedValue as ParsedQuantity).value, magnitude, 0.01)).toBe(true);
  }

  it("QuantityFormatter should handle unit system changes properly", async () => {
    expect(quantityFormatter.activeUnitSystem).toBe("imperial");
    await testFormatting(QuantityType.Length, 1000.0, `3280'-10 1/8"`);
    await testFormatting(QuantityType.Angle, Math.PI / 2, `90°0'0"`);
    await testFormatting(QuantityType.Area, 1000.0, "10763.9104 ft²");
    await testFormatting(QuantityType.Coordinate, 1000.0, "3280.84 ft");
    await testFormatting(QuantityType.LatLong, Math.PI, `180°0'0"`);
    await testFormatting(QuantityType.LatLong, 0.2645, `15°9'17.0412"`);
    await testFormatting(QuantityType.LengthEngineering, 1000.0, "3280.84 ft");
    await testFormatting(QuantityType.LengthSurvey, 1000.0, "3280.8333 ft (US Survey)");
    await testFormatting(QuantityType.Stationing, 1000.0, "32+80.84");
    await testFormatting(QuantityType.Volume, 1000.0, "35314.6662 ft³");

    await quantityFormatter.setActiveUnitSystem("metric");
    await testFormatting(QuantityType.Length, 1000.0, `1000 m`);
    await testFormatting(QuantityType.Angle, Math.PI / 2, `90°`);
    await testFormatting(QuantityType.Area, 1000.0, "1000 m²");
    await testFormatting(QuantityType.Coordinate, 1000.0, "1000 m");
    await testFormatting(QuantityType.LatLong, Math.PI, `180°0'0"`);
    await testFormatting(QuantityType.LengthEngineering, 1000.0, "1000 m");
    await testFormatting(QuantityType.LengthSurvey, 1000.0, "1000 m");
    await testFormatting(QuantityType.Stationing, 1000.0, "1+000.00");
    await testFormatting(QuantityType.Stationing, 15918.01, "15+918.01");
    await testFormatting(QuantityType.Volume, 1000.0, "1000 m³");

    await quantityFormatter.setActiveUnitSystem("usCustomary");
    await testFormatting(QuantityType.Length, 1000.0, `3280'-10 1/8"`);
    await testFormatting(QuantityType.Angle, Math.PI / 2, `90°0'0"`);
    await testFormatting(QuantityType.Area, 1000.0, "10763.9104 ft²");
    await testFormatting(QuantityType.Coordinate, 1000.0, "3280.84 ft");
    await testFormatting(QuantityType.LatLong, Math.PI, `180°0'0"`);
    await testFormatting(QuantityType.LengthEngineering, 1000.0, "3280.84 ft");
    await testFormatting(QuantityType.LengthSurvey, 1000.0, "3280.8333 ft");
    await testFormatting(QuantityType.Stationing, 1000.0, "32+80.84");
    await testFormatting(QuantityType.Volume, 1000.0, "35314.6662 ft³");

    await quantityFormatter.setActiveUnitSystem("usSurvey");
    await testFormatting(QuantityType.Length, 1000.0, `3280.8333 ft`);
    await testFormatting(QuantityType.Angle, Math.PI / 2, `90°0'0"`);
    await testFormatting(QuantityType.Area, 1000.0, "10763.8674 ft²");
    await testFormatting(QuantityType.Coordinate, 1000.0, "3280.83 ft");
    await testFormatting(QuantityType.LatLong, Math.PI, `180°0'0"`);
    await testFormatting(QuantityType.LengthEngineering, 1000.0, "3280.83 ft");
    await testFormatting(QuantityType.LengthSurvey, 1000.0, "3280.8333 ft");
    await testFormatting(QuantityType.Stationing, 1000.0, "32+80.83");
    await testFormatting(QuantityType.Volume, 1000.0, "35314.4548 ft³");
  });
});

describe("Reload queue and onFormattingReady", () => {
  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
  });

  afterAll(async () => {
    await IModelApp.shutdown();
  });

  it("onFormattingReady fires after onInitialized()", async () => {
    const qf = new QuantityFormatter();
    const spy = vi.fn();
    qf.onFormattingReady.addListener(spy);
    await qf.onInitialized();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("isReady transitions from false to true after onInitialized()", async () => {
    const qf = new QuantityFormatter();
    expect(qf.isReady).toBe(false);
    await qf.onInitialized();
    expect(qf.isReady).toBe(true);
  });

  it("whenInitialized resolves after onInitialized()", async () => {
    const qf = new QuantityFormatter();
    let resolved = false;
    const promise = qf.whenInitialized.then(() => { resolved = true; });
    expect(resolved).toBe(false);
    await qf.onInitialized();
    await promise;
    expect(resolved).toBe(true);
  });

  it("onFormattingReady fires after setActiveUnitSystem()", async () => {
    const qf = new QuantityFormatter();
    await qf.onInitialized();
    const spy = vi.fn();
    qf.onFormattingReady.addListener(spy);
    await qf.setActiveUnitSystem("metric");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("setUnitsProvider triggers onFormattingReady", async () => {
    const qf = new QuantityFormatter();
    await qf.onInitialized();
    const spy = vi.fn();
    qf.onFormattingReady.addListener(spy);
    await qf.setUnitsProvider(qf.unitsProvider);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("onActiveFormattingUnitSystemChanged fires AFTER onFormattingReady", async () => {
    const qf = new QuantityFormatter();
    await qf.onInitialized();
    const callOrder: string[] = [];
    qf.onActiveFormattingUnitSystemChanged.addListener(() => { callOrder.push("systemChanged"); });
    qf.onFormattingReady.addListener(() => { callOrder.push("formattingReady"); });
    await qf.setActiveUnitSystem("metric");
    expect(callOrder).toEqual(["formattingReady", "systemChanged"]);
  });

  it("onActiveFormattingUnitSystemChanged deferred when reload already in-flight", async () => {
    const qf = new QuantityFormatter();
    await qf.onInitialized();
    const callOrder: string[] = [];
    qf.onActiveFormattingUnitSystemChanged.addListener(() => { callOrder.push("systemChanged"); });
    qf.onFormattingReady.addListener(() => { callOrder.push("formattingReady"); });

    // Start a full reload (in-flight) without awaiting
    const fullReload = qf.setUnitsProvider(qf.unitsProvider);
    // While the full reload is running, request a unit system change — scheduleReload returns
    // immediately because _reloadInFlight is true, so the emit must be deferred.
    const systemChange = qf.setActiveUnitSystem("metric");

    await fullReload;
    await systemChange;

    // systemChanged must still come after formattingReady, even though setActiveUnitSystem
    // returned before the reload that processes it actually ran.
    const readyIndices = callOrder.reduce<number[]>((acc, v, i) => { if (v === "formattingReady") acc.push(i); return acc; }, []);
    const changedIndices = callOrder.reduce<number[]>((acc, v, i) => { if (v === "systemChanged") acc.push(i); return acc; }, []);
    expect(changedIndices.length).toBe(1);
    expect(readyIndices.length).toBeGreaterThanOrEqual(1);
    // The system-changed event must fire after the last formattingReady
    expect(changedIndices[0]).toBeGreaterThan(readyIndices[readyIndices.length - 1]);
  });

  describe("Composite-keyed spec registry", () => {
    const simpleDecimalFormat = {
      type: "Decimal" as const,
      precision: 4,
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      composite: { includeZero: true, units: [{ name: "Units.M", label: "m" }] },
    };

    it("same KoQ with two different persistence units are both retrievable", async () => {
      const qf = new QuantityFormatter();
      await qf.onInitialized();
      // Register same KoQ name with two different persistence units
      await qf.addFormattingSpecsToRegistry({ name: "TestKoQ.LENGTH", persistenceUnitName: "Units.M", formatProps: simpleDecimalFormat });
      await qf.addFormattingSpecsToRegistry({ name: "TestKoQ.LENGTH", persistenceUnitName: "Units.FT", formatProps: simpleDecimalFormat });
      const entry1 = qf.getSpecsByNameAndUnit({ name: "TestKoQ.LENGTH", persistenceUnitName: "Units.M" });
      const entry2 = qf.getSpecsByNameAndUnit({ name: "TestKoQ.LENGTH", persistenceUnitName: "Units.FT" });
      expect(entry1).toBeDefined();
      expect(entry2).toBeDefined();
      expect(entry1?.formatterSpec.persistenceUnit.name).toBe("Units.M");
      expect(entry2?.formatterSpec.persistenceUnit.name).toBe("Units.FT");
    });

    it("re-registering same KoQ + persistence unit updates the entry", async () => {
      const qf = new QuantityFormatter();
      await qf.onInitialized();
      await qf.addFormattingSpecsToRegistry({ name: "TestKoQ.LENGTH", persistenceUnitName: "Units.M", formatProps: simpleDecimalFormat });
      const entry1 = qf.getSpecsByNameAndUnit({ name: "TestKoQ.LENGTH", persistenceUnitName: "Units.M" });
      expect(entry1).toBeDefined();
      // Re-register — should update, not duplicate
      await qf.addFormattingSpecsToRegistry({ name: "TestKoQ.LENGTH", persistenceUnitName: "Units.M", formatProps: simpleDecimalFormat });
      const entry2 = qf.getSpecsByNameAndUnit({ name: "TestKoQ.LENGTH", persistenceUnitName: "Units.M" });
      expect(entry2).toBeDefined();
      // The inner map should still only have one entry
      const innerMap = qf.getSpecsByName("TestKoQ.LENGTH");
      expect(innerMap?.size).toBe(1);
    });
  });
});

describe("FormatSpecHandle", () => {
  const testFormatProps = {
    type: "Decimal",
    precision: 3,
    formatTraits: ["keepSingleZero", "showUnitLabel"],
    decimalSeparator: ".",
    uomSeparator: " ",
  };

  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
  });

  afterAll(async () => {
    await IModelApp.shutdown();
  });

  it("holds current spec after initialization", async () => {
    const qf = new QuantityFormatter();
    await qf.onInitialized();
    await qf.addFormattingSpecsToRegistry({ name: "TestKoQ.LENGTH", persistenceUnitName: "Units.M", formatProps: testFormatProps });

    const handle = qf.getFormatSpecHandle("TestKoQ.LENGTH", "Units.M");
    expect(handle.formatterSpec).toBeDefined();
    expect(handle.parserSpec).toBeDefined();
    expect(handle.koqName).toBe("TestKoQ.LENGTH");
    expect(handle.persistenceUnit).toBe("Units.M");
    handle[Symbol.dispose]();
  });

  it("format() returns formatted string", async () => {
    const qf = new QuantityFormatter();
    await qf.onInitialized();
    await qf.addFormattingSpecsToRegistry({ name: "TestKoQ.LENGTH", persistenceUnitName: "Units.M", formatProps: testFormatProps });

    const handle = qf.getFormatSpecHandle("TestKoQ.LENGTH", "Units.M");
    const result = handle.format(1.5);
    expect(typeof result).toBe("string");
    expect(result).not.toBe("1.5"); // Should be formatted with units, not raw toString
    handle[Symbol.dispose]();
  });

  it("format() returns value.toString() fallback when spec not loaded", async () => {
    const qf = new QuantityFormatter();
    await qf.onInitialized();

    const handle = qf.getFormatSpecHandle("NonExistent.KOQ", "Units.M");
    expect(handle.format(42)).toBe("42");
    handle[Symbol.dispose]();
  });

  it("dispose is idempotent", async () => {
    const qf = new QuantityFormatter();
    await qf.onInitialized();
    await qf.addFormattingSpecsToRegistry({ name: "TestKoQ.LENGTH", persistenceUnitName: "Units.M", formatProps: testFormatProps });

    const handle = qf.getFormatSpecHandle("TestKoQ.LENGTH", "Units.M");
    expect(handle.formatterSpec).toBeDefined();
    handle[Symbol.dispose]();
    handle[Symbol.dispose](); // Should not throw
    expect(handle.formatterSpec).toBeUndefined();
  });

  it("[Symbol.dispose] works", async () => {
    const qf = new QuantityFormatter();
    await qf.onInitialized();
    await qf.addFormattingSpecsToRegistry({ name: "TestKoQ.LENGTH", persistenceUnitName: "Units.M", formatProps: testFormatProps });

    const handle = qf.getFormatSpecHandle("TestKoQ.LENGTH", "Units.M");
    expect(handle.formatterSpec).toBeDefined();
    handle[Symbol.dispose]();
    expect(handle.formatterSpec).toBeUndefined();
  });

  it("listener count stays stable after create+dispose cycles", async () => {
    const qf = new QuantityFormatter();
    await qf.onInitialized();
    await qf.addFormattingSpecsToRegistry({ name: "TestKoQ.LENGTH", persistenceUnitName: "Units.M", formatProps: testFormatProps });

    const initialCount = qf.onFormattingReady.numberOfListeners;
    for (let i = 0; i < 10; i++) {
      const handle = qf.getFormatSpecHandle("TestKoQ.LENGTH", "Units.M");
      handle[Symbol.dispose]();
    }
    expect(qf.onFormattingReady.numberOfListeners).toBe(initialCount);
  });

  it("refreshes specs when onFormattingReady fires", async () => {
    const qf = new QuantityFormatter();
    await qf.onInitialized();

    // Create handle before registry is populated — specs should be undefined
    const handle = qf.getFormatSpecHandle("TestKoQ.LENGTH", "Units.M");
    expect(handle.formatterSpec).toBeUndefined();

    // Populate registry then trigger the event
    await qf.addFormattingSpecsToRegistry({ name: "TestKoQ.LENGTH", persistenceUnitName: "Units.M", formatProps: testFormatProps });
    qf.onFormattingReady.emit();

    expect(handle.formatterSpec).toBeDefined();
    expect(handle.parserSpec).toBeDefined();
    handle[Symbol.dispose]();
  });
});

describe("Failed reload recovery (Issue 5)", () => {
  it("restores isReady if reload fails after a successful init", async () => {
    const qf = new QuantityFormatter();
    await qf.onInitialized();
    expect(qf.isReady).toBe(true);

    // Spy on loadFormatAndParsingMapsForSystem to force it to throw
    const originalLoad = (qf as any).loadFormatAndParsingMapsForSystem.bind(qf);
    let shouldThrow = true;
    (qf as any).loadFormatAndParsingMapsForSystem = async function (...args: any[]) {
      if (shouldThrow) {
        throw new Error("simulated reload failure");
      }
      return originalLoad(...args);
    };

    // setActiveUnitSystem triggers scheduleReload → calls loadFormatAndParsingMapsForSystem
    await qf.setActiveUnitSystem("metric");

    // After failure: isReady should be restored (stale-but-usable)
    expect(qf.isReady).toBe(true);

    // Verify that a successful reload still works after recovery
    shouldThrow = false;
    await qf.setActiveUnitSystem("imperial");
    expect(qf.isReady).toBe(true);
  });

  it("isReady stays false if first init fails (was never ready)", async () => {
    const qf = new QuantityFormatter();
    // Override loadFormatAndParsingMapsForSystem before onInitialized
    (qf as any).loadFormatAndParsingMapsForSystem = async function () {
      throw new Error("simulated first load failure");
    };

    // Suppress the error to avoid noisy test output
    await qf.onInitialized();

    // First load failed, so isReady should stay false (no stale data to fall back on)
    expect(qf.isReady).toBe(false);
  });
});

describe("Multi-system KoQ registry", () => {
  const simpleDecimalFormat = {
    type: "Decimal" as const,
    precision: 4,
    formatTraits: ["keepSingleZero", "showUnitLabel"],
    composite: { includeZero: true, units: [{ name: "Units.M", label: "m" }] },
  };

  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
  });

  afterAll(async () => {
    await IModelApp.shutdown();
  });

  it("getSpecsByNameAndUnit with explicit system returns system-specific entry", async () => {
    const qf = new QuantityFormatter();
    await qf.onInitialized();

    await qf.addFormattingSpecsToRegistry({ name: "TestKoQ.LENGTH", persistenceUnitName: "Units.M", formatProps: simpleDecimalFormat, system: "metric" });
    await qf.addFormattingSpecsToRegistry({ name: "TestKoQ.LENGTH", persistenceUnitName: "Units.M", formatProps: simpleDecimalFormat, system: "imperial" });

    const metricEntry = qf.getSpecsByNameAndUnit({ name: "TestKoQ.LENGTH", persistenceUnitName: "Units.M", system: "metric" });
    const imperialEntry = qf.getSpecsByNameAndUnit({ name: "TestKoQ.LENGTH", persistenceUnitName: "Units.M", system: "imperial" });
    expect(metricEntry).toBeDefined();
    expect(imperialEntry).toBeDefined();
    // Both entries are distinct objects in the registry
    expect(metricEntry).not.toBe(imperialEntry);
  });

  it("getSpecsByNameAndUnit without system returns active system entry", async () => {
    const qf = new QuantityFormatter();
    await qf.onInitialized();
    // Active system defaults to "imperial"
    await qf.addFormattingSpecsToRegistry({ name: "TestKoQ.LENGTH", persistenceUnitName: "Units.M", formatProps: simpleDecimalFormat, system: "imperial" });
    await qf.addFormattingSpecsToRegistry({ name: "TestKoQ.LENGTH", persistenceUnitName: "Units.M", formatProps: simpleDecimalFormat, system: "metric" });

    // No system param → returns active system
    const entry = qf.getSpecsByNameAndUnit({ name: "TestKoQ.LENGTH", persistenceUnitName: "Units.M" });
    const imperialEntry = qf.getSpecsByNameAndUnit({ name: "TestKoQ.LENGTH", persistenceUnitName: "Units.M", system: "imperial" });
    expect(entry).toBeDefined();
    expect(entry).toBe(imperialEntry);
  });

  it("getSpecsByName returns only active system projection", async () => {
    const qf = new QuantityFormatter();
    await qf.onInitialized();

    await qf.addFormattingSpecsToRegistry({ name: "TestKoQ.LENGTH", persistenceUnitName: "Units.M", formatProps: simpleDecimalFormat, system: "metric" });
    await qf.addFormattingSpecsToRegistry({ name: "TestKoQ.LENGTH", persistenceUnitName: "Units.M", formatProps: simpleDecimalFormat, system: "imperial" });
    await qf.addFormattingSpecsToRegistry({ name: "TestKoQ.LENGTH", persistenceUnitName: "Units.FT", formatProps: simpleDecimalFormat, system: "imperial" });

    const nameMap = qf.getSpecsByName("TestKoQ.LENGTH");
    expect(nameMap).toBeDefined();
    // Active system is "imperial", so should see both persistence units for imperial
    expect(nameMap!.has("Units.M")).toBe(true);
    expect(nameMap!.has("Units.FT")).toBe(true);
  });

  it("getSpecsByNameAndUnit returns undefined for unregistered system", async () => {
    const qf = new QuantityFormatter();
    await qf.onInitialized();

    await qf.addFormattingSpecsToRegistry({ name: "TestKoQ.LENGTH", persistenceUnitName: "Units.M", formatProps: simpleDecimalFormat, system: "metric" });
    const entry = qf.getSpecsByNameAndUnit({ name: "TestKoQ.LENGTH", persistenceUnitName: "Units.M", system: "usCustomary" });
    expect(entry).toBeUndefined();
  });

  it("FormatSpecHandle with explicit system returns pinned entry", async () => {
    const qf = new QuantityFormatter();
    await qf.onInitialized();

    await qf.addFormattingSpecsToRegistry({ name: "TestKoQ.LENGTH", persistenceUnitName: "Units.M", formatProps: simpleDecimalFormat, system: "metric" });
    await qf.addFormattingSpecsToRegistry({ name: "TestKoQ.LENGTH", persistenceUnitName: "Units.M", formatProps: simpleDecimalFormat, system: "imperial" });

    const handle = qf.getFormatSpecHandle("TestKoQ.LENGTH", "Units.M", "metric");
    expect(handle.system).toBe("metric");
    expect(handle.formatterSpec).toBeDefined();
    handle[Symbol.dispose]();
  });

  it("FormatSpecHandle with no system uses active system", async () => {
    const qf = new QuantityFormatter();
    await qf.onInitialized();

    await qf.addFormattingSpecsToRegistry({ name: "TestKoQ.LENGTH", persistenceUnitName: "Units.M", formatProps: simpleDecimalFormat, system: "imperial" });

    const handle = qf.getFormatSpecHandle("TestKoQ.LENGTH", "Units.M");
    expect(handle.system).toBeUndefined();
    expect(handle.formatterSpec).toBeDefined();
    handle[Symbol.dispose]();
  });
});

describe("onBeforeFormattingReady collector", () => {
  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
  });

  afterAll(async () => {
    await IModelApp.shutdown();
  });

  it("onBeforeFormattingReady fires before onFormattingReady", async () => {
    const qf = new QuantityFormatter();
    const callOrder: string[] = [];

    qf.onBeforeFormattingReady.addListener(() => {
      callOrder.push("before");
    });
    qf.onFormattingReady.addListener(() => {
      callOrder.push("ready");
    });

    await qf.onInitialized();
    expect(callOrder).toEqual(["before", "ready"]);
  });

  it("collector awaits provider promises before ready fires", async () => {
    const qf = new QuantityFormatter();
    let providerDone = false;

    qf.onBeforeFormattingReady.addListener((collector: FormattingReadyCollector) => {
      collector.addPendingWork(new Promise<void>((resolve) => {
        setTimeout(() => {
          providerDone = true;
          resolve();
        }, 50);
      }));
    });

    const readySpy = vi.fn();
    qf.onFormattingReady.addListener(readySpy);

    await qf.onInitialized();
    // Provider should have completed before ready fires
    expect(providerDone).toBe(true);
    expect(readySpy).toHaveBeenCalledTimes(1);
  });

  it("collector with rejected promise still fires ready", async () => {
    const qf = new QuantityFormatter();

    qf.onBeforeFormattingReady.addListener((collector: FormattingReadyCollector) => {
      collector.addPendingWork(Promise.reject(new Error("provider failed")));
    });

    const readySpy = vi.fn();
    qf.onFormattingReady.addListener(readySpy);

    // Suppress console.warn from collector
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await qf.onInitialized();
    warnSpy.mockRestore();

    // Ready should still fire despite the rejection
    expect(readySpy).toHaveBeenCalledTimes(1);
    expect(qf.isReady).toBe(true);
  });

  it("collector with no pending work resolves immediately", async () => {
    const qf = new QuantityFormatter();
    const readySpy = vi.fn();

    qf.onBeforeFormattingReady.addListener(() => {
      // Provider listens but adds no work
    });
    qf.onFormattingReady.addListener(readySpy);

    await qf.onInitialized();
    expect(readySpy).toHaveBeenCalledTimes(1);
  });

  it("multiple providers can add work to the same collector", async () => {
    const qf = new QuantityFormatter();
    const completionOrder: string[] = [];

    qf.onBeforeFormattingReady.addListener((collector: FormattingReadyCollector) => {
      collector.addPendingWork(new Promise<void>((resolve) => {
        setTimeout(() => {
          completionOrder.push("provider1");
          resolve();
        }, 30);
      }));
    });

    qf.onBeforeFormattingReady.addListener((collector: FormattingReadyCollector) => {
      collector.addPendingWork(new Promise<void>((resolve) => {
        setTimeout(() => {
          completionOrder.push("provider2");
          resolve();
        }, 10);
      }));
    });

    await qf.onInitialized();
    // Both providers should complete before ready
    expect(completionOrder).toContain("provider1");
    expect(completionOrder).toContain("provider2");
  });
});

describe("Deferred unit-system-changed emit (race condition validation)", () => {
  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
  });

  afterAll(async () => {
    await IModelApp.shutdown();
  });

  it("emits onActiveFormattingUnitSystemChanged only after isReady is true (deferred path)", async () => {
    const qf = new QuantityFormatter();
    await qf.onInitialized();
    expect(qf.isReady).toBe(true);

    let readyDuringEmit: boolean | undefined;
    qf.onActiveFormattingUnitSystemChanged.addListener(() => {
      readyDuringEmit = qf.isReady;
    });

    // Exercise the actual deferred emit path: formatsChanged with impliedUnitSystem
    const provider = new QuantityTypeFormatsProvider();
    IModelApp.formatsProvider = provider;
    await new Promise<void>((resolve) => { qf.onFormattingReady.addListener(resolve); });

    provider.onFormatsChanged.raiseEvent({ formatsChanged: "all", impliedUnitSystem: "metric" });
    await new Promise<void>((resolve) => { qf.onFormattingReady.addListener(resolve); });

    expect(readyDuringEmit).toBe(true);
  });

  it("only the winning reload's impliedUnitSystem fires the changed event (latest-wins)", async () => {
    const qf = new QuantityFormatter();
    await qf.onInitialized();
    expect(qf.isReady).toBe(true);
    // Start at imperial
    expect(qf.activeUnitSystem).toBe("imperial");

    const systemChanges: string[] = [];
    qf.onActiveFormattingUnitSystemChanged.addListener((args) => {
      systemChanges.push(args.system);
    });

    // Fire two formatsChanged events rapidly — the first should be superseded by the second.
    // We trigger this via the formatsProvider's onFormatsChanged event with impliedUnitSystem.
    const provider = new QuantityTypeFormatsProvider();
    IModelApp.formatsProvider = provider;

    // Wait for the initial "all" reload to settle
    await new Promise<void>((resolve) => {
      qf.onFormattingReady.addListener(resolve);
    });
    systemChanges.length = 0; // clear any emissions from the provider swap

    // Now fire two rapid events with different implied systems
    provider.onFormatsChanged.raiseEvent({ formatsChanged: "all", impliedUnitSystem: "usCustomary" });
    provider.onFormatsChanged.raiseEvent({ formatsChanged: "all", impliedUnitSystem: "metric" });

    // Wait for the reload queue to drain
    await new Promise<void>((resolve) => {
      qf.onFormattingReady.addListener(resolve);
    });

    // The first reload (usCustomary) should be superseded by the second (metric).
    // Only the winning reload's system should be emitted, and it should be "metric".
    expect(qf.activeUnitSystem).toBe("metric");
    // The deferred emit should fire exactly once for the winning reload
    expect(systemChanges).toEqual(["metric"]);
  });

  it("does not emit onActiveFormattingUnitSystemChanged when impliedUnitSystem is undefined", async () => {
    const qf = new QuantityFormatter();
    await qf.onInitialized();

    const spy = vi.fn();
    qf.onActiveFormattingUnitSystemChanged.addListener(spy);

    const provider = new QuantityTypeFormatsProvider();
    IModelApp.formatsProvider = provider;

    // Wait for the initial "all" reload to settle
    await new Promise<void>((resolve) => {
      qf.onFormattingReady.addListener(resolve);
    });
    spy.mockClear();

    // Fire a formatsChanged event WITHOUT impliedUnitSystem
    provider.onFormatsChanged.raiseEvent({ formatsChanged: ["some-format"] });

    await new Promise<void>((resolve) => {
      qf.onFormattingReady.addListener(resolve);
    });

    // No unit system change should have been emitted
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("_rebuildRegistryFromProvider", () => {
  const simpleDecimalFormat = {
    type: "Decimal" as const,
    precision: 4,
    formatTraits: ["keepSingleZero", "showUnitLabel"],
    composite: { includeZero: true, units: [{ name: "Units.M", label: "m" }] },
  };

  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
  });

  afterAll(async () => {
    await IModelApp.shutdown();
  });

  it("rebuilds registry when formatsProvider raises formatsChanged with 'all'", async () => {
    const qf = new QuantityFormatter();
    await qf.onInitialized();

    // Add a custom entry to the registry
    await qf.addFormattingSpecsToRegistry({
      name: "TestKoQ.CUSTOM",
      persistenceUnitName: "Units.M",
      formatProps: simpleDecimalFormat,
      system: "metric",
    });
    const entryBefore = qf.getSpecsByNameAndUnit({ name: "TestKoQ.CUSTOM", persistenceUnitName: "Units.M", system: "metric" });
    expect(entryBefore).toBeDefined();

    // Trigger a formatsChanged "all" event — the provider returns undefined for our custom name,
    // so the entry should be removed from the registry
    const provider = new QuantityTypeFormatsProvider();
    IModelApp.formatsProvider = provider;

    // Wait for reload to finish
    await new Promise<void>((resolve) => {
      qf.onFormattingReady.addListener(resolve);
    });

    // Our custom KoQ is not in QuantityTypeFormatsProvider, so _rebuildRegistryFromProvider
    // should have removed it (anySystemHadFormat === false → delete from registry)
    const entryAfter = qf.getSpecsByNameAndUnit({ name: "TestKoQ.CUSTOM", persistenceUnitName: "Units.M", system: "metric" });
    expect(entryAfter).toBeUndefined();
  });

  it("rebuilds only named formats when formatsChanged is a string array", async () => {
    const qf = new QuantityFormatter();
    await qf.onInitialized();

    // The default initialization creates entries for DefaultToolsUnits.LENGTH, etc.
    const lengthBefore = qf.getSpecsByNameAndUnit({ name: "DefaultToolsUnits.LENGTH", persistenceUnitName: "Units.M", system: "metric" });
    expect(lengthBefore).toBeDefined();

    const angleBefore = qf.getSpecsByNameAndUnit({ name: "DefaultToolsUnits.ANGLE", persistenceUnitName: "Units.RAD", system: "metric" });
    expect(angleBefore).toBeDefined();

    // Create a provider and trigger a formatsChanged with only "DefaultToolsUnits.LENGTH"
    const provider = new QuantityTypeFormatsProvider();
    IModelApp.formatsProvider = provider;

    // Wait for "all" reload
    await new Promise<void>((resolve) => {
      qf.onFormattingReady.addListener(resolve);
    });

    // Now fire a targeted change event for just LENGTH
    provider.onFormatsChanged.raiseEvent({ formatsChanged: ["DefaultToolsUnits.LENGTH"] });

    await new Promise<void>((resolve) => {
      qf.onFormattingReady.addListener(resolve);
    });

    // Both should still exist (the provider returns formats for both)
    const lengthAfter = qf.getSpecsByNameAndUnit({ name: "DefaultToolsUnits.LENGTH", persistenceUnitName: "Units.M", system: "metric" });
    const angleAfter = qf.getSpecsByNameAndUnit({ name: "DefaultToolsUnits.ANGLE", persistenceUnitName: "Units.RAD", system: "metric" });
    expect(lengthAfter).toBeDefined();
    expect(angleAfter).toBeDefined();
  });
});
