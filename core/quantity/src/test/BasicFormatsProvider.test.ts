import { beforeEach, describe, expect, it } from "vitest";
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

  // expect formatUpdated event to be raised when a format is updated
});