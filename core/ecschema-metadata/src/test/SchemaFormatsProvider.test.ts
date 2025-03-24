import { expect } from "chai";
import { SchemaContext } from "../Context";
import { SchemaFormatsProvider } from "../SchemaFormatsProvider";
import * as fs from "fs";
import * as path from "path";
import { deserializeXmlSync } from "./TestUtils/DeserializationHelpers";

describe.only("SchemaFormatsProvider", () => {
  // ZOMBIES
  let context: SchemaContext;
  let formatsProvider: SchemaFormatsProvider;

  before(() => {
    context = new SchemaContext();

    const schemaFile = path.join(__dirname, "..", "..", "..", "node_modules", "@bentley", "formats-schema", "Formats.ecschema.xml");
    const schemaXml = fs.readFileSync(schemaFile, "utf-8");
    deserializeXmlSync(schemaXml, context);

    const aecSchemaFile = path.join(__dirname, "..", "..", "..", "node_modules", "@bentley", "aec-units-schema", "AecUnits.ecschema.xml");
    const aecSchemaXml = fs.readFileSync(aecSchemaFile, "utf-8");
    deserializeXmlSync(aecSchemaXml, context);

    formatsProvider = new SchemaFormatsProvider(context);
  });


  it("should return undefined when format is not found", () => {
    const format = formatsProvider.getFormat("nonExistentFormat");
    expect(format).to.be.undefined;
  });

  // Getters
  it("should return a format when it exists", () => {
    const format = formatsProvider.getFormat("Formats.AmerI");
    expect(format).not.to.be.undefined;
  });


  // Setters

  // it("should add a format", () => {
  //   const format = {
  //     label: "NewFormat",
  //     type: "Fractional",
  //     precision: 8,
  //     formatTraits: ["keepSingleZero", "showUnitLabel"],
  //     uomSeparator: "",
  //   };
  //   const retrievedFormat = formatsProvider.getFormat("NewFormat");
  //   expect(retrievedFormat).toEqual(format);

  // });

  // it("should throw an error when adding a format with an existing id", () => {
  //   const format = {
  //     label: "NewFormat",
  //     type: "Fractional",
  //     precision: 8,
  //   }

  //   expect(() => {
  //     formatsProvider.addFormat("AmerI", format);
  //   }).toThrowError("Format with id AmerI already exists.");
  // });

  // it("should return a format when associated with a KindOfQuantity", () => {
  //   const format = formatsProvider.getFormatByKindOfQuantity("AecUnits.LENGTH");
  //   expect(format).toBeDefined();
  //   expect(format!.precision).toEqual(4);
  // });

  // it("should format a length quantity to meters given a KoQ and unit provider", async () => {
  //   const formatProps = formatsProvider.getFormatByKindOfQuantity("AecUnits.LENGTH");
  //   expect(formatProps).toBeDefined();
  //   const unitsProvider = new BasicUnitsProvider();
  //   const format = await Format.createFromJSON("testFormat", unitsProvider, formatProps!);
  //   const persistenceUnit = await unitsProvider.findUnitByName("Units.M"); // or unitsProvider.findUnit("m");
  //   const formatSpec = await FormatterSpec.create("TestSpec", format, unitsProvider, persistenceUnit);

  //   const result = formatSpec.applyFormatting(50);
  //   expect(result).toEqual("50.0 m");

  // });

  // it("should format a length quantity to kilometers given a KoQ and unit provider", async () => {
  //   const formatProps = formatsProvider.getFormatByKindOfQuantity("AecUnits.LENGTH_LONG");
  //   expect(formatProps).toBeDefined();
  //   const unitsProvider = new BasicUnitsProvider();
  //   const format = await Format.createFromJSON("testFormat", unitsProvider, formatProps!);
  //   const persistenceUnit = await unitsProvider.findUnitByName("Units.M"); // or unitsProvider.findUnit("m");
  //   const formatSpec = await FormatterSpec.create("TestSpec", format, unitsProvider, persistenceUnit);

  //   const result = formatSpec.applyFormatting(50);
  //   expect(result).toEqual("0.05 km");

  // });
});