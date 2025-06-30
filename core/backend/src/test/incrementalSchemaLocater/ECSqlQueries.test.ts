import { AnyPropertyProps, AnySchemaItemProps, ClassProps, EntityClassProps, RelationshipClassProps, Schema, SchemaKey } from "@itwin/ecschema-metadata";
import { SqlTestHelper } from "./utils/SqlTestHelper";
import { expect, use } from "chai";
import * as deepEqualInAnyOrder from "deep-equal-in-any-order";
import { TestSqlSchemaLocater } from "./utils/TestSqlSchemaLocater";

use(deepEqualInAnyOrder);

function findItem<T extends AnySchemaItemProps>(name: string, rowData: T[]) {
  const item = rowData.find((i: AnySchemaItemProps) => i.name === name);
  if (!item)
    throw new Error(`Could not find schema item '${name}'`);
  return item;
}

function findProperty<T extends AnyPropertyProps>(name: string, rowData: T[]) {
  return rowData.find((i: AnyPropertyProps) => i.name === name);
}

function isECClass(item: AnySchemaItemProps): item is ClassProps {
  return "baseClass" in item;
}

function isRelationshipClass(item: AnySchemaItemProps): item is RelationshipClassProps {
  return "source" in item && "target" in item;
}

describe("ECSql query tests", function () {
  let schemaLoader: TestSqlSchemaLocater;

  async function validateItem(name: string, itemPropObjects: AnySchemaItemProps[], schema: Schema) {
    const actualJson = findItem(name, itemPropObjects);
    const expectedItem = schema.getItemSync(name);
    const expectedJson = schema.toJSON();

    // The following code exists because some data coming from the database will not match the
    // data from the context due to default values. This is OK as long as the conditions are
    // correct. For instance, schemaItem name will not exist in serialized JSON, but does exist
    // coming from the DB. RelationshipConstraint's AbstractConstraint is set when only one
    // constraint class exists coming from the database, but a serialized Relationship will not
    // contain the abstract constraint. The one constraint is 'assumed' to be the abstract constraint.
    if (isECClass(actualJson!)) {
      // Name does not exist in serialized JSON but does exist from DB.
      expect(actualJson.name).to.equal(expectedItem?.name);
      delete (actualJson as any).name;
    }
    if (isRelationshipClass(actualJson!)) {
      // abstract can be set via database, but not via context for 1 constraint class
      // so verify constraint and conditions are correct and delete property
      const expectedRelationship = expectedJson as any as RelationshipClassProps;
      if (actualJson.source.abstractConstraint !== expectedRelationship.source.abstractConstraint) {
        expect(actualJson.source.abstractConstraint).to.equal(expectedRelationship.source.constraintClasses[0]);
        expect(actualJson.source.constraintClasses.length).to.equal(1);
        delete (actualJson.source as any).abstractConstraint;
      }
      if (actualJson.target.abstractConstraint !== expectedRelationship.target.abstractConstraint) {
        expect(actualJson.target.abstractConstraint).to.equal(expectedRelationship.target.constraintClasses[0]);
        expect(actualJson.target.constraintClasses.length).to.equal(1);
        delete (actualJson.target as any).abstractConstraint;
      }
    }

    expect(actualJson).to.deep.equalInAnyOrder(expectedJson);
  }

  this.beforeEach(async () => {
    await SqlTestHelper.setup();
    schemaLoader = new TestSqlSchemaLocater(SqlTestHelper.iModel);
  });

  afterEach(async () => {
    await SqlTestHelper.close();
  });

  it("Schema query, props parsed successfully", async function () {
    const testKey = new SchemaKey("SchemaTest", 1, 0, 0);
    await SqlTestHelper.importSchema(testKey);

    const expectedSchema = await SqlTestHelper.context.getSchema(testKey);
    if (!expectedSchema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const actualSchemaProps = await schemaLoader.getSchemaJson(testKey, SqlTestHelper.context);
    const actualSchema = await Schema.fromJson(actualSchemaProps!, SqlTestHelper.context);

    expect(actualSchema.toJSON()).to.deep.equal(expectedSchema?.toJSON());
  });

  it("Property query, props parsed successfully", async function () {
    const testKey = new SchemaKey("PropertyTest", 1, 0, 0);
    await SqlTestHelper.importSchema(testKey);

    const schema = await SqlTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const classPropsObjects = await schemaLoader.getEntities(testKey.name, SqlTestHelper.context);
    const entityOneProps = findItem("EntityOne", classPropsObjects) as EntityClassProps;
    const entityTwoProps = findItem("EntityTwo", classPropsObjects) as EntityClassProps;
    const expectedEntityOne = await schema.getEntityClass("EntityOne");
    const expectedEntityTwo = await schema.getEntityClass("EntityTwo");

    const validateProperty = (propertyName: string, actualItem = entityOneProps, expectedItem = expectedEntityOne) => {
      const actualProperty = findProperty(propertyName, actualItem.properties!);
      const expectedProperty = expectedItem?.getPropertySync(propertyName);
      // if maxOccurs is the maximum int value in the context Schema,
      // the property from the DB will not have a value
      if ((expectedProperty as any).maxOccurs === 2147483647) {
        expect((actualProperty as any).maxOccurs).to.be.undefined;
        // set so comparison will pass
        (actualProperty as any).maxOccurs = 2147483647;
      }

      expect(actualProperty).to.deep.equal(expectedProperty?.toJSON());
    };

    // All but one testable property is in EntityOne
    for (const property of await expectedEntityOne!.getProperties(true)) {
      validateProperty(property.name);
    }
    // Backward direction Navigation property is in EntityTwo
    validateProperty("EntityTwoParent", entityTwoProps, expectedEntityTwo);

  });

  it("Entity query, props parsed successfully", async function () {
    const testKey = new SchemaKey("EntityTest", 1, 0, 0);
    await SqlTestHelper.importSchema(testKey);

    const schema = await SqlTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const classPropsObjects = await schemaLoader.getEntities(testKey.name, SqlTestHelper.context);
    expect(classPropsObjects.length).to.be.greaterThan(0);

    validateItem("EntityModifierNone", classPropsObjects, schema);
    validateItem("EntityModifierAbstract", classPropsObjects, schema);
    validateItem("EntityModifierSealed", classPropsObjects, schema);
  });

  it("Struct query, props parsed successfully", async function () {
    const testKey = new SchemaKey("StructTest", 1, 0, 0);
    await SqlTestHelper.importSchema(testKey);

    const schema = await SqlTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const classPropsObjects = await schemaLoader.getStructs(testKey.name, SqlTestHelper.context);
    expect(classPropsObjects.length).to.be.greaterThan(0);

    validateItem("StructModifierNone", classPropsObjects, schema);
    validateItem("StructModifierAbstract", classPropsObjects, schema);
    validateItem("StructModifierSealed", classPropsObjects, schema);
  });

  it("Mixin query, props parsed successfully", async function () {
    const testKey = new SchemaKey("MixinTest", 1, 0, 0);
    await SqlTestHelper.importSchema(testKey);

    const schema = await SqlTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const classPropsObjects = await schemaLoader.getMixins(testKey.name, SqlTestHelper.context);
    expect(classPropsObjects.length).to.be.greaterThan(0);

    validateItem("IBaseMixin", classPropsObjects, schema);
    validateItem("ITestMixin", classPropsObjects, schema);
  });

  it("Relationship query, props parsed successfully", async function () {
    const testKey = new SchemaKey("RelationshipTest", 1, 0, 0);
    await SqlTestHelper.importSchema(testKey);

    const schema = await SqlTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const classPropsObjects = await schemaLoader.getRelationships(testKey.name, SqlTestHelper.context);
    expect(classPropsObjects.length).to.be.greaterThan(0);

    validateItem("OwnerOwnsVehicles", classPropsObjects, schema);
    validateItem("OwnerOwnsCars", classPropsObjects, schema);
    validateItem("OwnerOwnsAmericanCars", classPropsObjects, schema);
    validateItem("PhysicalModelBreaksDownCarElement", classPropsObjects, schema);
  });

  it("CustomAttributeClass query, props parsed successfully", async function () {
    const testKey = new SchemaKey("CustomAttributeClassTest", 1, 0, 0);
    await SqlTestHelper.importSchema(testKey);

    const schema = await SqlTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const classPropsObjects = await schemaLoader.getCustomAttributeClasses(testKey.name, SqlTestHelper.context);
    expect(classPropsObjects.length).to.be.greaterThan(0);

    validateItem("CustomAttributeModifierNone", classPropsObjects, schema);
    validateItem("CustomAttributeModifierSealed", classPropsObjects, schema);
    validateItem("CustomAttributeModifierAbstract", classPropsObjects, schema);
  });

  it("KindOfQuantity query, props parsed successfully", async function () {
    const testKey = new SchemaKey("KindOfQuantityTest", 1, 0, 0);
    await SqlTestHelper.importSchema(testKey);

    const schema = await SqlTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const itemPropsObjects = await schemaLoader.getKindOfQuantities(testKey.name, SqlTestHelper.context);
    expect(itemPropsObjects.length).to.be.greaterThan(0);

    validateItem("ACCELERATION", itemPropsObjects, schema);
    validateItem("ANGLE", itemPropsObjects, schema);
  });

  it("PropertyCategory query, props parsed successfully", async function () {
    const testKey = new SchemaKey("PropertyCategoryTest", 1, 0, 0);
    await SqlTestHelper.importSchema(testKey);

    const schema = await SqlTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const itemPropsObjects = await schemaLoader.getPropertyCategories(testKey.name, SqlTestHelper.context);
    expect(itemPropsObjects.length).to.be.greaterThan(0);

    validateItem("PropertyCategory1", itemPropsObjects, schema);
    validateItem("PropertyCategory2", itemPropsObjects, schema);
  });

  it("Enumeration query, props parsed successfully", async function () {
    const testKey = new SchemaKey("EnumerationTest", 1, 0, 0);
    await SqlTestHelper.importSchema(testKey);

    const schema = await SqlTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const itemPropsObjects = await schemaLoader.getEnumerations(testKey.name, SqlTestHelper.context);
    expect(itemPropsObjects.length).to.be.greaterThan(0);

    validateItem("IntEnumeration", itemPropsObjects, schema);
    validateItem("StringEnumeration", itemPropsObjects, schema);
  });

  it("Unit query, props parsed successfully", async function () {
    const testKey = new SchemaKey("UnitTest", 1, 0, 0);
    await SqlTestHelper.importSchema(testKey);

    const schema = await SqlTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const itemPropsObjects = await schemaLoader.getUnits(testKey.name, SqlTestHelper.context);
    expect(itemPropsObjects.length).to.be.greaterThan(0);

    validateItem("LITRE", itemPropsObjects, schema);
    validateItem("GALLON", itemPropsObjects, schema);
    validateItem("ACRE", itemPropsObjects, schema);
    validateItem("FAHRENHEIT", itemPropsObjects, schema);
  });

  it("InvertedUnit query, props parsed successfully", async function () {
    const testKey = new SchemaKey("InvertedUnitTest", 1, 0, 0);
    await SqlTestHelper.importSchema(testKey);

    const schema = await SqlTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const itemPropsObjects = await schemaLoader.getInvertedUnits(testKey.name, SqlTestHelper.context);
    expect(itemPropsObjects.length).to.be.greaterThan(0);

    validateItem("FT_HORIZONTAL_PER_FT_VERTICAL", itemPropsObjects, schema);
  });

  it("UnitSystem query, props parsed successfully", async function () {
    // There's a UnitSystem in there.
    const testKey = new SchemaKey("InvertedUnitTest", 1, 0, 0);
    await SqlTestHelper.importSchema(testKey);

    const schema = await SqlTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const itemPropsObjects = await schemaLoader.getUnitSystems(testKey.name, SqlTestHelper.context);
    expect(itemPropsObjects.length).to.be.greaterThan(0);

    validateItem("USCUSTOM", itemPropsObjects, schema);
  });

  it("Constant query, props parsed successfully", async function () {
    // There's a UnitSystem in there.
    const testKey = new SchemaKey("ConstantTest", 1, 0, 0);
    await SqlTestHelper.importSchema(testKey);

    const schema = await SqlTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const itemPropsObjects = await schemaLoader.getConstants(testKey.name, SqlTestHelper.context);
    expect(itemPropsObjects.length).to.be.greaterThan(0);

    validateItem("KILO", itemPropsObjects, schema);
    validateItem("HALF_PI", itemPropsObjects, schema);
  });

  it("Phenomenon query, props parsed successfully", async function () {
    // There's a Phenomenon in there.
    const testKey = new SchemaKey("ConstantTest", 1, 0, 0);
    await SqlTestHelper.importSchema(testKey);

    const schema = await SqlTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const itemPropsObjects = await schemaLoader.getPhenomenon(testKey.name, SqlTestHelper.context);
    expect(itemPropsObjects.length).to.be.greaterThan(0);

    validateItem("NUMBER", itemPropsObjects, schema);
    validateItem("LENGTH_RATIO", itemPropsObjects, schema);
  });

  it("Format Schema parses successfully", async function () {
    // Using installed Formats schema
    const testKey = new SchemaKey("Formats", 1, 0, 0);
    await SqlTestHelper.importSchema(testKey);

    const schema = await SqlTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const itemPropsObjects = await schemaLoader.getFormats(testKey.name, SqlTestHelper.context);
    expect(itemPropsObjects.length).to.be.greaterThan(0);

    for (const props of itemPropsObjects) {
      validateItem(props.name!, itemPropsObjects, schema);
    }
  });

  it("Comprehensive Format parses successfully", async function () {
    const testKey = new SchemaKey("FormatTest", 1, 0, 0);
    await SqlTestHelper.importSchema(testKey);

    const schema = await SqlTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const itemPropsObjects = await schemaLoader.getFormats(testKey.name, SqlTestHelper.context);
    expect(itemPropsObjects.length).to.be.greaterThan(0);

    for (const props of itemPropsObjects) {
      validateItem(props.name!, itemPropsObjects, schema);
    }
  });

  it("CustomAttribute instances parse successfully", async function () {
    const testKey = new SchemaKey("CustomAttributeInstanceTest", 1, 0, 0);
    await SqlTestHelper.importSchema(testKey);

    const schema = await SqlTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const itemPropsObjects = await schemaLoader.getStructs(testKey.name, SqlTestHelper.context);
    expect(itemPropsObjects.length).to.be.greaterThan(0);

    for (const props of itemPropsObjects) {
      validateItem(props.name!, itemPropsObjects, schema);
    }
  });
});