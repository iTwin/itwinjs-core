import { beforeEach, describe, expect, it, vi } from "vitest";
import { BasicFormatsProvider } from "../BasicFormatsProvider";

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
  // expect formatUpdated event to be raised when a format is updated
});