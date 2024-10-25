import { PrimitiveType, Schema, SchemaItemKey } from "@itwin/ecschema-metadata";
import { AnySchemaDifferenceConflict, ConflictCode, getSchemaDifferences, SchemaContextEditor, SchemaDifferenceResult, SchemaEdits, SchemaEditType, SchemaMerger } from "../../../ecschema-editing";
import { BisTestHelper } from "../../TestUtils/BisTestHelper";
import { deserializeXml } from "../../TestUtils/DeserializationHelpers";
import { expect } from "chai";

describe.only("Iterative Tests", () => {

  it("shall correctly deal with saved edits", async () => {

    async function combineIModelSchemas(handler: (differenceResult: SchemaDifferenceResult) => Promise<void>): Promise<Schema> {
      // apply previously made changes to the schemas...
      sourceSchema = await applyEdits(sourceSchema, schemaEdits);

      // Get differences between the two schemas
      const differenceResult = await getSchemaDifferences(targetSchema, sourceSchema);
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
        expect(conflict.code).to.equal(ConflictCode.ConflictingPropertyName);
        expect(conflict.source).to.equal("double");
        expect(conflict.target).to.equal("string");
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
          <ECProperty propertyName="TestProperty" typeName="double" displayLabel="This is a double property" />
        </ECEntityClass>
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

    expect(true).is.true;
  });

});

async function loadSchemaXml(schemaXml: string): Promise<Schema> {
  const schemaContext = await BisTestHelper.getNewContext();
  return deserializeXml(schemaXml, schemaContext);
}

async function applyEdits(schema: Schema, edits: SchemaEdits): Promise<Schema> {
  // TODO: Make a copy of the source schema to not alter the input data.

  const editsEditor = new SchemaContextEditor(schema.context);
  for (const edit of edits.toJSON()) {
    if(edit.type === SchemaEditType.RenameProperty) {
      const [_schemaName, itemName, propertyName] = edit.key.split(".") as [string, string, string];
      const itemKey = new SchemaItemKey(itemName, schema.schemaKey);
      await editsEditor.entities.properties.setName(itemKey, propertyName, edit.value);
    }

    if(edit.type === SchemaEditType.RenameSchemaItem) {
      const [_schemaName, itemName] = edit.key.split(".") as [string, string];
      const itemKey = new SchemaItemKey(itemName, schema.schemaKey);
      await editsEditor.entities.setName(itemKey, edit.value);
    }

    if(edit.type === SchemaEditType.Skip) {
      const [_schemaName, itemName, propertyName] = edit.key.split(".") as [string, string, string|undefined];
      const itemKey = new SchemaItemKey(itemName, schema.schemaKey);
      if(propertyName === undefined) {
        await editsEditor.entities.delete(itemKey);
      } else {
        await editsEditor.entities.deleteProperty(itemKey, propertyName);
      }
    }
  }
  return schema;
}

// Alternative idea with logic in Schema Editor:
//
// async function applyEdits(schema: Schema, edits: SchemaEdits): Promise<Schema> {
//   const editsEditor = new SchemaContextEditor(schema.context);
//   for (const edit of edits.toJSON()) {
//     if(edit.type === SchemaEditType.RenameProperty) {
//       const [_schemaName, itemName, propertyName] = edit.key.split(".") as [string, string, string];
//       const itemKey = new SchemaItemKey(itemName, schema.schemaKey);
//
//       // API does not exists yet!!
//       await editsEditor.mapProperty(itemKey, propertyName, edit.value);
//     }
//   }
// }
