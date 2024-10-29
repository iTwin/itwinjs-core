import { PrimitiveType, Schema } from "@itwin/ecschema-metadata";
import { AnySchemaDifferenceConflict, ConflictCode, getSchemaDifferences, SchemaDifferenceResult, SchemaEdits, SchemaMerger } from "../../../ecschema-editing";
import { BisTestHelper } from "../../TestUtils/BisTestHelper";
import { deserializeXml } from "../../TestUtils/DeserializationHelpers";
import { expect } from "chai";

describe.only("Iterative Tests", () => {

  it("shall correctly deal with saved edits", async () => {

    async function combineIModelSchemas(handler: (differenceResult: SchemaDifferenceResult) => Promise<void>): Promise<Schema> {
      // Get differences between the two schemas
      const differenceResult = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits.toJSON());
      await handler(differenceResult);

      // Merge the differences into the target schema
      const merger = new SchemaMerger(targetSchema.context);
      return merger.merge(differenceResult, schemaEdits);
    }

    const schemaEdits = new SchemaEdits();

    let targetSchema = await loadSchemaXml(`
      <ECSchema schemaName="TestSchema" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECSchemaReference name="CoreCustomAttributes" version="01.00.01" alias="CoreCA"/>
        <ECCustomAttributes>
          <DynamicSchema xmlns="CoreCustomAttributes.01.00.03"/>
        </ECCustomAttributes>
        <ECEntityClass typeName="TestEntity" modifier="Sealed">
          <ECProperty propertyName="TestProperty" typeName="string" />
        </ECEntityClass>
      </ECSchema>`);

    // First iteration: A new property is added to the entity class with the same name as the
    // existing property but with a different type. The source property will be renamed.
    let sourceSchema = await loadSchemaXml(`
      <ECSchema schemaName="TestSchema" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECSchemaReference name="CoreCustomAttributes" version="01.00.01" alias="CoreCA"/>
        <ECCustomAttributes>
          <DynamicSchema xmlns="CoreCustomAttributes.01.00.03"/>
        </ECCustomAttributes>
        <ECEntityClass typeName="TestEntity" modifier="Sealed">
          <ECProperty propertyName="TestProperty" typeName="double" />
        </ECEntityClass>
      </ECSchema>`);

    targetSchema = await combineIModelSchemas(async (result) => {
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingPropertyName);
        expect(conflict).to.have.a.property("source", "double");
        expect(conflict).to.have.a.property("target", "string");
        return true;
      });

      // Solution to resolve the conflict is to rename the source property.
      schemaEdits.properties.rename(sourceSchema.name, "TestEntity", "TestProperty", "TestProperty_double");
    });

    await expect(targetSchema.getItem("TestEntity")).to.be.eventually.fulfilled.then(async (ecClass) => {
      expect(ecClass).to.exist;
      await expect(ecClass.getProperty("TestProperty")).to.be.eventually.fulfilled.then((property) => {
        expect(property).to.exist;
        expect(property).has.property("primitiveType").equals(PrimitiveType.String);
      });
      await expect(ecClass.getProperty("TestProperty_double")).to.be.eventually.fulfilled.then((property) => {
        expect(property).to.exist;
        expect(property).has.property("primitiveType").equals(PrimitiveType.Double);
      });
    });

    // Second iteration: The existing property, the label of the renamed property is changed.
    // This means the change needs to figure out that the source property has to be renamed
    // in a previous iteration.
    sourceSchema = await loadSchemaXml(`
      <ECSchema schemaName="TestSchema" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECSchemaReference name="CoreCustomAttributes" version="01.00.01" alias="CoreCA"/>
        <ECCustomAttributes>
          <DynamicSchema xmlns="CoreCustomAttributes.01.00.03"/>
        </ECCustomAttributes>
        <ECEntityClass typeName="TestEntity" modifier="Sealed">
          <ECProperty propertyName="TestProperty" typeName="double" displayLabel="This is a double property" category="Category" />
        </ECEntityClass>
        <PropertyCategory typeName="Category" displayLabel="My Property Category" priority="100000" />
      </ECSchema>`);

    targetSchema = await combineIModelSchemas(async (result) => {
      expect(result.conflicts).to.be.undefined;
    });

    await expect(targetSchema.getItem("TestEntity")).to.be.eventually.fulfilled.then(async (ecClass) => {
      expect(ecClass).to.exist;
      await expect(ecClass.getProperty("TestProperty_double")).to.be.eventually.fulfilled.then((property) => {
        expect(property).to.exist;
        expect(property.label).to.equal("This is a double property");
      });
    });

    // Third Iteration: The source schema now adds a structClass called Category which shall conflict with the
    // existing PropertyCategory. Additionally this struct is referenced by an added property to the TestEntity.
    // The struct will be renamed.
    sourceSchema = await loadSchemaXml(`
      <ECSchema schemaName="TestSchema" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECSchemaReference name="CoreCustomAttributes" version="01.00.01" alias="CoreCA"/>
        <ECCustomAttributes>
          <DynamicSchema xmlns="CoreCustomAttributes.01.00.03"/>
        </ECCustomAttributes>
        <ECEntityClass typeName="TestEntity" modifier="Sealed">
          <ECStructProperty propertyName="CategoryProperty" typeName="Category" />
        </ECEntityClass>
        <ECStructClass typeName="Category">
          <ECProperty propertyName="Name" typeName="string" />
          <ECProperty propertyName="Priority" typeName="int" />
        </ECStructClass>
      </ECSchema>`);

    targetSchema = await combineIModelSchemas(async (result) => {
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("source", "StructClass");
        expect(conflict).to.have.a.property("target", "PropertyCategory");
        return true;
      });

      // Solution to resolve the conflict is to rename the source struct.
      schemaEdits.items.rename(sourceSchema.name, "Category", "CategoryStruct");
    });

    await expect(targetSchema.getItem("TestEntity")).to.be.eventually.fulfilled.then(async (ecClass) => {
      expect(ecClass).to.exist;
      await expect(ecClass.getProperty("CategoryProperty")).to.be.eventually.fulfilled.then((property) => {
        expect(property).to.exist;
        expect(property).to.have.a.nested.property("structClass.name", "CategoryStruct");
      });
    });

    // Forth Iteration: A new entity gets added with the also added AbstractBaseClass as a baseClass.
    // This should not raise any conflicts. Additionally AbstractBaseClass is renamed to CommonBaseClass.
    sourceSchema = await loadSchemaXml(`
      <ECSchema schemaName="TestSchema" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECSchemaReference name="CoreCustomAttributes" version="01.00.01" alias="CoreCA"/>
        <ECCustomAttributes>
          <DynamicSchema xmlns="CoreCustomAttributes.01.00.03"/>
        </ECCustomAttributes>
        <ECEntityClass typeName="AbstractBaseClass" modifier="Abstract">
          <ECProperty propertyName="Tag" typeName="string" />
        </ECEntityClass>
        <ECEntityClass typeName="Building">
          <BaseClass>AbstractBaseClass</BaseClass>
          <ECProperty propertyName="Address" typeName="string" />
          <ECProperty propertyName="Height" typeName="double" />
        </ECEntityClass>
      </ECSchema>`);

    targetSchema = await combineIModelSchemas(async (result) => {
      expect(result.conflicts).to.be.undefined;

      // Rename AbstractBaseClass to CommonBaseClass
      schemaEdits.items.rename(sourceSchema.name, "AbstractBaseClass", "CommonBaseClass");
    });

    await expect(targetSchema.getItem("Building")).to.be.eventually.fulfilled.then(async (ecClass) => {
      expect(ecClass).to.exist;
      expect(ecClass).to.have.a.nested.property("baseClass.name", "CommonBaseClass");
    });

    expect(true).is.true;
  });
});

async function loadSchemaXml(schemaXml: string): Promise<Schema> {
  const schemaContext = await BisTestHelper.getNewContext();
  return deserializeXml(schemaXml, schemaContext);
}
