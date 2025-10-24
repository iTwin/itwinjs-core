import { AnyPropertyProps, AnySchemaItemProps, ClassProps, RelationshipClassProps, Schema, SchemaItemType, SchemaKey } from "@itwin/ecschema-metadata";
import { IncrementalTestHelper } from "./utils/IncrementalTestHelper";
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
  return item.schemaItemType === SchemaItemType.EntityClass || item.schemaItemType === SchemaItemType.Mixin || item.schemaItemType === SchemaItemType.RelationshipClass ||
    item.schemaItemType === SchemaItemType.StructClass || item.schemaItemType === SchemaItemType.CustomAttributeClass;
}

function isRelationshipClass(item: AnySchemaItemProps): item is RelationshipClassProps {
  return "source" in item && "target" in item;
}

describe("ECSql query tests", function () {
  let schemaLocater: TestSqlSchemaLocater;

  function validateItem(name: string, itemPropObjects: AnySchemaItemProps[], schema: Schema) {
    const actualJson = findItem(name, itemPropObjects);
    const expectedItem = schema.getItemSync(name);
    const expectedJson = expectedItem!.toJSON();

    // The following code exists because some data coming from the database will not match the
    // data from the context due to default values. This is OK as long as the conditions are
    // correct. For instance, schemaItem name will not exist in serialized JSON, but does exist
    // coming from the DB. RelationshipConstraint's AbstractConstraint is set when only one
    // constraint class exists coming from the database, but a serialized Relationship will not
    // contain the abstract constraint. The one constraint is 'assumed' to be the abstract constraint.

    expect(actualJson.name).to.equal(expectedItem?.name);
    delete (actualJson as any).name;

    if (isECClass(actualJson)) {
      if (expectedJson.schemaItemType === "Mixin") {
        expect(actualJson.modifier).to.be.oneOf([undefined, 'Abstract']);
        delete (actualJson as any).modifier;
      } else if ((expectedJson as ClassProps).modifier === undefined) {
        expect(actualJson.modifier).to.be.oneOf([undefined, 'None']);
        delete (actualJson as any).modifier;
      }
    }
    if (isRelationshipClass(actualJson)) {
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

    if (actualJson.schemaItemType === SchemaItemType.Format) {
      if (undefined !== (actualJson as any).includeZero && undefined === (expectedJson as any).includeZero) {
        expect((actualJson as any).includeZero).to.equal(true);
        delete (actualJson as any).includeZero;
      }
      if ((actualJson as any).composite && undefined !== (actualJson as any).composite.includeZero && undefined === (expectedJson as any).composite.includeZero) {
        expect((actualJson as any).composite.includeZero).to.equal(true);
        delete (actualJson as any).composite.includeZero;
      }
      if ((actualJson as any).composite && undefined !== (actualJson as any).composite.spacer && undefined === (expectedJson as any).composite.spacer) {
        expect((actualJson as any).composite.spacer).to.equal(" ");
        delete (actualJson as any).composite.spacer;
      }
      if (undefined !== (actualJson as any).decimalSeparator && undefined === (expectedJson as any).decimalSeparator) {
        expect((actualJson as any).decimalSeparator).to.equal(".");
        delete (actualJson as any).decimalSeparator;
      }
      if (undefined !== (actualJson as any).roundFactor && undefined === (expectedJson as any).roundFactor) {
        expect((actualJson as any).roundFactor).to.equal(0);
        delete (actualJson as any).roundFactor;
      }
      if (undefined !== (actualJson as any).showSignOption && undefined === (expectedJson as any).showSignOption) {
        expect((actualJson as any).showSignOption).to.equal("OnlyNegative");
        delete (actualJson as any).showSignOption;
      }
      if (undefined !== (actualJson as any).thousandSeparator && undefined === (expectedJson as any).thousandSeparator) {
        expect((actualJson as any).thousandSeparator).to.equal(",");
        delete (actualJson as any).thousandSeparator;
      }
      if (undefined !== (actualJson as any).uomSeparator && undefined === (expectedJson as any).uomSeparator) {
        expect((actualJson as any).uomSeparator).to.equal(" ");
        delete (actualJson as any).uomSeparator;
      }
      if (undefined !== (actualJson as any).spacer && undefined === (expectedJson as any).spacer) {
        expect((actualJson as any).spacer).to.equal(" ");
        delete (actualJson as any).spacer;
      }
      if (undefined !== (actualJson as any).formatTraits) {
        (actualJson as any).formatTraits = (actualJson as any).formatTraits.map((trait: string) => {
          return trait.charAt(0).toUpperCase() + trait.slice(1);
        });
      }
    }

    expect(actualJson).to.deep.equalInAnyOrder(expectedJson);
  }

  this.beforeEach(async () => {
    await IncrementalTestHelper.setup();
    schemaLocater = new TestSqlSchemaLocater(IncrementalTestHelper.iModel);
  });

  afterEach(async () => {
    await IncrementalTestHelper.close();
  });

  it("Schema query, props parsed successfully", async function () {
    const testKey = new SchemaKey("SchemaTest", 1, 0, 0);
    await IncrementalTestHelper.importSchema(testKey);

    const expectedSchema = await IncrementalTestHelper.context.getSchema(testKey);
    if (!expectedSchema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const actualSchemaProps = await schemaLocater.getSchemaJson(testKey, IncrementalTestHelper.context);
    const actualSchema = await Schema.fromJson(actualSchemaProps!, IncrementalTestHelper.context);

    expect(actualSchema.toJSON()).to.deep.equal(expectedSchema?.toJSON());
  });

  it("Property query, props parsed successfully", async function () {
    const testKey = new SchemaKey("PropertyTest", 1, 0, 0);
    await IncrementalTestHelper.importSchema(testKey);

    const schema = await IncrementalTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const classPropsObjects = await schemaLocater.getEntities(testKey.name, IncrementalTestHelper.context);
    const entityOneProps = findItem("EntityOne", classPropsObjects);
    const entityTwoProps = findItem("EntityTwo", classPropsObjects);
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
    await IncrementalTestHelper.importSchema(testKey);

    const schema = await IncrementalTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const classPropsObjects = await schemaLocater.getEntities(testKey.name, IncrementalTestHelper.context);
    expect(classPropsObjects.length).to.be.greaterThan(0);

    validateItem("EntityModifierNone", classPropsObjects, schema);
    validateItem("EntityModifierAbstract", classPropsObjects, schema);
    validateItem("EntityModifierSealed", classPropsObjects, schema);
  });

  it("Struct query, props parsed successfully", async function () {
    const testKey = new SchemaKey("StructTest", 1, 0, 0);
    await IncrementalTestHelper.importSchema(testKey);

    const schema = await IncrementalTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const classPropsObjects = await schemaLocater.getStructs(testKey.name, IncrementalTestHelper.context);
    expect(classPropsObjects.length).to.be.greaterThan(0);

    validateItem("StructModifierNone", classPropsObjects, schema);
    validateItem("StructModifierAbstract", classPropsObjects, schema);
    validateItem("StructModifierSealed", classPropsObjects, schema);
  });

  it("Mixin query, props parsed successfully", async function () {
    const testKey = new SchemaKey("MixinTest", 1, 0, 0);
    await IncrementalTestHelper.importSchema(testKey);

    const schema = await IncrementalTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const classPropsObjects = await schemaLocater.getMixins(testKey.name, IncrementalTestHelper.context);
    expect(classPropsObjects.length).to.be.greaterThan(0);

    validateItem("IBaseMixin", classPropsObjects, schema);
    validateItem("ITestMixin", classPropsObjects, schema);
  });

  it("Relationship query, props parsed successfully", async function () {
    const testKey = new SchemaKey("RelationshipTest", 1, 0, 0);
    await IncrementalTestHelper.importSchema(testKey);

    const schema = await IncrementalTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const classPropsObjects = await schemaLocater.getRelationships(testKey.name, IncrementalTestHelper.context);
    expect(classPropsObjects.length).to.be.greaterThan(0);

    validateItem("OwnerOwnsVehicles", classPropsObjects, schema);
    validateItem("OwnerOwnsCars", classPropsObjects, schema);
    validateItem("OwnerOwnsAmericanCars", classPropsObjects, schema);
    validateItem("PhysicalModelBreaksDownCarElement", classPropsObjects, schema);
  });

  it("CustomAttributeClass query, props parsed successfully", async function () {
    const testKey = new SchemaKey("CustomAttributeClassTest", 1, 0, 0);
    await IncrementalTestHelper.importSchema(testKey);

    const schema = await IncrementalTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const classPropsObjects = await schemaLocater.getCustomAttributeClasses(testKey.name, IncrementalTestHelper.context);
    expect(classPropsObjects.length).to.be.greaterThan(0);

    validateItem("CustomAttributeModifierNone", classPropsObjects, schema);
    validateItem("CustomAttributeModifierSealed", classPropsObjects, schema);
    validateItem("CustomAttributeModifierAbstract", classPropsObjects, schema);
  });

  it("KindOfQuantity query, props parsed successfully", async function () {
    const testKey = new SchemaKey("KindOfQuantityTest", 1, 0, 0);
    await IncrementalTestHelper.importSchema(testKey);

    const schema = await IncrementalTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const itemPropsObjects = await schemaLocater.getKindOfQuantities(testKey.name, IncrementalTestHelper.context);
    expect(itemPropsObjects.length).to.be.greaterThan(0);

    validateItem("ACCELERATION", itemPropsObjects, schema);
    validateItem("ANGLE", itemPropsObjects, schema);
  });

  it("PropertyCategory query, props parsed successfully", async function () {
    const testKey = new SchemaKey("PropertyCategoryTest", 1, 0, 0);
    await IncrementalTestHelper.importSchema(testKey);

    const schema = await IncrementalTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const itemPropsObjects = await schemaLocater.getPropertyCategories(testKey.name, IncrementalTestHelper.context);
    expect(itemPropsObjects.length).to.be.greaterThan(0);

    validateItem("PropertyCategory1", itemPropsObjects, schema);
    validateItem("PropertyCategory2", itemPropsObjects, schema);
  });

  it("Enumeration query, props parsed successfully", async function () {
    const testKey = new SchemaKey("EnumerationTest", 1, 0, 0);
    await IncrementalTestHelper.importSchema(testKey);

    const schema = await IncrementalTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const itemPropsObjects = await schemaLocater.getEnumerations(testKey.name, IncrementalTestHelper.context);
    expect(itemPropsObjects.length).to.be.greaterThan(0);

    validateItem("IntEnumeration", itemPropsObjects, schema);
    validateItem("StringEnumeration", itemPropsObjects, schema);
  });

  it("Unit query, props parsed successfully", async function () {
    const testKey = new SchemaKey("UnitTest", 1, 0, 0);
    await IncrementalTestHelper.importSchema(testKey);

    const schema = await IncrementalTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const itemPropsObjects = await schemaLocater.getUnits(testKey.name, IncrementalTestHelper.context);
    expect(itemPropsObjects.length).to.be.greaterThan(0);

    validateItem("LITRE", itemPropsObjects, schema);
    validateItem("GALLON", itemPropsObjects, schema);
    validateItem("ACRE", itemPropsObjects, schema);
    validateItem("FAHRENHEIT", itemPropsObjects, schema);
  });

  it("InvertedUnit query, props parsed successfully", async function () {
    const testKey = new SchemaKey("InvertedUnitTest", 1, 0, 0);
    await IncrementalTestHelper.importSchema(testKey);

    const schema = await IncrementalTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const itemPropsObjects = await schemaLocater.getInvertedUnits(testKey.name, IncrementalTestHelper.context);
    expect(itemPropsObjects.length).to.be.greaterThan(0);

    validateItem("FT_HORIZONTAL_PER_FT_VERTICAL", itemPropsObjects, schema);
  });

  it("UnitSystem query, props parsed successfully", async function () {
    // There's a UnitSystem in there.
    const testKey = new SchemaKey("InvertedUnitTest", 1, 0, 0);
    await IncrementalTestHelper.importSchema(testKey);

    const schema = await IncrementalTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const itemPropsObjects = await schemaLocater.getUnitSystems(testKey.name, IncrementalTestHelper.context);
    expect(itemPropsObjects.length).to.be.greaterThan(0);

    validateItem("USCUSTOM", itemPropsObjects, schema);
  });

  it("Constant query, props parsed successfully", async function () {
    // There's a UnitSystem in there.
    const testKey = new SchemaKey("ConstantTest", 1, 0, 0);
    await IncrementalTestHelper.importSchema(testKey);

    const schema = await IncrementalTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const itemPropsObjects = await schemaLocater.getConstants(testKey.name, IncrementalTestHelper.context);
    expect(itemPropsObjects.length).to.be.greaterThan(0);

    validateItem("KILO", itemPropsObjects, schema);
    validateItem("HALF_PI", itemPropsObjects, schema);
  });

  it("Phenomenon query, props parsed successfully", async function () {
    // There's a Phenomenon in there.
    const testKey = new SchemaKey("ConstantTest", 1, 0, 0);
    await IncrementalTestHelper.importSchema(testKey);

    const schema = await IncrementalTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const itemPropsObjects = await schemaLocater.getPhenomenon(testKey.name, IncrementalTestHelper.context);
    expect(itemPropsObjects.length).to.be.greaterThan(0);

    validateItem("NUMBER", itemPropsObjects, schema);
    validateItem("LENGTH_RATIO", itemPropsObjects, schema);
  });

  it("Format Schema parses successfully", async function () {
    // Using installed Formats schema
    const testKey = new SchemaKey("Formats", 1, 0, 0);
    await IncrementalTestHelper.importSchema(testKey);

    const schema = await IncrementalTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const itemPropsObjects = await schemaLocater.getFormats(testKey.name, IncrementalTestHelper.context);
    expect(itemPropsObjects.length).to.be.greaterThan(0);

    for (const props of itemPropsObjects) {
      validateItem(props.name!, itemPropsObjects, schema);
    }
  });

  it("Comprehensive Format parses successfully", async function () {
    const testKey = new SchemaKey("FormatTest", 1, 0, 0);
    await IncrementalTestHelper.importSchema(testKey);

    const schema = await IncrementalTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const itemPropsObjects = await schemaLocater.getFormats(testKey.name, IncrementalTestHelper.context);
    expect(itemPropsObjects.length).to.be.greaterThan(0);

    for (const props of itemPropsObjects) {
      validateItem(props.name!, itemPropsObjects, schema);
    }
  });

  it("CustomAttribute instances parse successfully", async function () {
    const testKey = new SchemaKey("CustomAttributeInstanceTest", 1, 0, 0);
    await IncrementalTestHelper.importSchema(testKey);

    const schema = await IncrementalTestHelper.context.getSchema(testKey);
    if (!schema)
      throw new Error(`Could not find schema ${testKey.name}`);

    const itemPropsObjects = await schemaLocater.getStructs(testKey.name, IncrementalTestHelper.context);
    expect(itemPropsObjects.length).to.be.greaterThan(0);

    for (const props of itemPropsObjects) {
      validateItem(props.name!, itemPropsObjects, schema);
    }
  });
});