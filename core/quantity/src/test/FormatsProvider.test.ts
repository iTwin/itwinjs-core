import { BeUiEvent } from "@itwin/core-bentley";
import { FormatDefinition, FormatsChangedArgs, MutableFormatsProvider } from "../core-quantity";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * For testing. Implements a formats provider with a cache, to allow adding/removing formats at runtime.
 */
class TestFormatProvider implements MutableFormatsProvider {
  private _cache: Map<string, FormatDefinition> = new Map();
  public onFormatsChanged = new BeUiEvent<FormatsChangedArgs>();

  public async getFormat(name: string): Promise<FormatDefinition | undefined> {
    return this._cache.get(name);
  }

  public async addFormat(name: string, format: FormatDefinition): Promise<void> {
    this._cache.set(name, format);
    this.onFormatsChanged.raiseEvent({ formatsChanged: [name] });
  }
  public async removeFormat(name: string): Promise<void> {
    this._cache.delete(name);
    this.onFormatsChanged.raiseEvent({ formatsChanged: [name] });
  }
}

describe("MutableFormatsProvider", () => {
  let formatsProvider: TestFormatProvider;

  beforeEach(() => {
    formatsProvider = new TestFormatProvider();
  });

  it("should not find a format", async () => {
    const format = await formatsProvider.getFormat("nonExistentFormat");
    expect(format).to.be.undefined;
  });

  it("should add a format", async () => {
    const spy = vi.fn();
    formatsProvider.onFormatsChanged.addListener(spy);
    const format: FormatDefinition = {
      label: "NewFormat",
      type: "Fractional",
      precision: 8,
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      uomSeparator: "",
    };
    const formatName = "NonexistentSchema.newFormat";
    await formatsProvider.addFormat(formatName, format);
    const retrievedFormat = await formatsProvider.getFormat(formatName);
    expect(retrievedFormat).to.equal(format);
    expect(spy.mock.calls[0][0]).toEqual({ formatsChanged: [formatName] });
    formatsProvider.onFormatsChanged.removeListener(spy);
  });

    it("should remove a format from cache", async () => {
      const spy = vi.fn();
      formatsProvider.onFormatsChanged.addListener(spy);
      const format: FormatDefinition = {
        label: "NewFormat",
        type: "Fractional",
        precision: 8,
        formatTraits: ["keepSingleZero", "showUnitLabel"],
        uomSeparator: "",
      };
      const formatName = "NonexistentSchema.newFormat";
      await formatsProvider.addFormat(formatName, format);
      const retrievedFormat = await formatsProvider.getFormat(formatName);
      expect(retrievedFormat).to.equal(format);
      expect(spy.mock.calls[0][0]).toEqual({ formatsChanged: [formatName] });

      formatsProvider.onFormatsChanged.removeListener(spy);
    });
});