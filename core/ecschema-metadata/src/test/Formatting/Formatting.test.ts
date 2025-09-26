/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as path from "path";
import { expect } from "chai";
import { SchemaContext } from "../../ecschema-metadata";
import { deserializeXmlSync } from "../TestUtils/DeserializationHelpers";
import { SchemaUnitProvider } from "../../UnitProvider/SchemaUnitProvider";
import { UNIT_EXTRA_DATA } from "../UnitProvider/UnitData";
import { Format, FormatterSpec } from "@itwin/core-quantity";

describe.only("Formatting tests ", () => {
  let context: SchemaContext;
  let provider: SchemaUnitProvider;

  before(() => {
    context = new SchemaContext();

    const schemaFile = path.join(__dirname, "..", "..", "..", "..", "node_modules", "@bentley", "units-schema", "Units.ecschema.xml");
    const schemaXml = fs.readFileSync(schemaFile, "utf-8");
    deserializeXmlSync(schemaXml, context);

    provider = new SchemaUnitProvider(context, UNIT_EXTRA_DATA);
  });

  it("should format Kelvin to Fahrenheit with negative result", async () => {
    const format = await Format.createFromJSON("Test", provider, {
      type: "Decimal",
      formatTraits: ["ShowUnitLabel"],
      composite: {
        units: [
          {
            name: "Units.FAHRENHEIT",
          },
        ],
      },
    });
    const persistenceUnit = await provider.findUnitByName("Units.K");
    const formatterSpec = await FormatterSpec.create("Test", format, provider, persistenceUnit);
    const formatted = formatterSpec.applyFormatting(100);
    expect(formatted).to.eql("-279.67 °F");
  });

  it("should format Celsius to Fahrenheit with negative result", async () => {
    const format = await Format.createFromJSON("Test", provider, {
      type: "Decimal",
      formatTraits: ["ShowUnitLabel", "TrailZeroes"],
      precision: 2,
      composite: {
        units: [
          {
            name: "Units.FAHRENHEIT",
          },
        ],
      },
    });
    const persistenceUnit = await provider.findUnitByName("Units.CELSIUS");
    const formatterSpec = await FormatterSpec.create("Test", format, provider, persistenceUnit);
    const formatted = formatterSpec.applyFormatting(-40);
    expect(formatted).to.eql("-40.00 °F");
  });

  it("should format Fahrenheit to Celsius with negative result", async () => {
    const format = await Format.createFromJSON("Test", provider, {
      type: "Decimal",
      formatTraits: ["ShowUnitLabel"],
      precision: 2,
      composite: {
        units: [
          {
            name: "Units.CELSIUS",
          },
        ],
      },
    });
    const persistenceUnit = await provider.findUnitByName("Units.FAHRENHEIT");
    const formatterSpec = await FormatterSpec.create("Test", format, provider, persistenceUnit);
    const formatted = formatterSpec.applyFormatting(0);
    expect(formatted).to.eql("-17.78 °C");
  });

  it("should format Rankine to Celsius with negative result", async () => {
    const format = await Format.createFromJSON("Test", provider, {
      type: "Decimal",
      formatTraits: ["ShowUnitLabel"],
      precision: 2,
      composite: {
        units: [
          {
            name: "Units.CELSIUS",
          },
        ],
      },
    });
    const persistenceUnit = await provider.findUnitByName("Units.RANKINE");
    const formatterSpec = await FormatterSpec.create("Test", format, provider, persistenceUnit);
    const formatted = formatterSpec.applyFormatting(200);
    expect(formatted).to.eql("-162.04 °C");
  });

  it("should handle temperature conversion with fractional format", async () => {
    const format = await Format.createFromJSON("Test", provider, {
      type: "Fractional",
      formatTraits: ["ShowUnitLabel"],
      precision: 8,
      composite: {
        units: [
          {
            name: "Units.FAHRENHEIT",
          },
        ],
      },
    });
    const persistenceUnit = await provider.findUnitByName("Units.K");
    const formatterSpec = await FormatterSpec.create("Test", format, provider, persistenceUnit);
    const formatted = formatterSpec.applyFormatting(150);
    expect(formatted).to.eql("-189 5/8 °F");
  });

  it("should handle zero Kelvin (absolute zero) conversion", async () => {
    const format = await Format.createFromJSON("Test", provider, {
      type: "Decimal",
      formatTraits: ["ShowUnitLabel"],
      precision: 2,
      composite: {
        units: [
          {
            name: "Units.FAHRENHEIT",
          },
        ],
      },
    });
    const persistenceUnit = await provider.findUnitByName("Units.K");
    const formatterSpec = await FormatterSpec.create("Test", format, provider, persistenceUnit);
    const formatted = formatterSpec.applyFormatting(0);
    expect(formatted).to.eql("-459.67 °F");
  });

  it("should handle positive temperature conversion correctly", async () => {
    const format = await Format.createFromJSON("Test", provider, {
      type: "Decimal",
      formatTraits: ["ShowUnitLabel", "TrailZeroes"],
      precision: 2,
      composite: {
        units: [
          {
            name: "Units.FAHRENHEIT",
          },
        ],
      },
    });
    const persistenceUnit = await provider.findUnitByName("Units.K");
    const formatterSpec = await FormatterSpec.create("Test", format, provider, persistenceUnit);
    const formatted = formatterSpec.applyFormatting(373.15);
    expect(formatted).to.eql("212.00 °F");
  });

  it("should convert negative Celsius to positive Kelvin", async () => {
    const format = await Format.createFromJSON("Test", provider, {
      type: "Decimal",
      formatTraits: ["ShowUnitLabel"],
      precision: 2,
      composite: {
        units: [
          {
            name: "Units.K",
            label: "K"
          },
        ],
      },
    });
    const persistenceUnit = await provider.findUnitByName("Units.CELSIUS");
    const formatterSpec = await FormatterSpec.create("Test", format, provider, persistenceUnit);
    const formatted = formatterSpec.applyFormatting(-100);
    expect(formatted).to.eql("173.15 K");
  });

  it("should convert negative Fahrenheit to positive Rankine", async () => {
    const format = await Format.createFromJSON("Test", provider, {
      type: "Decimal",
      formatTraits: ["ShowUnitLabel"],
      precision: 2,
      composite: {
        units: [
          {
            name: "Units.RANKINE",
          },
        ],
      },
    });
    const persistenceUnit = await provider.findUnitByName("Units.FAHRENHEIT");
    const formatterSpec = await FormatterSpec.create("Test", format, provider, persistenceUnit);
    const formatted = formatterSpec.applyFormatting(-200);
    expect(formatted).to.eql("259.67 °R");
  });
});
