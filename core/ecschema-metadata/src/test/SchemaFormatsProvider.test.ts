/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as path from "path";
import { expect } from "chai";
import { SchemaContext } from "../Context";
import { SchemaFormatsProvider } from "../SchemaFormatsProvider";
import { deserializeXmlSync } from "./TestUtils/DeserializationHelpers";
import { SchemaItemFormatProps } from "../Deserialization/JsonProps";
import { SchemaUnitProvider } from "../UnitProvider/SchemaUnitProvider";
import { UNIT_EXTRA_DATA } from "./UnitProvider/UnitData";
import { Format, FormatterSpec } from "@itwin/core-quantity";
import * as Sinon from "sinon";
describe.only("SchemaFormatsProvider", () => {
  // ZOMBIES
  let context: SchemaContext;
  let formatsProvider: SchemaFormatsProvider;
  let unitsProvider: SchemaUnitProvider;

  before(() => {
    context = new SchemaContext();

    const unitSchemaFile = path.join(__dirname, "..", "..", "..", "node_modules", "@bentley", "units-schema", "Units.ecschema.xml");
    const unitSchemaXml = fs.readFileSync(unitSchemaFile, "utf-8");
    deserializeXmlSync(unitSchemaXml, context);

    const siSchemaFile = path.join(__dirname, "assets", "SIUnits.ecschema.xml");
    const siSchemaXml = fs.readFileSync(siSchemaFile, "utf-8");
    deserializeXmlSync(siSchemaXml, context);

    const metricSchemaFile = path.join(__dirname, "assets", "MetricUnits.ecschema.xml");
    const metricSchemaXml = fs.readFileSync(metricSchemaFile, "utf-8");
    deserializeXmlSync(metricSchemaXml, context);

    const usSchemaFile = path.join(__dirname, "assets", "USUnits.ecschema.xml");
    const usSchemaXml = fs.readFileSync(usSchemaFile, "utf-8");
    deserializeXmlSync(usSchemaXml, context);

    const schemaFile = path.join(__dirname, "..", "..", "..", "node_modules", "@bentley", "formats-schema", "Formats.ecschema.xml");
    const schemaXml = fs.readFileSync(schemaFile, "utf-8");
    deserializeXmlSync(schemaXml, context);

    const aecSchemaFile = path.join(__dirname, "..", "..", "..", "node_modules", "@bentley", "aec-units-schema", "AecUnits.ecschema.xml");
    const aecSchemaXml = fs.readFileSync(aecSchemaFile, "utf-8");
    deserializeXmlSync(aecSchemaXml, context);

    formatsProvider = new SchemaFormatsProvider(context);
    unitsProvider = new SchemaUnitProvider(context, UNIT_EXTRA_DATA);

  });

  it("should throw an error when format doesn't follow valid name convention", async () => {
    await expect(formatsProvider.getFormat("nonExistentFormat")).to.be.rejected;
  });
  it("should return undefined when format is not found", async () => {
    const format = await formatsProvider.getFormat("FakeSchema.nonExistentFormat");
    expect(format).to.be.undefined;
  });

  // Getters
  it("should return a format when it exists", async () => {
    const format = await formatsProvider.getFormat("Formats.AmerI");
    expect(format).not.to.be.undefined;
  });

  it("should return a format by KindOfQuantity", async () => {
    const format = await formatsProvider.getFormatByKindOfQuantity("AecUnits.LENGTH");
    expect(format).not.to.be.undefined;
    expect(format?.composite?.units.length).to.be.greaterThan(0);
  });
  // Setters

  it("should add a format", async () => {
    const spy = Sinon.spy();
    formatsProvider.onFormatUpdated.addListener(spy);
    const format: SchemaItemFormatProps = {
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
    expect(spy.calledWith(formatName)).to.be.true;
    formatsProvider.onFormatUpdated.removeListener(spy);
  });

  it("should format a length quantity to meters given a KoQ and unit provider", async () => {
    const formatProps = await formatsProvider.getFormatByKindOfQuantity("AecUnits.LENGTH");
    expect(formatProps).not.to.be.undefined;
    const format = await Format.createFromJSON("testFormat", unitsProvider, formatProps!);
    const persistenceUnit = await unitsProvider.findUnitByName("Units.M"); // or unitsProvider.findUnit("m");
    const formatSpec = await FormatterSpec.create("TestSpec", format, unitsProvider, persistenceUnit);

    const result = formatSpec.applyFormatting(50);
    expect(result).to.equal("50.0 m");

  });

  it("should format a length quantity to kilometers given a KoQ and unit provider", async () => {
    const formatProps = await formatsProvider.getFormatByKindOfQuantity("AecUnits.LENGTH_LONG");
    expect(formatProps).not.to.be.undefined;
    const format = await Format.createFromJSON("testFormat", unitsProvider, formatProps!);
    const persistenceUnit = await unitsProvider.findUnitByName("Units.M"); // or unitsProvider.findUnit("m");
    const formatSpec = await FormatterSpec.create("TestSpec", format, unitsProvider, persistenceUnit);

    const result = formatSpec.applyFormatting(50);
    expect(result).to.equal("0.05 km");

  });
});