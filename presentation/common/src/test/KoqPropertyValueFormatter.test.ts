/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import {
  KindOfQuantityProps,
  PhenomenonProps,
  Schema,
  SchemaContext,
  SchemaItemFormatProps,
  SchemaItemType,
  schemaItemTypeToString,
  SchemaItemUnitProps,
  SchemaProps,
  UnitSystemProps,
} from "@itwin/ecschema-metadata";
import { KoqPropertyValueFormatter } from "../presentation-common/KoqPropertyValueFormatter";

describe("KoqPropertyValueFormatter", () => {
  let formatter: KoqPropertyValueFormatter;

  beforeEach(async () => {
    const schemaContext = new SchemaContext();
    await Schema.fromJson(schemaProps, schemaContext);
    formatter = new KoqPropertyValueFormatter(schemaContext, {
      [phenomenon.name!]: {
        unitSystems: ["usSurvey"],
        format: usSurveyFormat,
      },
    });
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

    it("returns undefined if KOQ does not have matching formats", async () => {
      const formatterSpec = await formatter.getFormatterSpec({
        koqName: "TestSchema:TestKOQNoPresentationUnit",
        unitSystem: "imperial",
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

    it("returns undefined if KOQ does not have matching formats", async () => {
      const parserSpec = await formatter.getParserSpec({
        koqName: "TestSchema:TestKOQNoPresentationUnit",
        unitSystem: "imperial",
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

    it("formats value using 'Metric' system when KoQ supports metric and SI", async () => {
      const formatted = await formatter.format(1.5, {
        koqName: "TestSchema:TestKoqMetricAndSi",
        unitSystem: "metric",
      });
      expect(formatted).to.be.eq(`1,5 ${metricUnit.label}`);
    });

    it("formats value format in default formats map", async () => {
      const formatted = await formatter.format(1.5, {
        koqName: "TestSchema:TestKOQOnlyMetric",
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

    it("formats value using persistence unit format if it matches unit system", async () => {
      const formatted = await formatter.format(1.5, {
        koqName: "TestSchema:TestKOQNoPresentationUnit",
        unitSystem: "metric",
      });
      expect(formatted).to.be.eq(`1.5 ${metricUnit.label}`);
    });

    it("formats value using default format if unit system is not provided", async () => {
      const formatted = await formatter.format(1.5, {
        koqName: "TestSchema:TestKOQ",
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

const siUnit: SchemaItemUnitProps = {
  schemaItemType: schemaItemTypeToString(SchemaItemType.Unit),
  name: "SiUnit",
  definition: "SiUnit",
  label: "SI",
  phenomenon: "TestSchema.TestPhenomenon",
  unitSystem: "TestSchema.SI",
  schema: "TestSchema",
};

const metricUnit: SchemaItemUnitProps = {
  schemaItemType: schemaItemTypeToString(SchemaItemType.Unit),
  name: "MetricUnit",
  definition: "SiUnit",
  label: "Metric",
  phenomenon: "TestSchema.TestPhenomenon",
  unitSystem: "TestSchema.Metric",
  schema: "TestSchema",
};

const imperialUnit: SchemaItemUnitProps = {
  schemaItemType: schemaItemTypeToString(SchemaItemType.Unit),
  name: "ImperialUnit",
  definition: "SiUnit",
  numerator: 1,
  label: "Imperial",
  phenomenon: "TestSchema.TestPhenomenon",
  unitSystem: "TestSchema.Imperial",
  schema: "TestSchema",
};

const usSurveyUnit: SchemaItemUnitProps = {
  schemaItemType: schemaItemTypeToString(SchemaItemType.Unit),
  name: "UsSurveyUnit",
  definition: "SiUnit",
  numerator: 1,
  label: "UsSurvey",
  phenomenon: "TestSchema.TestPhenomenon",
  unitSystem: "TestSchema.UsSurvey",
  schema: "TestSchema",
};

const usCustomUnit: SchemaItemUnitProps = {
  schemaItemType: schemaItemTypeToString(SchemaItemType.Unit),
  name: "UsCustomUnit",
  definition: "SiUnit",
  numerator: 1,
  label: "UsCustom",
  phenomenon: "TestSchema.TestPhenomenon",
  unitSystem: "TestSchema.UsCustom",
  schema: "TestSchema",
};

const siUnitSystem: UnitSystemProps = {
  schemaItemType: schemaItemTypeToString(SchemaItemType.UnitSystem),
  name: "SI",
  schema: "TestSchema",
  description: "Test SI Unit System",
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

const siFormat: SchemaItemFormatProps = {
  schemaItemType: schemaItemTypeToString(SchemaItemType.Format),
  name: "SiFormat",
  schema: "TestSchema",
  type: "decimal",
  decimalSeparator: ",",
  formatTraits: ["ShowUnitLabel"],
  composite: {
    units: [{ name: "TestSchema.SiUnit" }],
    includeZero: true,
    spacer: " ",
  },
};

const metricFormat: SchemaItemFormatProps = {
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

const imperialFormat: SchemaItemFormatProps = {
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

const usSurveyFormat: SchemaItemFormatProps = {
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

const usCustomFormat: SchemaItemFormatProps = {
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

const koqMetricAndSi: KindOfQuantityProps = {
  schemaItemType: schemaItemTypeToString(SchemaItemType.KindOfQuantity),
  name: "TestKoqMetricAndSi",
  schema: "TestSchema",
  relativeError: 6,
  persistenceUnit: "TestSchema.MetricUnit",
  presentationUnits: ["TestSchema.MetricFormat", "TestSchema.SiFormat"],
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
    [siUnit.name!]: siUnit,
    [metricUnit.name!]: metricUnit,
    [imperialUnit.name!]: imperialUnit,
    [usCustomUnit.name!]: usCustomUnit,
    [usSurveyUnit.name!]: usSurveyUnit,
    [siUnitSystem.name!]: siUnitSystem,
    [metricUnitSystem.name!]: metricUnitSystem,
    [imperialUnitSystem.name!]: imperialUnitSystem,
    [usSurveyUnitSystem.name!]: usSurveyUnitSystem,
    [usCustomUnitSystem.name!]: usCustomUnitSystem,
    [siFormat.name!]: siFormat,
    [metricFormat.name!]: metricFormat,
    [imperialFormat.name!]: imperialFormat,
    [usSurveyFormat.name!]: usSurveyFormat,
    [usCustomFormat.name!]: usCustomFormat,
    [phenomenon.name!]: phenomenon,
    [koq.name!]: koq,
    [koqOnlyMetric.name!]: koqOnlyMetric,
    [koqMetricAndSi.name!]: koqMetricAndSi,
    [koqNoPresentationUnits.name!]: koqNoPresentationUnits,
  },
};
