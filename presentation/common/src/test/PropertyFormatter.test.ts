/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as moq from "typemoq";
import {
  FormatProps, KindOfQuantityProps, PhenomenonProps, Schema, SchemaContext, SchemaItemType, schemaItemTypeToString, SchemaProps, UnitProps,
  UnitSystemProps,
} from "@itwin/ecschema-metadata";
import { Content } from "../presentation-common/content/Content";
import { NestedContentValue } from "../presentation-common/content/Value";
import { ContentPropertyValueFormatter, PropertyValueFormatter } from "../presentation-common/PropertyFormatter";
import {
  createTestContentDescriptor, createTestContentItem, createTestNestedContentField, createTestPropertiesContentField, createTestPropertyInfo,
} from "./_helpers";

describe("PropertyValueFormatter", () => {
  let formatter: PropertyValueFormatter;

  beforeEach(async () => {
    const schemaContext = new SchemaContext();
    await Schema.fromJson(schemaProps, schemaContext);
    formatter = new PropertyValueFormatter(schemaContext);
  });

  describe("getFormatterSpec", () => {
    it("creates FormatterSpec", async () => {
      const formatterSpec = await formatter.getFormatterSpec({
        koqName: "TestSchema:TestKOQ",
        unitSystem: "metric",
      });
      expect(formatterSpec).to.not.be.undefined;
    });

    it("returns undefined if schema is not found", async () => {
      const formatterSpec = await formatter.getFormatterSpec({
        koqName: "InvalidSchema:TestKOQ",
        unitSystem: "metric",
      });
      expect(formatterSpec).to.be.undefined;
    });

    it("returns undefined if KOQ is not found", async () => {
      const formatterSpec = await formatter.getFormatterSpec({
        koqName: "TestSchema:InvalidKOQ",
        unitSystem: "metric",
      });
      expect(formatterSpec).to.be.undefined;
    });

    it("returns undefined if KOQ does not have formats", async () => {
      const formatterSpec = await formatter.getFormatterSpec({
        koqName: "TestSchema:TestKOQNoPresentationUnit",
        unitSystem: "metric",
      });
      expect(formatterSpec).to.be.undefined;
    });
  });

  describe("getParserSpec", () => {
    it("creates ParserSpec", async () => {
      const parserSpec = await formatter.getParserSpec({
        koqName: "TestSchema:TestKOQ",
        unitSystem: "metric",
      });
      expect(parserSpec).to.not.be.undefined;
    });

    it("returns undefined if schema is not found", async () => {
      const parserSpec = await formatter.getParserSpec({
        koqName: "InvalidSchema:TestKOQ",
        unitSystem: "metric",
      });
      expect(parserSpec).to.be.undefined;
    });

    it("returns undefined if KOQ is not found", async () => {
      const parserSpec = await formatter.getParserSpec({
        koqName: "TestSchema:InvalidKOQ",
        unitSystem: "metric",
      });
      expect(parserSpec).to.be.undefined;
    });

    it("returns undefined if KOQ does not have formats", async () => {
      const parserSpec = await formatter.getParserSpec({
        koqName: "TestSchema:TestKOQNoPresentationUnit",
        unitSystem: "metric",
      });
      expect(parserSpec).to.be.undefined;
    });
  });

  describe("format", () => {
    it("formats value using 'Metric' system", async () => {
      const formatted = await formatter.format(1.5, {
        koqName: "TestSchema:TestKOQ",
        unitSystem: "metric",
      });
      expect(formatted).to.be.eq(`1,5 ${metricUnit.label}`);
    });

    it("formats value using 'Imperial' system", async () => {
      const formatted = await formatter.format(1.5, {
        koqName: "TestSchema:TestKOQ",
        unitSystem: "imperial",
      });
      expect(formatted).to.be.eq(`1,5 ${imperialUnit.label}`);
    });

    it("formats value using 'UsCustomary' system", async () => {
      const formatted = await formatter.format(1.5, {
        koqName: "TestSchema:TestKOQ",
        unitSystem: "usCustomary",
      });
      expect(formatted).to.be.eq(`1,5 ${usCustomUnit.label}`);
    });

    it("formats value using 'UsSurvey' system", async () => {
      const formatted = await formatter.format(1.5, {
        koqName: "TestSchema:TestKOQ",
        unitSystem: "usSurvey",
      });
      expect(formatted).to.be.eq(`1,5 ${usSurveyUnit.label}`);
    });

    it("formats value using default format", async () => {
      const formatted = await formatter.format(1.5, {
        koqName: "TestSchema:TestKOQOnlyMetric",
        unitSystem: "imperial",
      });
      expect(formatted).to.be.eq(`1,5 ${metricUnit.label}`);
    });

    it("returns `undefined` if format is not found", async () => {
      const formatted = await formatter.format(1.5, {
        koqName: "TestSchema:InvalidKoq",
        unitSystem: "imperial",
      });
      expect(formatted).to.be.undefined;
    });
  });
});

describe("ContentPropertyValueFormatter", () => {
  let formatter: ContentPropertyValueFormatter;
  const propertyValueFormatterMock = moq.Mock.ofType<PropertyValueFormatter>();
  const koqField = createTestPropertiesContentField({
    name: "koqFieldName",
    properties: [{
      property: createTestPropertyInfo({ name: "koqProperty", kindOfQuantity: { label: "Koq Props", name: "TestSchema:TestKoq", persistenceUnit: "Units:M" } }),
    }],
  });
  const simplePropField = createTestPropertiesContentField({
    name: "simpleFieldName",
    properties: [{
      property: createTestPropertyInfo({ name: "simpleProperty" }),
    }],
  });

  beforeEach(() => {
    propertyValueFormatterMock
      .setup(async (x) => x.format(moq.It.isAny(), moq.It.is((options) => options.koqName === "TestSchema:TestKoq")))
      .returns(async (value) => (value as number).toString().replace(".", ","));
    formatter = new ContentPropertyValueFormatter(propertyValueFormatterMock.object, "metric");
  });

  afterEach(() => {
    propertyValueFormatterMock.reset();
  });

  it("formats content item value", async () => {
    const descriptor = createTestContentDescriptor({ fields: [koqField, simplePropField] });
    const contentItem = createTestContentItem({
      displayValues: {
        [koqField.name]: "1.5",
        [simplePropField.name]: "1.5",
      },
      values: {
        [koqField.name]: 1.5,
        [simplePropField.name]: "1.5",
      },
    });
    const content = new Content(descriptor, [contentItem]);

    const formattedContent = await formatter.formatContent(content);
    expect(formattedContent.contentSet[0].displayValues[koqField.name]).to.be.eq("1,5");
    expect(formattedContent.contentSet[0].displayValues[simplePropField.name]).to.be.eq("1.5");
  });

  it("does not format content item value if formatter returns `undefined`", async () => {
    propertyValueFormatterMock.reset();
    propertyValueFormatterMock.setup(async (x) => x.format(moq.It.isAny(), moq.It.isAny())).returns(async () => undefined);
    const descriptor = createTestContentDescriptor({ fields: [koqField] });
    const contentItem = createTestContentItem({
      displayValues: {
        [koqField.name]: "1.5",
      },
      values: {
        [koqField.name]: 1.5,
      },
    });
    const content = new Content(descriptor, [contentItem]);

    const formattedContent = await formatter.formatContent(content);
    expect(formattedContent.contentSet[0].displayValues[koqField.name]).to.be.eq("1.5");
  });

  it("formats nested content item value", async () => {
    const nestedContentField = createTestNestedContentField({
      name: "nestedContentFieldName",
      nestedFields: [koqField, simplePropField],
    });
    const descriptor = createTestContentDescriptor({ fields: [nestedContentField] });
    const contentItem = createTestContentItem({
      displayValues: {
        [nestedContentField.name]: {
          displayValues: {
            [koqField.name]: "1.5",
            [simplePropField.name]: "1.5",
          },
        },
      },
      values: {
        [nestedContentField.name]: [{
          displayValues: {
            [koqField.name]: "1.5",
            [simplePropField.name]: "1.5",
          },
          values: {
            [koqField.name]: 1.5,
            [simplePropField.name]: "1.5",
          },
          primaryKeys: [],
          mergedFieldNames: [],
        }],
      },
    });
    const content = new Content(descriptor, [contentItem]);

    const formattedContent = await formatter.formatContent(content);
    const nestedContentValue = formattedContent.contentSet[0].values[nestedContentField.name] as NestedContentValue[];
    expect(nestedContentValue[0].displayValues[koqField.name]).to.be.eq("1,5");
    expect(nestedContentValue[0].displayValues[simplePropField.name]).to.be.eq("1.5");
  });

  it("handles merged nested field", async () => {
    const nestedContentField = createTestNestedContentField({
      name: "nestedContentFieldName",
      nestedFields: [simplePropField],
    });
    const descriptor = createTestContentDescriptor({ fields: [nestedContentField, koqField] });
    const contentItem = createTestContentItem({
      displayValues: {
        [nestedContentField.name]: "*Merged*",
        [koqField.name]: "1.5",
      },
      values: {
        [nestedContentField.name]: undefined,
        [koqField.name]: 1.5,
      },
      mergedFieldNames: [nestedContentField.name],
    });
    const content = new Content(descriptor, [contentItem]);

    const formattedContent = await formatter.formatContent(content);
    expect(formattedContent.contentSet[0].displayValues[nestedContentField.name]).to.be.eq("*Merged*");
    expect(formattedContent.contentSet[0].displayValues[koqField.name]).to.be.eq("1,5");
  });
});

const metricUnit: UnitProps = {
  schemaItemType: schemaItemTypeToString(SchemaItemType.Unit),
  name: "MetricUnit",
  definition: "MetricUnit",
  label: "Metric",
  phenomenon: "TestSchema.TestPhenomenon",
  unitSystem: "TestSchema.Metric",
  schema: "TestSchema",
};

const imperialUnit: UnitProps = {
  schemaItemType: schemaItemTypeToString(SchemaItemType.Unit),
  name: "ImperialUnit",
  definition: "MetricUnit",
  numerator: 1,
  label: "Imperial",
  phenomenon: "TestSchema.TestPhenomenon",
  unitSystem: "TestSchema.Imperial",
  schema: "TestSchema",
};

const usSurveyUnit: UnitProps = {
  schemaItemType: schemaItemTypeToString(SchemaItemType.Unit),
  name: "UsSurveyUnit",
  definition: "MetricUnit",
  numerator: 1,
  label: "UsSurvey",
  phenomenon: "TestSchema.TestPhenomenon",
  unitSystem: "TestSchema.UsSurvey",
  schema: "TestSchema",
};

const usCustomUnit: UnitProps = {
  schemaItemType: schemaItemTypeToString(SchemaItemType.Unit),
  name: "UsCustomUnit",
  definition: "MetricUnit",
  numerator: 1,
  label: "UsCustom",
  phenomenon: "TestSchema.TestPhenomenon",
  unitSystem: "TestSchema.UsCustom",
  schema: "TestSchema",
};

const metricUnitSystem: UnitSystemProps = {
  schemaItemType: schemaItemTypeToString(SchemaItemType.UnitSystem),
  name: "Metric",
  schema: "TestSchema",
  description: "Test Metric Unit System",
};

const imperialUnitSystem: UnitSystemProps = {
  schemaItemType: schemaItemTypeToString(SchemaItemType.UnitSystem),
  name: "Imperial",
  schema: "TestSchema",
  description: "Test Imperial Unit System",
};

const usCustomUnitSystem: UnitSystemProps = {
  schemaItemType: schemaItemTypeToString(SchemaItemType.UnitSystem),
  name: "UsCustom",
  schema: "TestSchema",
  description: "Test UsCustom Unit System",
};

const usSurveyUnitSystem: UnitSystemProps = {
  schemaItemType: schemaItemTypeToString(SchemaItemType.UnitSystem),
  name: "UsSurvey",
  schema: "TestSchema",
  description: "Test UsSurvey Unit System",
};

const phenomenon: PhenomenonProps = {
  schemaItemType: schemaItemTypeToString(SchemaItemType.Phenomenon),
  definition: "PhenomenonDefinition",
  name: "TestPhenomenon",
};

const metricFormat: FormatProps = {
  schemaItemType: schemaItemTypeToString(SchemaItemType.Format),
  name: "MetricFormat",
  schema: "TestSchema",
  type: "decimal",
  decimalSeparator: ",",
  formatTraits: ["ShowUnitLabel"],
  composite: {
    units: [{ name: "TestSchema.MetricUnit" }],
    includeZero: true,
    spacer: " ",
  },
};

const imperialFormat: FormatProps = {
  schemaItemType: schemaItemTypeToString(SchemaItemType.Format),
  name: "ImperialFormat",
  schema: "TestSchema",
  type: "decimal",
  decimalSeparator: ",",
  formatTraits: ["ShowUnitLabel"],
  composite: {
    units: [{ name: "TestSchema.ImperialUnit" }],
    includeZero: true,
    spacer: " ",
  },
};

const usSurveyFormat: FormatProps = {
  schemaItemType: schemaItemTypeToString(SchemaItemType.Format),
  name: "UsSurveyFormat",
  schema: "TestSchema",
  type: "decimal",
  decimalSeparator: ",",
  formatTraits: ["ShowUnitLabel"],
  composite: {
    units: [{ name: "TestSchema.UsSurveyUnit" }],
    includeZero: true,
    spacer: " ",
  },
};

const usCustomFormat: FormatProps = {
  schemaItemType: schemaItemTypeToString(SchemaItemType.Format),
  name: "UsCustomFormat",
  schema: "TestSchema",
  type: "decimal",
  decimalSeparator: ",",
  formatTraits: ["ShowUnitLabel"],
  composite: {
    units: [{ name: "TestSchema.UsCustomUnit" }],
    includeZero: true,
    spacer: " ",
  },
};

const koq: KindOfQuantityProps = {
  schemaItemType: schemaItemTypeToString(SchemaItemType.KindOfQuantity),
  name: "TestKOQ",
  schema: "TestSchema",
  relativeError: 6,
  persistenceUnit: "TestSchema.MetricUnit",
  presentationUnits: ["TestSchema.MetricFormat", "TestSchema.ImperialFormat", "TestSchema.UsSurveyFormat", "TestSchema.UsCustomFormat"],
};

const koqOnlyMetric: KindOfQuantityProps = {
  schemaItemType: schemaItemTypeToString(SchemaItemType.KindOfQuantity),
  name: "TestKOQOnlyMetric",
  schema: "TestSchema",
  relativeError: 6,
  persistenceUnit: "TestSchema.MetricUnit",
  presentationUnits: ["TestSchema.MetricFormat"],
};

const koqNoPresentationUnits: KindOfQuantityProps = {
  schemaItemType: schemaItemTypeToString(SchemaItemType.KindOfQuantity),
  name: "TestKOQNoPresentationUnit",
  schema: "TestSchema",
  relativeError: 6,
  persistenceUnit: "TestSchema.MetricUnit",
};

const schemaProps: SchemaProps = {
  $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
  name: "TestSchema",
  alias: "test",
  version: "1.0.0",
  items: {
    [metricUnit.name!]: metricUnit,
    [imperialUnit.name!]: imperialUnit,
    [usCustomUnit.name!]: usCustomUnit,
    [usSurveyUnit.name!]: usSurveyUnit,
    [metricUnitSystem.name!]: metricUnitSystem,
    [imperialUnitSystem.name!]: imperialUnitSystem,
    [usSurveyUnitSystem.name!]: usSurveyUnitSystem,
    [usCustomUnitSystem.name!]: usCustomUnitSystem,
    [metricFormat.name!]: metricFormat,
    [imperialFormat.name!]: imperialFormat,
    [usSurveyFormat.name!]: usSurveyFormat,
    [usCustomFormat.name!]: usCustomFormat,
    [phenomenon.name!]: phenomenon,
    [koq.name!]: koq,
    [koqOnlyMetric.name!]: koqOnlyMetric,
    [koqNoPresentationUnits.name!]: koqNoPresentationUnits,
  },
};
