/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { beforeAll, describe, expect, it } from "vitest";
import { BasicUnitsProvider } from "../BasicUnitsProvider";
import { Format } from "../Formatter/Format";
import { FormatterSpec } from "../Formatter/FormatterSpec";
import { FormatProps } from "../Formatter/Interfaces";

// Pins the parity contract between the async FormatterSpec construction pipeline
// (Format.createFromJSON + FormatterSpec.create) and its synchronous twins
// (Format.createFromJSONSync + FormatterSpec.createSync) over a warmed-up
// BasicUnitsProvider.
describe("Synchronous FormatterSpec construction", () => {
  const provider = new BasicUnitsProvider();

  const compositeFormat: FormatProps = {
    composite: {
      includeZero: true,
      spacer: "-",
      units: [
        { label: "'", name: "Units.FT" },
        { label: "\"", name: "Units.IN" },
      ],
    },
    formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
    precision: 8,
    type: "Fractional",
    uomSeparator: "",
  };

  const decimalFormat: FormatProps = {
    formatTraits: ["keepSingleZero", "showUnitLabel"],
    precision: 2,
    type: "Decimal",
    composite: { units: [{ name: "Units.CM", label: "cm" }] },
  };

  beforeAll(async () => {
    await BasicUnitsProvider.warmup();
  });

  it("isWarmedUp reflects warmup state", () => {
    expect(BasicUnitsProvider.isWarmedUp).to.be.true;
  });

  it("findUnitByNameSync matches findUnitByName", async () => {
    const asyncUnit = await provider.findUnitByName("Units.M");
    const syncUnit = provider.findUnitByNameSync("Units.M");
    expect(syncUnit).to.deep.equal(asyncUnit);
    expect(provider.findUnitByNameSync("Units.NOT_A_UNIT").isValid).to.be.false;
  });

  it("createSync produces the same formatted output as create (composite format)", async () => {
    const persistenceUnit = provider.findUnitByNameSync("Units.M");

    const asyncFormat = await Format.createFromJSON("test", provider, compositeFormat);
    const asyncSpec = await FormatterSpec.create("test", asyncFormat, provider, persistenceUnit);

    const syncFormat = Format.createFromJSONSync("test", provider, compositeFormat);
    const syncSpec = FormatterSpec.createSync("test", syncFormat, provider, persistenceUnit);

    for (const magnitude of [0, 1, 2.5, -3.75, 1234.56789]) {
      expect(syncSpec.applyFormatting(magnitude)).to.equal(asyncSpec.applyFormatting(magnitude));
    }
  });

  it("createSync produces the same formatted output as create (single-unit decimal format)", async () => {
    const persistenceUnit = provider.findUnitByNameSync("Units.M");

    const asyncFormat = await Format.createFromJSON("test", provider, decimalFormat);
    const asyncSpec = await FormatterSpec.create("test", asyncFormat, provider, persistenceUnit);

    const syncFormat = Format.createFromJSONSync("test", provider, decimalFormat);
    const syncSpec = FormatterSpec.createSync("test", syncFormat, provider, persistenceUnit);

    expect(syncSpec.applyFormatting(2.5)).to.equal("250 cm");
    expect(syncSpec.applyFormatting(2.5)).to.equal(asyncSpec.applyFormatting(2.5));
  });

  it("createFromJSONSync throws on an unknown composite unit", () => {
    const badFormat: FormatProps = {
      ...decimalFormat,
      composite: { units: [{ name: "Units.NOT_A_UNIT" }] },
    };
    expect(() => Format.createFromJSONSync("test", provider, badFormat)).to.throw("Invalid unit name");
  });
});
