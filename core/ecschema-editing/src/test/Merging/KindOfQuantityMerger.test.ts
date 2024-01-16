/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { KindOfQuantity, Schema, SchemaContext } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";

/* eslint-disable @typescript-eslint/naming-convention */

describe("KindOfQuantity merge tests", () => {
  let targetContext: SchemaContext;
  let sourceContext: SchemaContext;

  const sourceJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "SourceSchema",
    version: "1.2.3",
    alias: "source",
  };
  const targetJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "TargetSchema",
    version: "1.0.0",
    alias: "target",
  };
  const referenceJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "ReferenceSchema",
    version: "1.2.0",
    alias: "reference",
    items: {
      TestUnitSystem: {
        schemaItemType: "UnitSystem",
      },
      TestPhenomenon: {
        schemaItemType: "Phenomenon",
        definition: "TestPhenomenon",
      },
      TestPhenomenonRate: {
        schemaItemType: "Phenomenon",
        definition: "TestPhenomenon * TestPhenomenon(-1)",
      },
      TU: {
        schemaItemType: "Unit",
        unitSystem: "ReferenceSchema.TestUnitSystem",
        phenomenon: "ReferenceSchema.TestPhenomenon",
        definition: "TU",
      },
      KILOTU: {
        schemaItemType: "Unit",
        unitSystem: "ReferenceSchema.TestUnitSystem",
        phenomenon: "ReferenceSchema.TestPhenomenon",
        definition: "1000*TU",
      },
      TU_PER_TU: {
        schemaItemType: "Unit",
        unitSystem: "ReferenceSchema.TestUnitSystem",
        phenomenon: "ReferenceSchema.TestPhenomenonRate",
        definition: "TU * TU(-1)",
      },
      TU_HORIZONTAL_PER_TU_VERTICAL: {
        schemaItemType: "InvertedUnit",
        invertsUnit: "ReferenceSchema.TU_PER_TU",
        unitSystem: "ReferenceSchema.TestUnitSystem",
      },
      TestDecimal: {
        schemaItemType: "Format",
        type: "Decimal",
        precision: 6,
        formatTraits: [
          "KeepSingleZero",
          "KeepDecimalPoint",
          "ShowUnitLabel",
        ],
        decimalSeparator: ",",
        thousandSeparator: " ",
      },
    },
  };

  beforeEach(async () => {
    targetContext = new SchemaContext();
    sourceContext = new SchemaContext();
    await Schema.fromJson(referenceJson, sourceContext);
  });

  describe("KindOfQuantity missing tests", () => {
    it("should merge missing kind of quantity with persistent InvertedUnit ", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          {
            name: "ReferenceSchema",
            version: "1.2.0",
          },
        ],
        items: {
          TestKoq: {
            schemaItemType: "KindOfQuantity",
            label: "Test",
            description: "Description of koq",
            relativeError: 1.23,
            persistenceUnit: "ReferenceSchema.TU_HORIZONTAL_PER_TU_VERTICAL",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const sourceItem = await sourceSchema.getItem<KindOfQuantity>("TestKoq");
      const mergedItem = await mergedSchema.getItem<KindOfQuantity>("TestKoq");
      expect(mergedItem!.toJSON()).deep.eq(sourceItem!.toJSON());
    });

    it("should merge missing kind of quantity with persistent Unit", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          {
            name: "ReferenceSchema",
            version: "1.2.0",
          },
        ],
        items: {
          TU_PER_KILOTU: {
            schemaItemType: "Unit",
            unitSystem: "ReferenceSchema.TestUnitSystem",
            phenomenon: "ReferenceSchema.TestPhenomenon",
            definition: "ReferenceSchema.TU * ReferenceSchema.KILOTU(-1)",
          },
          TestKoq: {
            schemaItemType: "KindOfQuantity",
            label: "Test",
            description: "Description of koq",
            relativeError: 1.0002,
            persistenceUnit: "SourceSchema.TU_PER_KILOTU",
          },
        },
      }, sourceContext);

      await Schema.fromJson(referenceJson, targetContext);
      const targetSchema = await Schema.fromJson({
        ...targetJson,
        references: [
          {
            name: "ReferenceSchema",
            version: "1.2.0",
          },
        ],
        items: {
          TU_PER_KILOTU: {
            schemaItemType: "Unit",
            unitSystem: "ReferenceSchema.TestUnitSystem",
            phenomenon: "ReferenceSchema.TestPhenomenon",
            definition: "ReferenceSchema.TU * ReferenceSchema.KILOTU(-1)",
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const mergedItem = await mergedSchema.getItem<KindOfQuantity>("TestKoq");
      expect(mergedItem!.toJSON()).deep.eq({
        schemaItemType: "KindOfQuantity",
        label: "Test",
        description: "Description of koq",
        relativeError: 1.0002,
        persistenceUnit: "TargetSchema.TU_PER_KILOTU",
      });
    });

    it("should merge missing kind of quantity with presentation format", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          {
            name: "ReferenceSchema",
            version: "1.2.0",
          },
        ],
        items: {
          TestKoq: {
            schemaItemType: "KindOfQuantity",
            label: "Test",
            description: "Description of koq",
            relativeError: 0.0030480000000000004,
            persistenceUnit: "ReferenceSchema.TU_PER_TU",
            presentationUnits: [
              "ReferenceSchema.TestDecimal",
            ],
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const sourceItem = await sourceSchema.getItem<KindOfQuantity>("TestKoq");
      const mergedItem = await mergedSchema.getItem<KindOfQuantity>("TestKoq");
      expect(mergedItem!.toJSON()).deep.eq(sourceItem!.toJSON());
    });

    it("should merge missing kind of quantity with presentation override formats", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          {
            name: "ReferenceSchema",
            version: "1.2.0",
          },
        ],
        items: {
          TestFractional: {
            schemaItemType: "Format",
            type: "Fractional",
            precision: 64,
            formatTraits: [
              "KeepSingleZero",
              "KeepDecimalPoint",
            ],
            decimalSeparator: ",",
            thousandSeparator: ".",
          },
          TU_PER_KILOTU: {
            schemaItemType: "Unit",
            unitSystem: "ReferenceSchema.TestUnitSystem",
            phenomenon: "ReferenceSchema.TestPhenomenon",
            definition: "ReferenceSchema.TU * ReferenceSchema.KILOTU(-1)",
          },
          TestKoq: {
            schemaItemType: "KindOfQuantity",
            label: "Test",
            description: "Description of koq",
            relativeError: 0.0030480000000000004,
            persistenceUnit: "ReferenceSchema.TU_PER_TU",
            presentationUnits: [
              "ReferenceSchema.TestDecimal(4)[ReferenceSchema.TU_PER_TU|tu/tu]",
              "ReferenceSchema.TestDecimal(5)[ReferenceSchema.TU_HORIZONTAL_PER_TU_VERTICAL]",
              "SourceSchema.TestFractional(12)[SourceSchema.TU_PER_KILOTU| tu/ktu]",
            ],
          },
        },
      }, sourceContext);

      await Schema.fromJson(referenceJson, targetContext);
      const targetSchema = await Schema.fromJson({
        ...targetJson,
        references: [
          {
            name: "ReferenceSchema",
            version: "1.2.0",
          },
        ],
        items: {
          TestFractional: {
            schemaItemType: "Format",
            type: "Fractional",
            precision: 64,
            formatTraits: [
              "KeepSingleZero",
              "KeepDecimalPoint",
            ],
            decimalSeparator: ",",
            thousandSeparator: ".",
          },
          TU_PER_KILOTU: {
            schemaItemType: "Unit",
            unitSystem: "ReferenceSchema.TestUnitSystem",
            phenomenon: "ReferenceSchema.TestPhenomenon",
            definition: "ReferenceSchema.TU * ReferenceSchema.KILOTU(-1)",
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const mergedItem = await mergedSchema.getItem<KindOfQuantity>("TestKoq");
      expect(mergedItem!.toJSON()).deep.eq({
        schemaItemType: "KindOfQuantity",
        label: "Test",
        description: "Description of koq",
        relativeError: 0.0030480000000000004,
        persistenceUnit: "ReferenceSchema.TU_PER_TU",
        presentationUnits: [
          "ReferenceSchema.TestDecimal(4)[ReferenceSchema.TU_PER_TU|tu/tu]",
          "ReferenceSchema.TestDecimal(5)[ReferenceSchema.TU_HORIZONTAL_PER_TU_VERTICAL]",
          "TargetSchema.TestFractional(12)[TargetSchema.TU_PER_KILOTU| tu/ktu]",
        ],
      });
    });
  });

  describe("KindOfQuantity delta tests", () => {
    it("should merge kind of quantity changes for presentation override formats", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          {
            name: "ReferenceSchema",
            version: "1.2.0",
          },
        ],
        items: {
          TestKoq: {
            schemaItemType: "KindOfQuantity",
            label: "Test",
            description: "Description of koq",
            relativeError: 0.12345,
            persistenceUnit: "ReferenceSchema.TU",
            presentationUnits: [
              "ReferenceSchema.TestDecimal(4)[ReferenceSchema.TU]",
              "ReferenceSchema.TestDecimal(5)[ReferenceSchema.TU_PER_TU|tu/tu]",
            ],
          },
        },
      }, sourceContext);

      await Schema.fromJson(referenceJson, targetContext);
      const targetSchema = await Schema.fromJson({
        ...targetJson,
        references: [
          {
            name: "ReferenceSchema",
            version: "1.2.0",
          },
        ],
        items: {
          TestKoq: {
            schemaItemType: "KindOfQuantity",
            label: "Some label",
            description: "Some description",
            relativeError: 0.00000122,
            persistenceUnit: "ReferenceSchema.TU",
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      const mergedSchema = await merger.merge(targetSchema, sourceSchema);
      const sourceItem = await sourceSchema.getItem<KindOfQuantity>("TestKoq");
      const mergedItem = await mergedSchema.getItem<KindOfQuantity>("TestKoq");
      expect(mergedItem!.toJSON()).deep.eq(sourceItem!.toJSON());
    });

    it("should throw an error when merging kind of quantity persistenceUnit changed", async () => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          {
            name: "ReferenceSchema",
            version: "1.2.0",
          },
        ],
        items: {
          TestKoq: {
            schemaItemType: "KindOfQuantity",
            label: "Test",
            description: "Description of koq",
            relativeError: 1.23,
            persistenceUnit: "ReferenceSchema.TU",
          },
        },
      }, sourceContext);

      await Schema.fromJson(referenceJson, targetContext);
      const targetSchema = await Schema.fromJson({
        ...targetJson,
        references: [
          {
            name: "ReferenceSchema",
            version: "1.2.0",
          },
        ],
        items: {
          TestKoq: {
            schemaItemType: "KindOfQuantity",
            label: "Test",
            description: "Description of koq",
            relativeError: 1.23,
            persistenceUnit: "ReferenceSchema.TU_HORIZONTAL_PER_TU_VERTICAL",
          },
        },
      }, targetContext);

      const merger = new SchemaMerger();
      await expect(merger.merge(targetSchema, sourceSchema)).to.be.rejectedWith("Changing the kind of quantity 'TestKoq' persistenceUnit is not supported.");
    });
  });
});
