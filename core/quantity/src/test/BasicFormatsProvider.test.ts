import { FormatterSpec } from './../Formatter/FormatterSpec';
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BasicFormatsProvider } from "../BasicFormatsProvider";
import { BasicUnitsProvider } from '../BasicUnitsProvider';
import { Format } from '../core-quantity';

describe("BasicFormatsProvider", () => {
  // ZOMBIES
  let formatsProvider: BasicFormatsProvider;
  beforeEach(() => {
    formatsProvider = new BasicFormatsProvider();
  });

  it("should return undefined when format is not found", () => {
    const format = formatsProvider.getFormat("nonExistentFormat");
    expect(format).toBeUndefined();
  });

  // Getters
  it("should return a format when it exists", () => {
    const format = formatsProvider.getFormat("AmerI");
    expect(format).toBeDefined();
  });

  it("should return all default formats when no ids are provided", () => {
    const formats = formatsProvider.getFormats();
    expect(formats.length).toEqual(10);
  });
  // Setters

  it("should add a format", () => {
    const spy = vi.fn();
    formatsProvider.onFormatsUpdated.addListener(spy);
    const format = {
      label: "NewFormat",
      type: "Fractional",
      precision: 8,
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      uomSeparator: "",
    };
    formatsProvider.addFormat("NewFormat", format);
    const retrievedFormat = formatsProvider.getFormat("NewFormat");
    expect(retrievedFormat).toEqual(format);

    expect(spy).toHaveBeenCalledWith(["NewFormat"]);
  });

  it("should throw an error when adding a format with an existing id", () => {
    const format = {
      label: "NewFormat",
      type: "Fractional",
      precision: 8,
    }

    expect(() => {
      formatsProvider.addFormat("AmerI", format);
    }).toThrowError("Format with id AmerI already exists.");
  });

  it("should return a format when associated with a KindOfQuantity", () => {
    const format = formatsProvider.getFormatByKindOfQuantity("AecUnits.LENGTH");
    expect(format).toBeDefined();
    expect(format!.precision).toEqual(4);
  });

  it("should format a length quantity to meters given a KoQ and unit provider", async () => {
    const formatProps = formatsProvider.getFormatByKindOfQuantity("AecUnits.LENGTH");
    expect(formatProps).toBeDefined();
    const unitsProvider = new BasicUnitsProvider();
    const format = await Format.createFromJSON("testFormat", unitsProvider, formatProps!);
    const persistenceUnit = await unitsProvider.findUnitByName("Units.M"); // or unitsProvider.findUnit("m");
    const formatSpec = await FormatterSpec.create("TestSpec", format, unitsProvider, persistenceUnit);

    const result = formatSpec.applyFormatting(50);
    expect(result).toEqual("50.0 m");

  });

  it("should format a length quantity to kilometers given a KoQ and unit provider", async () => {
    const formatProps = formatsProvider.getFormatByKindOfQuantity("AecUnits.LENGTH_LONG");
    expect(formatProps).toBeDefined();
    const unitsProvider = new BasicUnitsProvider();
    const format = await Format.createFromJSON("testFormat", unitsProvider, formatProps!);
    const persistenceUnit = await unitsProvider.findUnitByName("Units.M"); // or unitsProvider.findUnit("m");
    const formatSpec = await FormatterSpec.create("TestSpec", format, unitsProvider, persistenceUnit);

    const result = formatSpec.applyFormatting(50);
    expect(result).toEqual("0.05 km");

  });
});