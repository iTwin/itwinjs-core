import { Schema, SchemaItemType } from "@itwin/ecschema-metadata";
import { AnySchemaDifferenceConflict, ConflictCode, getSchemaDifferences, SchemaDifferenceResult, SchemaEdits, SchemaMerger } from "../../../ecschema-editing";
import { BisTestHelper } from "../../TestUtils/BisTestHelper";
import { deserializeXml } from "../../TestUtils/DeserializationHelpers";
import { expect } from "chai";

describe.only("Failing Iterative Tests", () => {
  let sourceSchema: Schema;
  let targetSchema: Schema;
  let schemaEdits: SchemaEdits;

  beforeEach(() => {
    schemaEdits = new SchemaEdits();
  });

  async function loadSchemaXml(schemaXml: string): Promise<Schema> {
    const schemaContext = await BisTestHelper.getNewContext();
    return deserializeXml(schemaXml, schemaContext);
  }

  async function combineIModelSchemas(handler: (differenceResult: SchemaDifferenceResult) => Promise<void>): Promise<Schema> {
    // Get differences between the two schemas
    const differenceResult = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits.toJSON());
    await handler(differenceResult);

    // Merge the differences into the target schema
    const merger = new SchemaMerger(targetSchema.context);
    return merger.merge(differenceResult, schemaEdits);
  }

  /**
  *  {
    changeType: "add",
    schemaType: "EntityClass",
    itemName: "TestClass",
    difference: {
      schemaItemType: "EntityClass",
      baseClass: "TestSchema.TestBaseClass",
    },
  },
  */
  it("shall re-apply stored conflict resolutions for setting baseClass", async () => {
    targetSchema = await loadSchemaXml(`
      <ECSchema schemaName="TestSchema" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECSchemaReference name="CoreCustomAttributes" version="01.00.01" alias="CoreCA"/>
        <ECCustomAttributes>
          <DynamicSchema xmlns="CoreCustomAttributes.01.00.03"/>
        </ECCustomAttributes>
        <ECStructClass typeName="TestBaseClass" modifier="Sealed">
        </ECStructClass>
      </ECSchema>`);

    // First iteration
    sourceSchema = await loadSchemaXml(`
      <ECSchema schemaName="TestSchema" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECSchemaReference name="CoreCustomAttributes" version="01.00.01" alias="CoreCA"/>
        <ECCustomAttributes>
          <DynamicSchema xmlns="CoreCustomAttributes.01.00.03"/>
        </ECCustomAttributes>
        <ECEntityClass typeName="TestBaseClass" modifier="Sealed">
        </ECEntityClass>
      </ECSchema>`);

    targetSchema = await combineIModelSchemas(async (result) => {
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("source", "EntityClass");
        expect(conflict).to.have.a.property("target", "StructClass");
        return true;
      });

      const testBaseClassItem = await sourceSchema.getItem("TestBaseClass");
      schemaEdits.items.rename(testBaseClassItem!, "Merged_BaseEntityClass");
    });

    await expect(targetSchema.getItem("TestBaseClass")).to.be.eventually.fulfilled.then((ecClass) => {
      expect(ecClass).to.exist;
      expect(ecClass).to.have.a.property("schemaItemType", SchemaItemType.StructClass);
    });
    await expect(targetSchema.getItem("Merged_BaseEntityClass")).to.be.eventually.fulfilled.then((ecClass) => {
      expect(ecClass).to.exist;
      expect(ecClass).to.have.a.property("schemaItemType", SchemaItemType.EntityClass);
    });

    // Second iteration
    sourceSchema = await loadSchemaXml(`
      <ECSchema schemaName="TestSchema" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECSchemaReference name="CoreCustomAttributes" version="01.00.01" alias="CoreCA"/>
        <ECCustomAttributes>
          <DynamicSchema xmlns="CoreCustomAttributes.01.00.03"/>
        </ECCustomAttributes>
        <ECEntityClass typeName="TestClass" modifier="None">
          <BaseClass>TestBaseClass</BaseClass>
        </ECEntityClass>
        <ECEntityClass typeName="TestBaseClass" modifier="Sealed">
        </ECEntityClass>
      </ECSchema>`);

    targetSchema = await combineIModelSchemas(async (result) => {
      expect(result.conflicts).to.be.undefined;
    });

    await expect(targetSchema.getItem("TestClass")).to.be.eventually.fulfilled.then(async (ecClass) => {
      expect(ecClass).to.exist;
      expect(ecClass).to.have.a.nested.property("baseClass.name", "Merged_BaseEntityClass");
    });
  });

  /**
   * {
    changeType: "modify",
    schemaType: "Property",
    itemName: "TestClass",
    path: "Height",
    difference: {
      label: "Test",
      category: "TestSchema.TestSystem",
    },
  },
   */
  it("shall re-apply stored conflict resolutions for setting category", async () => {
    targetSchema = await loadSchemaXml(`
      <ECSchema schemaName="TestSchema" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECSchemaReference name="CoreCustomAttributes" version="01.00.01" alias="CoreCA"/>
        <ECCustomAttributes>
          <DynamicSchema xmlns="CoreCustomAttributes.01.00.03"/>
        </ECCustomAttributes>
        <UnitSystem typeName="TestSystem">
        </UnitSystem>
        <ECEntityClass typeName="TestClass" modifier="Sealed">
        </ECEntityClass>
      </ECSchema>`);

    // First iteration
    sourceSchema = await loadSchemaXml(`
      <ECSchema schemaName="TestSchema" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECSchemaReference name="CoreCustomAttributes" version="01.00.01" alias="CoreCA"/>
        <ECCustomAttributes>
          <DynamicSchema xmlns="CoreCustomAttributes.01.00.03"/>
        </ECCustomAttributes>
        <PropertyCategory typeName="TestSystem" priority="10000">
        </PropertyCategory>
        <ECEntityClass typeName="TestClass" modifier="Sealed">
          <ECProperty propertyName="Height" typeName="double" category="TestSystem" />
        </ECEntityClass>
      </ECSchema>`);

    targetSchema = await combineIModelSchemas(async (result) => {
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("source", "PropertyCategory");
        expect(conflict).to.have.a.property("target", "UnitSystem");
        return true;
      });

      const testSystemItem = await sourceSchema.getItem("TestSystem");
      schemaEdits.items.rename(testSystemItem!, "Merged_PropertyCategory");
    });

    await expect(targetSchema.getItem("TestSystem")).to.be.eventually.fulfilled.then((ecClass) => {
      expect(ecClass).to.exist;
      expect(ecClass).to.have.a.property("schemaItemType", SchemaItemType.UnitSystem);
    });
    await expect(targetSchema.getItem("Merged_PropertyCategory")).to.be.eventually.fulfilled.then((ecClass) => {
      expect(ecClass).to.exist;
      expect(ecClass).to.have.a.property("schemaItemType", SchemaItemType.PropertyCategory);
    });

    // Second iteration
    sourceSchema = await loadSchemaXml(`
      <ECSchema schemaName="TestSchema" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECSchemaReference name="CoreCustomAttributes" version="01.00.01" alias="CoreCA"/>
        <ECCustomAttributes>
          <DynamicSchema xmlns="CoreCustomAttributes.01.00.03"/>
        </ECCustomAttributes>
        <PropertyCategory typeName="TestSystem" priority="10000">
        </PropertyCategory>
        <ECEntityClass typeName="TestClass" modifier="Sealed">
          <ECProperty propertyName="Height" typeName="double" category="TestSystem" displayLabel="Test" />
        </ECEntityClass>
      </ECSchema>`);

    targetSchema = await combineIModelSchemas(async (result) => {
      expect(result.conflicts).to.be.undefined;
    });

    await expect(targetSchema.getItem("TestClass")).to.be.eventually.fulfilled.then(async (ecClass) => {
      expect(ecClass).to.exist;
      await expect(ecClass.getProperty("Height")).to.be.eventually.fulfilled.then((property) => {
        expect(property).to.exist;
        expect(property).to.have.a.nested.property("category.name", "Merged_PropertyCategory");
      });
    });
  });
});
