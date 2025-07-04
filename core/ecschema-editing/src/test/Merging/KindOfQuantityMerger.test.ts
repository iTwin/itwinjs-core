/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { KindOfQuantity, Schema, SchemaContext, SchemaItemType } from "@itwin/ecschema-metadata";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { expect } from "chai";
import { getSchemaDifferences, SchemaOtherTypes } from "../../Differencing/SchemaDifference";
import { BisTestHelper } from "../TestUtils/BisTestHelper";
import { AnySchemaDifferenceConflict, ConflictCode, SchemaEdits } from "../../ecschema-editing";

/* eslint-disable @typescript-eslint/naming-convention */

describe("KindOfQuantity merge tests", () => {
  let targetContext: SchemaContext;

  const targetJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "TargetSchema",
    version: "1.0.0",
    alias: "target",
    references: [
      { name: "CoreCustomAttributes", version: "01.00.01" },
    ],
    customAttributes: [
      { className: "CoreCustomAttributes.DynamicSchema" },
    ],
  };

  const sourceJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "SourceSchema",
    version: "1.0.0",
    alias: "source",
    references: [
      { name: "CoreCustomAttributes", version: "01.00.01" },
    ],
    customAttributes: [
      { className: "CoreCustomAttributes.DynamicSchema" },
    ],
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
    targetContext = await BisTestHelper.getNewContext();
    await Schema.fromJson(referenceJson, targetContext);
  });

  it("should merge missing kind of quantity with persistent InvertedUnit ", async () => {
    await Schema.fromJson(targetJson, targetContext);
    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaOtherTypes.SchemaReference,
          difference: {
            name: "ReferenceSchema",
            version: "01.02.00",
          },
        },
        {
          changeType: "add",
          schemaType: SchemaItemType.KindOfQuantity,
          itemName: "TestKoq",
          difference: {
            label: "Test",
            description: "Description of koq",
            relativeError: 1.23,
            persistenceUnit: "ReferenceSchema.TU_HORIZONTAL_PER_TU_VERTICAL",
          },
        },
      ],
    });

    const mergedItem = await mergedSchema.getItem("TestKoq", KindOfQuantity);
    expect(mergedItem!.toJSON()).deep.equals({
      description: "Description of koq",
      label: "Test",
      persistenceUnit: "ReferenceSchema.TU_HORIZONTAL_PER_TU_VERTICAL",
      relativeError: 1.23,
      schemaItemType: "KindOfQuantity",
    });
  });

  it("should merge missing kind of quantity with persistent Unit", async () => {
    await Schema.fromJson(referenceJson, targetContext);
    await Schema.fromJson({
      ...targetJson,
      references: [
        ...targetJson.references,
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

    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaItemType.KindOfQuantity,
          itemName: "TestKoq",
          difference: {
            label: "Test",
            description: "Description of koq",
            relativeError: 1.0002,
            persistenceUnit: "SourceSchema.TU_PER_KILOTU",
          },
        },
      ],
    });

    const mergedItem = await mergedSchema.getItem("TestKoq", KindOfQuantity);
    expect(mergedItem!.toJSON()).deep.equals({
      schemaItemType: "KindOfQuantity",
      label: "Test",
      description: "Description of koq",
      relativeError: 1.0002,
      persistenceUnit: "TargetSchema.TU_PER_KILOTU",
    });
  });

  it("should merge missing kind of quantity with presentation format", async () => {
    await Schema.fromJson(targetJson, targetContext);
    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaOtherTypes.SchemaReference,
          difference: {
            name: "ReferenceSchema",
            version: "01.02.00",
          },
        },
        {
          changeType: "add",
          schemaType: SchemaItemType.KindOfQuantity,
          itemName: "TestKoq",
          difference: {
            label: "Test",
            description: "Description of koq",
            relativeError: 0.0030480000000000004,
            persistenceUnit: "ReferenceSchema.TU_PER_TU",
            presentationUnits: [
              "ReferenceSchema.TestDecimal",
            ],
          },
        },
      ],
    });
    const mergedItem = await mergedSchema.getItem("TestKoq", KindOfQuantity);
    expect(mergedItem!.toJSON()).deep.equals({
      description: "Description of koq",
      label: "Test",
      persistenceUnit: "ReferenceSchema.TU_PER_TU",
      presentationUnits: [
        "ReferenceSchema.TestDecimal",
      ],
      relativeError: 0.0030480000000000004,
      schemaItemType: "KindOfQuantity",
    });
  });

  it("should merge missing kind of quantity with presentation override formats", async () => {
    await Schema.fromJson(referenceJson, targetContext);
    await Schema.fromJson({
      ...targetJson,
      references: [
        ...targetJson.references,
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

    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaItemType.KindOfQuantity,
          itemName: "TestKoq",
          difference: {
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
      ],
    });

    const mergedItem = await mergedSchema.getItem("TestKoq", KindOfQuantity);
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

  it("should merge kind of quantity changes for presentation override formats", async () => {
    await Schema.fromJson(referenceJson, targetContext);
    await Schema.fromJson({
      ...targetJson,
      references: [
        ...targetJson.references,
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

    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "modify",
          schemaType: SchemaItemType.KindOfQuantity,
          itemName: "TestKoq",
          difference: {
            description: "Description of koq",
            label: "Test",
            relativeError: 0.12345,
          },
        },
      ],
    });

    const mergedItem = await mergedSchema.getItem("TestKoq", KindOfQuantity);
    expect(mergedItem!.toJSON()).deep.equals({
      description: "Description of koq",
      label: "Test",
      persistenceUnit: "ReferenceSchema.TU",
      relativeError: 0.12345,
      schemaItemType: "KindOfQuantity",
    });
  });

  describe("merge kind of quantity changes for presentation format", () => {
    it("should merge missing presentation format", async () => {
      await Schema.fromJson(referenceJson, targetContext);
      await Schema.fromJson({
        ...targetJson,
        references: [
          ...targetJson.references,
          {
            name: "ReferenceSchema",
            version: "1.2.0",
          },
        ],
        items: {
          TestKoq: {
            schemaItemType: "KindOfQuantity",
            relativeError: 0.01264587,
            persistenceUnit: "ReferenceSchema.TU",
          },
        },
      }, targetContext);

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge({
        sourceSchemaName: "SourceSchema.01.02.03",
        targetSchemaName: "TargetSchema.01.00.00",
        differences: [
          {
            changeType: "add",
            schemaType: SchemaOtherTypes.KindOfQuantityPresentationFormat,
            itemName: "TestKoq",
            difference: [
              "ReferenceSchema.TestDecimal(4)[ReferenceSchema.TU_PER_TU|tu/tu][ReferenceSchema.KILOTU|undefined]",
            ],
          },
        ],
      });

      const mergedItem = await mergedSchema.getItem("TestKoq", KindOfQuantity);
      expect(mergedItem!.toJSON()).deep.equals({
        schemaItemType: "KindOfQuantity",
        relativeError: 0.01264587,
        persistenceUnit: "ReferenceSchema.TU",
        presentationUnits: [
          "ReferenceSchema.TestDecimal(4)[ReferenceSchema.TU_PER_TU|tu/tu][ReferenceSchema.KILOTU|undefined]",
        ],
      });
    });

    it("should merge changes for presentation formats", async () => {
      await Schema.fromJson(referenceJson, targetContext);
      await Schema.fromJson({
        ...targetJson,
        references: [
          ...targetJson.references,
          {
            name: "ReferenceSchema",
            version: "1.2.0",
          },
        ],
        items: {
          PI_TU: {
            schemaItemType: "Unit",
            unitSystem: "ReferenceSchema.TestUnitSystem",
            phenomenon: "ReferenceSchema.TestPhenomenon",
            definition: "3.14*TU",
          },
          TestReal: {
            schemaItemType: "Format",
            type: "Decimal",
            precision: 6,
            formatTraits: [
              "KeepSingleZero",
              "KeepDecimalPoint",
            ],
            decimalSeparator: ",",
            thousandSeparator: " ",
          },
          TestKoq: {
            schemaItemType: "KindOfQuantity",
            relativeError: 0.0001,
            persistenceUnit: "TargetSchema.PI_TU",
            presentationUnits: [
              "ReferenceSchema.TestDecimal(4)[ReferenceSchema.TU_PER_TU|tu/tu]",
            ],
          },
        },
      }, targetContext);

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge({
        sourceSchemaName: "SourceSchema.01.02.03",
        targetSchemaName: "TargetSchema.01.00.00",
        differences: [
          {
            changeType: "add",
            schemaType: SchemaOtherTypes.KindOfQuantityPresentationFormat,
            itemName: "TestKoq",
            difference: [
              "ReferenceSchema.TestDecimal(8)[ReferenceSchema.TU_PER_TU|tu/tu]",
            ],
          },
          {
            changeType: "add",
            schemaType: SchemaOtherTypes.KindOfQuantityPresentationFormat,
            itemName: "TestKoq",
            difference: [
              "SourceSchema.TestReal(4)[SourceSchema.PI_TU|pi*tu]",
            ],
          },
        ],
      });

      const mergedItem = await mergedSchema.getItem("TestKoq", KindOfQuantity);
      expect(mergedItem!.toJSON()).deep.equals({
        schemaItemType: "KindOfQuantity",
        relativeError: 0.0001,
        persistenceUnit: "TargetSchema.PI_TU",
        presentationUnits: [
          "ReferenceSchema.TestDecimal(4)[ReferenceSchema.TU_PER_TU|tu/tu]",
          "ReferenceSchema.TestDecimal(8)[ReferenceSchema.TU_PER_TU|tu/tu]",
          "TargetSchema.TestReal(4)[TargetSchema.PI_TU|pi*tu]",
        ],
      });
    });
  });

  it("should throw an error when merging kind of quantity persistenceUnit changed", async () => {
    await Schema.fromJson(referenceJson, targetContext);
    await Schema.fromJson({
      ...targetJson,
      references: [
        ...targetJson.references,
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

    const merger = new SchemaMerger(targetContext);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "modify",
          schemaType: SchemaItemType.KindOfQuantity,
          itemName: "TestKoq",
          difference: {
            persistenceUnit: "ReferenceSchema.TU",
          },
        },
      ],
      conflicts: undefined,
    });

    await expect(merge).to.be.rejectedWith("Changing the kind of quantity 'TestKoq' persistenceUnit is not supported.");
  });

  describe("iterative tests", () => {
    let sourceContext: SchemaContext;

    beforeEach(async () => {
      sourceContext = await BisTestHelper.getNewContext();
      await Schema.fromJson(referenceJson, sourceContext);
    });

    it("should add a re-mapped kindOfQuantity class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          ...sourceJson.references,
          { name: "ReferenceSchema", version: "1.2.0" },
        ],
        items: {
          testItem: {
            schemaItemType: "KindOfQuantity",
            relativeError: 0.0001,
            persistenceUnit: "ReferenceSchema.TU",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testItem: {
            schemaItemType: "StructClass",
          },
        },
      }, targetContext);

      const result = await getSchemaDifferences(targetSchema, sourceSchema);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("source", "KindOfQuantity");
        expect(conflict).to.have.a.property("target", "StructClass");
        return true;
      });

      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as KindOfQuantity;
      schemaEdits.items.rename(sourceItem, "mergedKOQ");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(result, schemaEdits);

      await expect(mergedSchema.getItem("mergedKOQ")).to.be.eventually.fulfilled.then(async (schemaItem) => {
        expect(schemaItem).to.exist;
        expect(schemaItem).to.have.property("schemaItemType").equals(SchemaItemType.KindOfQuantity);
      });
    });

    it("should merge changes to re-mapped kindOfQuantity class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          ...sourceJson.references,
          { name: "ReferenceSchema", version: "1.2.0" },
        ],
        items: {
          testItem: {
            schemaItemType: "KindOfQuantity",
            label: "Changed Power",
            description: "Changed Power Quantity",
            relativeError: 0.1,
            persistenceUnit: "ReferenceSchema.TU",
            presentationUnits: [
              "ReferenceSchema.TestDecimal(8)[ReferenceSchema.TU_PER_TU|tu/tu]",
            ],
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        references: [
          ...targetJson.references,
          { name: "ReferenceSchema", version: "1.2.0" },
        ],
        items: {
          mergedKOQ: {
            schemaItemType: "KindOfQuantity",
            label: "Power",
            description: "Power Quantity",
            relativeError: 0.0001,
            persistenceUnit: "ReferenceSchema.TU",
            presentationUnits: [
              "ReferenceSchema.TestDecimal(4)[ReferenceSchema.TU_PER_TU|tu/tu]",
            ],
          },
          testItem: {
            schemaItemType: "StructClass",
          },
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as KindOfQuantity;
      schemaEdits.items.rename(sourceItem, "mergedKOQ");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.mergeSchemas(targetSchema, sourceSchema, schemaEdits);

      await expect(mergedSchema.getItem("mergedKOQ")).to.be.eventually.not.undefined
        .then((koq: KindOfQuantity) => {
          expect(koq).to.have.a.property("label").to.equal("Changed Power");
          expect(koq).to.have.a.property("description").to.equal("Changed Power Quantity");
          expect(koq).to.have.a.property("relativeError").to.equal(0.1);
          expect(koq).to.have.a.nested.property("presentationFormats[0].name").to.equal("ReferenceSchema.TestDecimal(4)[ReferenceSchema.TU_PER_TU|tu/tu]");
          expect(koq).to.have.a.nested.property("presentationFormats[1].name").to.equal("ReferenceSchema.TestDecimal(8)[ReferenceSchema.TU_PER_TU|tu/tu]");
        });
    });

    it("should add an entity class with re-mapped property kindOfQuantity", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          ...sourceJson.references,
          { name: "ReferenceSchema", version: "1.2.0" },
        ],
        items: {
          testEntity: {
            schemaItemType: "EntityClass",
            properties: [{
              name: "testProp",
              type: "PrimitiveProperty",
              typeName: "int",
              kindOfQuantity: "SourceSchema.testItem",
            }],
          },
          testItem: {
            schemaItemType: "KindOfQuantity",
            relativeError: 0.0001,
            persistenceUnit: "ReferenceSchema.TU",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        references: [
          ...targetJson.references,
          { name: "ReferenceSchema", version: "1.2.0" },
        ],
        items: {
          mergedKOQ: {
            schemaItemType: "KindOfQuantity",
            relativeError: 0.0001,
            persistenceUnit: "ReferenceSchema.TU",
          },
          testItem: {
            schemaItemType: "StructClass",
          },
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as KindOfQuantity;
      schemaEdits.items.rename(sourceItem, "mergedKOQ");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.mergeSchemas(targetSchema, sourceSchema, schemaEdits);

      await expect(mergedSchema.getItem("testEntity")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).to.have.a.property("schemaItemType").equals(SchemaItemType.EntityClass);
        await expect(ecClass.getProperty("testProp")).to.be.eventually.fulfilled.then((property) => {
          expect(property).to.exist;
          expect(property).has.a.nested.property("kindOfQuantity.name").equals("mergedKOQ");
        });
      });
    });

    it("should add a property with re-mapped kindOfQuantity to an existing class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          ...sourceJson.references,
          { name: "ReferenceSchema", version: "1.2.0" },
        ],
        items: {
          testStruct: {
            schemaItemType: "StructClass",
            properties: [{
              name: "testProp",
              type: "PrimitiveProperty",
              typeName: "string",
              kindOfQuantity: "SourceSchema.testItem",
            }],
          },
          testItem: {
            schemaItemType: "KindOfQuantity",
            relativeError: 0.0001,
            persistenceUnit: "ReferenceSchema.TU",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        references: [
          ...targetJson.references,
          { name: "ReferenceSchema", version: "1.2.0" },
        ],
        items: {
          testStruct: {
            schemaItemType: "StructClass",
          },
          mergedKOQ: {
            schemaItemType: "KindOfQuantity",
            relativeError: 0.0001,
            persistenceUnit: "ReferenceSchema.TU",
          },
          testItem: {
            schemaItemType: "StructClass",
          },
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as KindOfQuantity;
      schemaEdits.items.rename(sourceItem, "mergedKOQ");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.mergeSchemas(targetSchema, sourceSchema, schemaEdits);

      await expect(mergedSchema.getItem("testStruct")).to.be.eventually.fulfilled.then(async (ecClass) => {
        expect(ecClass).to.exist;
        expect(ecClass).to.have.a.property("schemaItemType").equals(SchemaItemType.StructClass);
        await expect(ecClass.getProperty("testProp")).to.be.eventually.fulfilled.then((property) => {
          expect(property).to.exist;
          expect(property).has.a.nested.property("kindOfQuantity.name").equals("mergedKOQ");
        });
      });
    });

    it("should return a conflict when property kindOfQuantity persistence is undefined on source", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          ...sourceJson.references,
          { name: "ReferenceSchema", version: "1.2.0" },
        ],
        items: {
          testStruct: {
            schemaItemType: "StructClass",
            properties: [{
              name: "testProp",
              type: "PrimitiveProperty",
              typeName: "string",
            }],
          },
          testItem: {
            schemaItemType: "KindOfQuantity",
            relativeError: 0.0001,
            persistenceUnit: "ReferenceSchema.TU",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        references: [
          ...targetJson.references,
          { name: "ReferenceSchema", version: "1.2.0" },
        ],
        items: {
          testStruct: {
            schemaItemType: "StructClass",
            properties: [{
              name: "testProp",
              type: "PrimitiveProperty",
              typeName: "string",
              kindOfQuantity: "TargetSchema.mergedKOQ",
            }],
          },
          mergedKOQ: {
            schemaItemType: "KindOfQuantity",
            relativeError: 0.0001,
            persistenceUnit: "ReferenceSchema.TU",
          },
          testItem: {
            schemaItemType: "StructClass",
          },
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as KindOfQuantity;
      schemaEdits.items.rename(sourceItem, "mergedKOQ");

      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingPropertyKindOfQuantity);
        expect(conflict).to.have.a.property("source", null);
        expect(conflict).to.have.a.property("target", "TargetSchema.mergedKOQ");
        expect(conflict).to.have.a.property("description", "The kind of quantity cannot be undefined if the property had a kind of quantities before.");
        expect(conflict).to.have.a.nested.property("difference.schemaType", "Property");
        expect(conflict).to.have.a.nested.property("difference.itemName", "testStruct");
        expect(conflict).to.have.a.nested.property("difference.path", "testProp");
        return true;
      });
    });

    it("should return a conflict when property kindOfQuantity persistence is undefined on target", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          ...sourceJson.references,
          { name: "ReferenceSchema", version: "1.2.0" },
        ],
        items: {
          testStruct: {
            schemaItemType: "StructClass",
            properties: [{
              name: "testProp",
              type: "PrimitiveProperty",
              typeName: "string",
              kindOfQuantity: "SourceSchema.testItem",
            }],
          },
          testItem: {
            schemaItemType: "KindOfQuantity",
            relativeError: 0.0001,
            persistenceUnit: "ReferenceSchema.TU",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        references: [
          ...targetJson.references,
          { name: "ReferenceSchema", version: "1.2.0" },
        ],
        items: {
          testStruct: {
            schemaItemType: "StructClass",
            properties: [{
              name: "testProp",
              type: "PrimitiveProperty",
              typeName: "string",
            }],
          },
          mergedKOQ: {
            schemaItemType: "KindOfQuantity",
            relativeError: 0.0001,
            persistenceUnit: "ReferenceSchema.TU",
          },
          testItem: {
            schemaItemType: "StructClass",
          },
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as KindOfQuantity;
      schemaEdits.items.rename(sourceItem, "mergedKOQ");

      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingPropertyKindOfQuantity);
        expect(conflict).to.have.a.property("source", "SourceSchema.testItem");
        expect(conflict).to.have.a.property("target", null);
        expect(conflict).to.have.a.property("description", "The kind of quantity cannot be assiged if the property did not have a kind of quantities before.");
        expect(conflict).to.have.a.nested.property("difference.schemaType", "Property");
        expect(conflict).to.have.a.nested.property("difference.itemName", "testStruct");
        expect(conflict).to.have.a.nested.property("difference.path", "testProp");
        return true;
      });
    });

    it("should return a conflict when property kindOfQuantity persistence differs", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          ...sourceJson.references,
          { name: "ReferenceSchema", version: "1.2.0" },
        ],
        items: {
          testKoq: {
            schemaItemType: "KindOfQuantity",
            relativeError: 0.1,
            persistenceUnit: "ReferenceSchema.KILOTU",
          },
          testStruct: {
            schemaItemType: "StructClass",
            properties: [{
              name: "testProp",
              type: "PrimitiveProperty",
              typeName: "string",
              kindOfQuantity: "SourceSchema.testKoq",
            }],
          },
          testItem: {
            schemaItemType: "KindOfQuantity",
            relativeError: 0.0001,
            persistenceUnit: "ReferenceSchema.TU",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        references: [
          ...targetJson.references,
          { name: "ReferenceSchema", version: "1.2.0" },
        ],
        items: {
          testStruct: {
            schemaItemType: "StructClass",
            properties: [{
              name: "testProp",
              type: "PrimitiveProperty",
              typeName: "string",
              kindOfQuantity: "TargetSchema.mergedKOQ",
            }],
          },
          mergedKOQ: {
            schemaItemType: "KindOfQuantity",
            relativeError: 0.0001,
            persistenceUnit: "ReferenceSchema.TU",
          },
          testItem: {
            schemaItemType: "StructClass",
          },
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as KindOfQuantity;
      schemaEdits.items.rename(sourceItem, "mergedKOQ");

      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingPropertyKindOfQuantityUnit);
        expect(conflict).to.have.a.property("source", "SourceSchema.testKoq");
        expect(conflict).to.have.a.property("target", "TargetSchema.mergedKOQ");
        expect(conflict).to.have.a.property("description", "The property has different kind of quantities with conflicting units.");
        expect(conflict).to.have.a.nested.property("difference.schemaType", "Property");
        expect(conflict).to.have.a.nested.property("difference.itemName", "testStruct");
        expect(conflict).to.have.a.nested.property("difference.path", "testProp");
        return true;
      });
    });

    it("should return a conflict when kindOfQuantity persistence unit differs", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          ...sourceJson.references,
          { name: "ReferenceSchema", version: "1.2.0" },
        ],
        items: {
          testItem: {
            schemaItemType: "KindOfQuantity",
            relativeError: 0.0001,
            persistenceUnit: "ReferenceSchema.KILOTU",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        references: [
          ...targetJson.references,
          { name: "ReferenceSchema", version: "1.2.0" },
        ],
        items: {
          mergedKOQ: {
            schemaItemType: "KindOfQuantity",
            relativeError: 0.0001,
            persistenceUnit: "ReferenceSchema.TU",
          },
          testItem: {
            schemaItemType: "StructClass",
          },
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as KindOfQuantity;
      schemaEdits.items.rename(sourceItem, "mergedKOQ");

      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingPersistenceUnit);
        expect(conflict).to.have.a.property("source", "ReferenceSchema.KILOTU");
        expect(conflict).to.have.a.property("target", "ReferenceSchema.TU");
        expect(conflict).to.have.a.property("description", "Kind of Quantity has a different persistence unit.");
        expect(conflict).to.have.a.nested.property("difference.schemaType", "KindOfQuantity");
        expect(conflict).to.have.a.nested.property("difference.itemName", "testItem");
        return true;
      });
    });
  });
});
