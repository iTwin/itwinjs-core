/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as path from "path";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SchemaContext } from "../../Context";
import { SchemaFormatsProvider } from "../../Formatting/SchemaFormatsProvider";
import { deserializeXmlSync } from "../TestUtils/DeserializationHelpers";
import { SchemaItemFormatProps } from "../../Deserialization/JsonProps";

describe("SchemaFormatsProvider", () => {
  let context: SchemaContext;
  let formatsProvider: SchemaFormatsProvider;

  beforeAll(() => {
    context = new SchemaContext();

    const unitSchemaFile = path.resolve(process.cwd(), "node_modules", "@bentley", "units-schema", "Units.ecschema.xml");
    const unitSchemaXml = fs.readFileSync(unitSchemaFile, "utf-8");
    deserializeXmlSync(unitSchemaXml, context);

    const siSchemaFile = path.resolve(process.cwd(), "src", "test", "assets", "SIUnits.ecschema.xml");
    const siSchemaXml = fs.readFileSync(siSchemaFile, "utf-8");
    deserializeXmlSync(siSchemaXml, context);

    const metricSchemaFile = path.resolve(process.cwd(), "src", "test", "assets", "MetricUnits.ecschema.xml");
    const metricSchemaXml = fs.readFileSync(metricSchemaFile, "utf-8");
    deserializeXmlSync(metricSchemaXml, context);

    const usSchemaFile = path.resolve(process.cwd(), "src", "test", "assets", "USUnits.ecschema.xml");
    const usSchemaXml = fs.readFileSync(usSchemaFile, "utf-8");
    deserializeXmlSync(usSchemaXml, context);

    const bisCustomAttributeSchemaFile = path.resolve(process.cwd(), "node_modules", "@bentley", "bis-custom-attributes-schema", "BisCustomAttributes.ecschema.xml");
    const bisCustomAttributeSchemaXml = fs.readFileSync(bisCustomAttributeSchemaFile, "utf-8");
    deserializeXmlSync(bisCustomAttributeSchemaXml, context);

    const coreCustomAttributeSchemaFile = path.resolve(process.cwd(), "node_modules", "@bentley", "core-custom-attributes-schema", "CoreCustomAttributes.ecschema.xml");
    const coreCustomAttributeSchemaXml = fs.readFileSync(coreCustomAttributeSchemaFile, "utf-8");
    deserializeXmlSync(coreCustomAttributeSchemaXml, context);



    const schemaFile = path.resolve(process.cwd(), "node_modules", "@bentley", "formats-schema", "Formats.ecschema.xml");
    const schemaXml = fs.readFileSync(schemaFile, "utf-8");
    deserializeXmlSync(schemaXml, context);

    const aecSchemaFile = path.resolve(process.cwd(), "node_modules", "@bentley", "aec-units-schema", "AecUnits.ecschema.xml");
    const aecSchemaXml = fs.readFileSync(aecSchemaFile, "utf-8");
    deserializeXmlSync(aecSchemaXml, context);

    const roadRailSchemaFile = path.resolve(process.cwd(), "node_modules", "@bentley", "road-rail-units-schema", "RoadRailUnits.ecschema.xml");
    const roadRailSchemaXml = fs.readFileSync(roadRailSchemaFile, "utf-8");
    deserializeXmlSync(roadRailSchemaXml, context);

    const cifUnitsSchemaFile = path.resolve(process.cwd(), "node_modules", "@bentley", "cif-units-schema", "CifUnits.ecschema.xml");
    const cifUnitsSchemaXml = fs.readFileSync(cifUnitsSchemaFile, "utf-8");
    deserializeXmlSync(cifUnitsSchemaXml, context);
  });

  beforeEach(() => {
    formatsProvider = new SchemaFormatsProvider(context, "metric");
  });

  it("should throw an error when format doesn't follow valid name convention", async () => {
    await expect(formatsProvider.getFormat("nonExistentFormat")).rejects.toThrow();
  });

  it("should return undefined when format is not found", async () => {
    const format = await formatsProvider.getFormat("FakeSchema.nonExistentFormat");
    expect(format).toBeUndefined();
  });

  it("should return a format from the Formats schema", async () => {
    const format = await formatsProvider.getFormat("Formats.AmerI");
    expect(format).not.toBeUndefined();
    expect(format?.label).toBe("Inches");
  });

  it("retrieve different default presentation formats from a KoQ based on different unit systems", async () => {
    formatsProvider.unitSystem = "imperial";

    const formatPropsImperial = await formatsProvider.getFormat("AecUnits.LENGTH_LONG");
    expect(formatPropsImperial).not.toBeUndefined();
    expect(formatPropsImperial!.composite?.units[0].name).toBe("Units.FT");
    expect(formatPropsImperial?.label).toBe("Long Length");

    formatsProvider.unitSystem = "metric";
    const formatPropsMetric = await formatsProvider.getFormat("AecUnits.LENGTH");
    expect(formatPropsMetric).not.toBeUndefined();
    expect(formatPropsMetric!.composite?.units[0].name).toBe("Units.M");
    expect(formatPropsMetric?.label).toBe("Length");
  });

  it("when using metric system, should return presentation format from KoQ that uses UnitSystem.METRIC", async () => {
    formatsProvider.unitSystem = "metric";

    let formatProps: SchemaItemFormatProps | undefined;
    formatProps = await formatsProvider.getFormat("AecUnits.LENGTH_SHORT");
    expect(formatProps).not.toBeUndefined();
    expect(formatProps!.composite?.units[0].name).toBe("Units.MM");
    expect(formatProps?.label).toBe("Short Length");

    formatProps = await formatsProvider.getFormat("AecUnits.AREA_LARGE");
    expect(formatProps).not.toBeUndefined();
    expect(formatProps!.composite?.units[0].name).toBe("Units.SQ_KM");
    expect(formatProps?.label).toBe("Large Area");
  });

  it("when using us customary unit system, should return presentation formats that use UnitSystem.USCUSTOM", async () => {
    formatsProvider.unitSystem = "usCustomary";

    let formatProps: SchemaItemFormatProps | undefined;
    formatProps = await formatsProvider.getFormat("AecUnits.AREA");
    expect(formatProps).not.toBeUndefined();
    expect(formatProps!.composite?.units[0].name).toBe("Units.SQ_FT");
    expect(formatProps?.label).toBe("Area");

    formatProps = await formatsProvider.getFormat("AecUnits.LIQUID_VOLUME");
    expect(formatProps).not.toBeUndefined();
    expect(formatProps!.composite?.units[0].name).toBe("Units.GALLON");
    expect(formatProps?.label).toBe("Liquid Volume");
  });

  it("when using us survey unit system, should return presentation formats that use UnitSystem.USSURVEY", async () => {
    formatsProvider.unitSystem = "usSurvey";

    const formatProps = await formatsProvider.getFormat("RoadRailUnits.LENGTH");
    expect(formatProps).not.toBeUndefined();
    expect(formatProps!.composite?.units[0].name).toBe("Units.US_SURVEY_FT");
    expect(formatProps?.label).toBe("Road & Rail Length");

  });

  it("should return a persistence format that uses UnitSystem.FINANCE regardless of the unit system", async () => {
    formatsProvider.unitSystem = "metric";

    const formatProps = await formatsProvider.getFormat("CifUnits.CURRENCY");
    expect(formatProps).not.toBeUndefined();
    expect(formatProps!.composite?.units[0].name).toBe("Units.MONETARY_UNIT");
    expect(formatProps?.label).toBe("Civil Designer Products Currency");

  });
});
