import { EntityClass, PrimitiveType, Schema } from "@itwin/ecschema-metadata";
import { AnySchemaDifferenceConflict, ConflictCode, getSchemaDifferences, SchemaDifferenceResult, SchemaEdits, SchemaMerger } from "../../../ecschema-editing";
import { BisTestHelper } from "../../TestUtils/BisTestHelper";
import { deserializeXml } from "../../TestUtils/DeserializationHelpers";
import { expect } from "chai";

describe("Iterative Tests", () => {

  it("shall correctly deal with saved edits", async () => {

    async function combineIModelSchemas(handler: (differenceResult: SchemaDifferenceResult) => Promise<void>): Promise<Schema> {
      // Get differences between the two schemas
      const differenceResult = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
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
      const propertyItem = await sourceSchema.getItem("TestEntity") as EntityClass;
      schemaEdits.properties.rename(propertyItem,"TestProperty" , "TestProperty_double");
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
        expect(property).to.have.a.property("label", "This is a double property");
      });
    });

    // Second and a half iteration: Merge the schema again, but with a different Property Category label.
    sourceSchema = await loadSchemaXml(`
      <ECSchema schemaName="TestSchema" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECSchemaReference name="CoreCustomAttributes" version="01.00.01" alias="CoreCA"/>
        <ECCustomAttributes>
          <DynamicSchema xmlns="CoreCustomAttributes.01.00.03"/>
        </ECCustomAttributes>
        <ECEntityClass typeName="TestEntity" modifier="Sealed">
          <ECProperty propertyName="TestProperty" typeName="double" displayLabel="This is a double property" category="Category" />
        </ECEntityClass>
        <PropertyCategory typeName="Category" displayLabel="My changed Property Category label" priority="100000" />
      </ECSchema>`);

    targetSchema = await combineIModelSchemas(async (result) => {
      expect(result.conflicts).to.be.undefined;
    });

    await expect(targetSchema.getItem("TestEntity")).to.be.eventually.fulfilled.then(async (ecClass) => {
      expect(ecClass).to.exist;
      await expect(ecClass.getProperty("TestProperty_double")).to.be.eventually.fulfilled.then(async (property) => {
        expect(property).to.exist;
        expect(await property.category).to.have.a.nested.property("label", "My changed Property Category label");
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
      const categoryItem = await sourceSchema.getItem("Category");
      schemaEdits.items.rename(categoryItem!, "CategoryStruct");
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
        <!-- <PropertyCategory typeName="Category" displayLabel="I changed the Property Category label again" priority="100000" /> -->
        <ECStructClass typeName="CategoryStruct" displayLabel="I changed the StructClass label as well :P" />
      </ECSchema>`);

    targetSchema = await combineIModelSchemas(async (result) => {
      expect(result.conflicts).to.be.undefined;

      // Rename AbstractBaseClass to CommonBaseClass
      const abstractBaseClassItem = await sourceSchema.getItem("AbstractBaseClass");
      schemaEdits.items.rename(abstractBaseClassItem!, "CommonBaseClass");
    });

    await expect(targetSchema.getItem("Building")).to.be.eventually.fulfilled.then(async (ecClass) => {
      expect(ecClass).to.exist;
      expect(ecClass).to.have.a.nested.property("baseClass.name", "CommonBaseClass");
      await expect(ecClass.getProperty("Address", true)).to.be.eventually.not.undefined;
      await expect(ecClass.getProperty("Height", true)).to.be.eventually.not.undefined;
      await expect(ecClass.getProperty("Tag", true)).to.be.eventually.not.undefined;
    });

    await expect(targetSchema.getItem("Category")).to.be.eventually.fulfilled.then(async (category) => {
      expect(category).to.exist;
      // the issue will be resolved when we add the type of remapped item into schemaEdits
      // expect(category).to.have.a.property("label", "I changed the Property Category label again");
    });

    await expect(targetSchema.getItem("CategoryStruct")).to.be.eventually.fulfilled.then(async (categoryStruct) => {
      expect(categoryStruct).to.exist;
      expect(categoryStruct).to.have.a.property("label", "I changed the StructClass label as well :P");
    });

    // Fifth Iteration: Add a mixin to the schema and apply it to the Building schema. Rename the mixin to ensure references
    // are updated correctly.
    sourceSchema = await loadSchemaXml(`
      <ECSchema schemaName="TestSchema" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECSchemaReference name="CoreCustomAttributes" version="01.00.01" alias="CoreCA"/>
        <ECCustomAttributes>
          <DynamicSchema xmlns="CoreCustomAttributes.01.00.03"/>
        </ECCustomAttributes>
        <ECEntityClass typeName="CommonBaseClass" modifier="Abstract">
          <ECProperty propertyName="Tag" typeName="string" />
        </ECEntityClass>
        <ECEntityClass typeName="AuxBuilding">
          <ECCustomAttributes>
            <IsMixin xmlns="CoreCustomAttributes.01.00.00">
              <AppliesToEntityClass>Building</AppliesToEntityClass>
            </IsMixin>
          </ECCustomAttributes>
          <ECProperty propertyName="Kind" typeName="int" />
        </ECEntityClass>
        <ECEntityClass typeName="Building">
          <BaseClass>CommonBaseClass</BaseClass>
          <BaseClass>AuxBuilding</BaseClass>
          <ECProperty propertyName="Address" typeName="string" />
          <ECProperty propertyName="Height" typeName="double" />
        </ECEntityClass>
      </ECSchema>`);

    targetSchema = await combineIModelSchemas(async (result) => {
      expect(result.conflicts).to.be.undefined;

      // Rename AbstractBaseClass to CommonBaseClass
      const auxBuildingItem = await sourceSchema.getItem("AuxBuilding");
      schemaEdits.items.rename(auxBuildingItem!, "AdditionalBuilding");
    });

    await expect(targetSchema.getItem("Building")).to.be.eventually.fulfilled.then(async (ecClass) => {
      expect(ecClass).to.exist;
      expect(ecClass.mixins).to.satisfy((mixins: any) => {
        expect(mixins).to.have.lengthOf(1);
        expect(mixins[0]).to.have.a.property("name", "AdditionalBuilding");
        return true;
      });
    });

    expect(true).is.true;
  });
});

async function loadSchemaXml(schemaXml: string): Promise<Schema> {
  const schemaContext = await BisTestHelper.getNewContext();
  return deserializeXml(schemaXml, schemaContext);
}
