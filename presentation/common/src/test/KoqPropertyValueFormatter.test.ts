/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
import {
  KindOfQuantityProps,
  PhenomenonProps,
  Schema,
  SchemaContext,
  SchemaItemFormatProps,
  SchemaItemType,
  SchemaItemUnitProps,
  SchemaProps,
  UnitSystemProps,
} from "@itwin/ecschema-metadata";
import { KoqPropertyValueFormatter } from "../presentation-common/KoqPropertyValueFormatter.js";

describe("KoqPropertyValueFormatter", () => {
  let formatter: KoqPropertyValueFormatter;

  describe("with default props", () => {
    beforeEach(async () => {
      const schemaContext = new SchemaContext();
      await Schema.fromJson(schemaProps, schemaContext);
      formatter = new KoqPropertyValueFormatter({
        schemaContext,
      });
    });

    describe("createCachedFormatter", () => {
      it("reuses a spec for concurrent and subsequent calls with equivalent options", async () => {
        const getSpec = sinon.spy(formatter, "getFormatterSpec");
        const format = sinon.spy(formatter, "format");
        const cached = formatter.createCachedFormatter();
        const options = { koqName: "TestSchema:TestKOQ", unitSystem: "metric" as const };
        const values = [1.5, 2.5, 3.5];
        // Establish expected output without the cache, then only count calls made through the cached formatter.
        const expected = await Promise.all(values.map(async (value) => formatter.format(value, options)));
        getSpec.resetHistory();
        format.resetHistory();

        // Concurrent calls should share the pending spec lookup.
        expect(await Promise.all(values.map(async (value) => cached.format(value, { ...options })))).to.deep.equal(expected);
        // A later call should reuse the resolved spec too.
        expect(await cached.format(values[0], { ...options })).to.equal(expected[0]);
        expect(getSpec.callCount).to.equal(1);
        expect(format.called).to.be.false;
      });

      it("separates KOQs, unit systems, and format overrides", async () => {
        const getSpec = sinon.spy(formatter, "getFormatterSpec");
        const cached = formatter.createCachedFormatter();
        const options = [
          { koqName: "TestSchema:TestKOQ" },
          { koqName: "TestSchema:InvalidKOQ" },
          { koqName: "TestSchema:TestKOQ", unitSystem: "metric" as const },
          { koqName: "TestSchema:TestKOQ", unitSystem: "imperial" as const },
          { koqName: "TestSchema:TestKOQ", formatOverride: { precision: 1 } },
          { koqName: "TestSchema:TestKOQ", formatOverride: { precision: 2 } },
        ];
        const expected = await Promise.all(options.map(async (entry) => formatter.format(1.234, entry)));
        getSpec.resetHistory();

        expect(await Promise.all(options.map(async (entry) => cached.format(1.234, entry)))).to.deep.equal(expected);
        expect(await Promise.all(options.map(async (entry) => cached.format(1.234, { ...entry })))).to.deep.equal(expected);
        expect(getSpec.callCount).to.equal(options.length);
      });

      it("retains undefined results for the operation and retries in a new operation", async () => {
        const getSpec = sinon.stub(formatter, "getFormatterSpec").resolves(undefined);
        const cached = formatter.createCachedFormatter();
        const options = { koqName: "TestSchema:TestKOQ" };

        expect(await cached.format(1, options)).to.be.undefined;
        expect(await cached.format(2, { ...options })).to.be.undefined;
        expect(getSpec.callCount).to.equal(1);
        expect(await formatter.createCachedFormatter().format(1, options)).to.be.undefined;
        expect(getSpec.callCount).to.equal(2);
      });

      it("keeps existing caches independent when a new formatter picks up changed specs", async () => {
        const options = { koqName: "TestSchema:TestKOQ", unitSystem: "metric" as const };
        const initialSpec = await formatter.getFormatterSpec({ ...options, formatOverride: { precision: 1 } });
        const updatedSpec = await formatter.getFormatterSpec({ ...options, formatOverride: { precision: 2 } });
        const getSpec = sinon.stub(formatter, "getFormatterSpec");
        getSpec.onFirstCall().resolves(initialSpec);
        getSpec.onSecondCall().resolves(updatedSpec);
        const initial = formatter.createCachedFormatter();

        const initialValue = await initial.format(1.234, options);
        const updated = formatter.createCachedFormatter();
        const updatedValue = await updated.format(1.234, options);
        expect(updatedValue).not.to.equal(initialValue);
        expect(await initial.format(1.234, options)).to.equal(initialValue);
        expect(await updated.format(1.234, options)).to.equal(updatedValue);
        expect(getSpec.callCount).to.equal(2);
      });

      it("evicts rejected promises so later calls can retry", async () => {
        const error = new Error("Failed to load format");
        const getSpec = sinon.stub(formatter, "getFormatterSpec");
        getSpec.onFirstCall().rejects(error);
        getSpec.onSecondCall().resolves(undefined);
        const cached = formatter.createCachedFormatter();
        const options = { koqName: "TestSchema:TestKOQ" };

        const results = await Promise.allSettled([cached.format(1, options), cached.format(2, { ...options })]);
        expect(results).to.deep.equal([
          { status: "rejected", reason: error },
          { status: "rejected", reason: error },
        ]);
        expect(getSpec.callCount).to.equal(1);
        expect(await cached.format(3, options)).to.be.undefined;
        expect(getSpec.callCount).to.equal(2);
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

      it("uses format overrides when creating formatterSpec", async () => {
        const formatterSpec = await formatter.getFormatterSpec({
          koqName: "TestSchema:TestKOQ",
          unitSystem: "metric",
          formatOverride: {
            precision: 12,
            decimalSeparator: "-",
          },
        });

        expect(formatterSpec?.format.precision).to.equal(12);
        expect(formatterSpec?.format.decimalSeparator).to.equal("-");
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

      it("uses format overrides when creating parserSpec", async () => {
        const formatterSpec = await formatter.getFormatterSpec({
          koqName: "TestSchema:TestKOQ",
          unitSystem: "metric",
          formatOverride: {
            precision: 12,
            decimalSeparator: "-",
          },
        });

        expect(formatterSpec?.format.precision).to.equal(12);
        expect(formatterSpec?.format.decimalSeparator).to.equal("-");
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

      it("formats value using default presentation format if unit system is not provided", async () => {
        const formatted = await formatter.format(1.5, {
          koqName: "TestSchema:TestKOQ",
        });
        // Without a unit system, should use defaultPresentationFormat (first in presentationUnits)
        // For TestKOQ, that's MetricFormat
        expect(formatted).to.be.eq(`1,5 ${metricUnit.label}`);
      });

      it("formats value with implicit unit conversion when using format override with different unit system", async () => {
        const formatted = await formatter.format(1.5, {
          koqName: "TestSchema:TestKOQCrossSystemOverride",
        });
        expect(formatted).to.be.eq(`1,5 ${imperialUnit.label}`);
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

  describe("with deprecated default formats map", () => {
    beforeEach(async () => {
      const defaultFormat: SchemaItemFormatProps = {
        schemaItemType: SchemaItemType.Format,
        name: "DefaultLengthFormat",
        schema: "TestSchema",
        type: "decimal",
        decimalSeparator: ",",
        formatTraits: ["ShowUnitLabel"],
        composite: {
          units: [{ name: `${siUnit.schema}.${siUnit.name}` }],
          includeZero: true,
          spacer: " ",
        },
      };
      const schemaContext = new SchemaContext();
      await Schema.fromJson(schemaProps, schemaContext);
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      formatter = new KoqPropertyValueFormatter(schemaContext, {
        [phenomenon.name!]: {
          unitSystems: ["usSurvey", "metric"],
          format: defaultFormat,
        },
      });
    });

    describe("format", () => {
      it("formats `metric` koq value using format in default formats map", async () => {
        const formatted = await formatter.format(1.5, {
          koqName: `${koqOnlyMetric.schema}:${koqOnlyMetric.name}`,
          unitSystem: "usSurvey",
        });
        expect(formatted).to.be.eq(`1,5 ${siUnit.label}`);
      });

      it("formats `imperial` koq value using format in default formats map", async () => {
        const formatted = await formatter.format(1.5, {
          koqName: `${koqOnlyImperial.schema}:${koqOnlyImperial.name}`,
          unitSystem: "usSurvey",
        });
        expect(formatted).to.be.eq(`1,5 ${siUnit.label}`);
      });

      it("formats `usCustomary` koq value using format in default formats map", async () => {
        const formatted = await formatter.format(1.5, {
          koqName: `${koqOnlyUsCustomary.schema}:${koqOnlyUsCustomary.name}`,
          unitSystem: "usSurvey",
        });
        expect(formatted).to.be.eq(`1,5 ${siUnit.label}`);
      });

      it("formats `usSurvey` koq value using format in default formats map", async () => {
        const formatted = await formatter.format(1.5, {
          koqName: `${koqOnlyUsSurvey.schema}:${koqOnlyUsSurvey.name}`,
          unitSystem: "metric",
        });
        expect(formatted).to.be.eq(`1,5 ${siUnit.label}`);
      });

      it("formats using default presentation format when format in default formats map is not found", async () => {
        const formatted = await formatter.format(1.5, {
          koqName: `${koqOnlyUsSurvey.schema}:${koqOnlyUsSurvey.name}`,
          unitSystem: "imperial",
        });
        expect(formatted).to.be.eq(`1,5 ${usSurveyUnit.label}`);
      });
    });
  });
});

const siUnit: SchemaItemUnitProps = {
  schemaItemType: SchemaItemType.Unit,
  name: "SiUnit",
  definition: "SiUnit",
  label: "SI",
  phenomenon: "TestSchema.TestPhenomenon",
  unitSystem: "TestSchema.SI",
  schema: "TestSchema",
};

const metricUnit: SchemaItemUnitProps = {
  schemaItemType: SchemaItemType.Unit,
  name: "MetricUnit",
  definition: "SiUnit",
  label: "Metric",
  phenomenon: "TestSchema.TestPhenomenon",
  unitSystem: "TestSchema.Metric",
  schema: "TestSchema",
};

const imperialUnit: SchemaItemUnitProps = {
  schemaItemType: SchemaItemType.Unit,
  name: "ImperialUnit",
  definition: "SiUnit",
  numerator: 1,
  label: "Imperial",
  phenomenon: "TestSchema.TestPhenomenon",
  unitSystem: "TestSchema.Imperial",
  schema: "TestSchema",
};

const usSurveyUnit: SchemaItemUnitProps = {
  schemaItemType: SchemaItemType.Unit,
  name: "UsSurveyUnit",
  definition: "SiUnit",
  numerator: 1,
  label: "UsSurvey",
  phenomenon: "TestSchema.TestPhenomenon",
  unitSystem: "TestSchema.UsSurvey",
  schema: "TestSchema",
};

const usCustomUnit: SchemaItemUnitProps = {
  schemaItemType: SchemaItemType.Unit,
  name: "UsCustomUnit",
  definition: "SiUnit",
  numerator: 1,
  label: "UsCustom",
  phenomenon: "TestSchema.TestPhenomenon",
  unitSystem: "TestSchema.UsCustom",
  schema: "TestSchema",
};

const siUnitSystem: UnitSystemProps = {
  schemaItemType: SchemaItemType.UnitSystem,
  name: "SI",
  schema: "TestSchema",
  description: "Test SI Unit System",
};

const metricUnitSystem: UnitSystemProps = {
  schemaItemType: SchemaItemType.UnitSystem,
  name: "Metric",
  schema: "TestSchema",
  description: "Test Metric Unit System",
};

const imperialUnitSystem: UnitSystemProps = {
  schemaItemType: SchemaItemType.UnitSystem,
  name: "Imperial",
  schema: "TestSchema",
  description: "Test Imperial Unit System",
};

const usCustomUnitSystem: UnitSystemProps = {
  schemaItemType: SchemaItemType.UnitSystem,
  name: "UsCustom",
  schema: "TestSchema",
  description: "Test UsCustom Unit System",
};

const usSurveyUnitSystem: UnitSystemProps = {
  schemaItemType: SchemaItemType.UnitSystem,
  name: "UsSurvey",
  schema: "TestSchema",
  description: "Test UsSurvey Unit System",
};

const phenomenon: PhenomenonProps = {
  schemaItemType: SchemaItemType.Phenomenon,
  definition: "PhenomenonDefinition",
  name: "TestPhenomenon",
};

const siFormat: SchemaItemFormatProps = {
  schemaItemType: SchemaItemType.Format,
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
  schemaItemType: SchemaItemType.Format,
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
  schemaItemType: SchemaItemType.Format,
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
  schemaItemType: SchemaItemType.Format,
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
  schemaItemType: SchemaItemType.Format,
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
  schemaItemType: SchemaItemType.KindOfQuantity,
  name: "TestKOQ",
  schema: "TestSchema",
  relativeError: 6,
  persistenceUnit: "TestSchema.MetricUnit",
  presentationUnits: ["TestSchema.MetricFormat", "TestSchema.ImperialFormat", "TestSchema.UsSurveyFormat", "TestSchema.UsCustomFormat"],
};

const koqOnlyImperial: KindOfQuantityProps = {
  schemaItemType: SchemaItemType.KindOfQuantity,
  name: "TestKOQOnlyImperial",
  schema: "TestSchema",
  relativeError: 6,
  persistenceUnit: `TestSchema.${imperialUnit.name}`,
  presentationUnits: [`TestSchema.${imperialFormat.name}`],
};

const koqOnlyUsSurvey: KindOfQuantityProps = {
  schemaItemType: SchemaItemType.KindOfQuantity,
  name: "TestKOQOnlyUsSurvey",
  schema: "TestSchema",
  relativeError: 6,
  persistenceUnit: `TestSchema.${usSurveyUnit.name}`,
  presentationUnits: [`TestSchema.${usSurveyFormat.name}`],
};

const koqOnlyUsCustomary: KindOfQuantityProps = {
  schemaItemType: SchemaItemType.KindOfQuantity,
  name: "TestKOQOnlyUsCustomary",
  schema: "TestSchema",
  relativeError: 6,
  persistenceUnit: `TestSchema.${usCustomUnit.name}`,
  presentationUnits: [`TestSchema.${usCustomFormat.name}`],
};

const koqOnlyMetric: KindOfQuantityProps = {
  schemaItemType: SchemaItemType.KindOfQuantity,
  name: "TestKOQOnlyMetric",
  schema: "TestSchema",
  relativeError: 6,
  persistenceUnit: "TestSchema.MetricUnit",
  presentationUnits: ["TestSchema.MetricFormat"],
};

const koqMetricAndSi: KindOfQuantityProps = {
  schemaItemType: SchemaItemType.KindOfQuantity,
  name: "TestKoqMetricAndSi",
  schema: "TestSchema",
  relativeError: 6,
  persistenceUnit: "TestSchema.MetricUnit",
  presentationUnits: ["TestSchema.MetricFormat", "TestSchema.SiFormat"],
};

const koqNoPresentationUnits: KindOfQuantityProps = {
  schemaItemType: SchemaItemType.KindOfQuantity,
  name: "TestKOQNoPresentationUnit",
  schema: "TestSchema",
  relativeError: 6,
  persistenceUnit: "TestSchema.MetricUnit",
};

const koqCrossSystemOverride: KindOfQuantityProps = {
  schemaItemType: SchemaItemType.KindOfQuantity,
  name: "TestKOQCrossSystemOverride",
  schema: "TestSchema",
  relativeError: 6,
  persistenceUnit: "TestSchema.MetricUnit",
  presentationUnits: ["TestSchema.SiFormat[TestSchema.ImperialUnit]"],
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
    [koqOnlyImperial.name!]: koqOnlyImperial,
    [koqOnlyUsCustomary.name!]: koqOnlyUsCustomary,
    [koqOnlyUsSurvey.name!]: koqOnlyUsSurvey,
    [koqOnlyMetric.name!]: koqOnlyMetric,
    [koqMetricAndSi.name!]: koqMetricAndSi,
    [koqNoPresentationUnits.name!]: koqNoPresentationUnits,
    [koqCrossSystemOverride.name!]: koqCrossSystemOverride,
  },
};
