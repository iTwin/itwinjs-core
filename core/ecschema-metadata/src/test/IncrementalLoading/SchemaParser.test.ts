/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { TestSchemaLocater } from "./FormatTestHelper";
import { CustomAttribute } from "../../Metadata/CustomAttribute";
import { ECSchemaNamespaceUris } from "../../Constants";
import { SchemaContext } from "../../Context";
import { CustomAttributeContainerType } from "../../ECObjects";
import { SchemaParser } from "../../IncrementalLoading/SchemaParser";
import { MutableSchema, Schema } from "../../Metadata/Schema";
import { SchemaKey } from "../../SchemaKey";
import { AnySchemaItemProps, SchemaItemProps } from "../../Deserialization/JsonProps";
import { KindOfQuantity } from "../../Metadata/KindOfQuantity";
import { EntityClass } from "../../Metadata/EntityClass";
import { StructClass } from "../../Metadata/Class";
import { UnitSystem } from "../../Metadata/UnitSystem";

/* eslint-disable @typescript-eslint/naming-convention */

interface CustomAttributeData { ecClass: string; ecSchema: string;[propName: string]: any; }

function findItem(name: string, items: { [name: string]: AnySchemaItemProps; }): AnySchemaItemProps {
  const item = items[name];
  if (!item)
    throw new Error(`Could not find schema item '${name}'`);
  return item;
}

function createItemRows(items: { [name: string]: AnySchemaItemProps; }): SchemaItemProps[] {
  const itemRows: SchemaItemProps[] = [];
  for (const key of Object.keys(items)) {
    const item = items[key];
    (item as any).name = key;
    itemRows.push(item)
  }
  return itemRows;
}

describe("SchemaParser Tests", function () {
  let schema: MutableSchema;

  beforeEach(async () => {
    const context = new SchemaContext();
    schema = new Schema(context, "TestSchema", "ts", 1, 0, 0) as MutableSchema;
    (schema as any)._label = "TestLabel";
    (schema as any)._description = "Test Description";
    await context.addSchema(schema);
  })

  it("Parse Schema with CustomAttributes and references, props parsed correctly", async function () {
    const attributeData: CustomAttributeData = {
      ecClass: 'ProductionStatus',
      ecSchema: 'CoreCustomAttributes.01.00',
      ProductionStatus: {
        SupportedUse: 'NotForProduction',
        Checksum: 'mock-checksum-value'
      }
    }

    const customAttribute: CustomAttribute = {
      className: "CoreCustomAttributes.ProductionStatus",
      SupportedUse: 'NotForProduction',
      Checksum: 'mock-checksum-value'
    }

    const refSchema1 = new Schema(schema.context, "RefSchema1", "rs", 1, 0, 0);
    const refSchema2 = new Schema(schema.context, "RefSchema2", "rs", 1, 0, 0);
    await schema.context.addSchema(refSchema1);
    await schema.context.addSchema(refSchema2);
    await schema.addReference(refSchema1);
    await schema.addReference(refSchema2);
    schema.addCustomAttribute(customAttribute);

    const fromDBProps = schema.toJSON();
    // Coming from database, customAttributes has a different form, so force a reset here.
    (fromDBProps as any).customAttributes = [attributeData];

    const props = await SchemaParser.parse(fromDBProps, schema.context.getKnownSchemas());
    expect(props).to.deep.equal(schema.toJSON());
  });

  const baseJson = {
    schemaItemType: "KindOfQuantity",
    name: "TestKindOfQuantity",
    label: "SomeDisplayLabel",
    description: "A really long description...",
  };

  it("Parse Schema with KindOfQuantity SchemaItems, props parsed correctly", async function () {
    const koqJson = {
      ...baseJson,
      relativeError: 4,
      persistenceUnit: "Formats.YRD",
      presentationUnits: [
        "Formats.DoubleUnitFormat(6)[Formats.YRD|yard(s)][Formats.FT|feet]",
      ],
    };

    schema.context.addLocater(new TestSchemaLocater());
    const formatsSchema = schema.context.getSchemaSync(new SchemaKey("formats", 1, 0, 0));
    await schema.addReference(formatsSchema!);

    const item = new KindOfQuantity(schema, "TestKindOfQuantity");
    schema.addItem(item);
    await item.fromJSON(koqJson);
    const fromDBProps = schema.toJSON();

    // Coming from database, units have an XML typed name (alias:name) so force a reset here
    const koqItem = findItem("TestKindOfQuantity", fromDBProps.items!);
    (koqItem as any).persistenceUnit = "f:YRD";
    (koqItem as any).presentationUnits = ["f:DoubleUnitFormat(6)[f:YRD|yard(s)][f:FT|feet]"];

    // SchemaItems from the query are in the form SchemaItemProp [].
    // Create the the array from the keyed Object.
    (fromDBProps as any).items = createItemRows(fromDBProps.items!);

    const actualProps = await SchemaParser.parse(fromDBProps, schema.context.getKnownSchemas());

    expect(actualProps).to.deep.equal(schema.toJSON());
  });

  it("Parse Schema with EntityClass, props parsed correctly", async function () {
    const item = new EntityClass(schema, "TestClass");
    schema.addItem(item);
    const fromDBProps = schema.toJSON();

    // SchemaItems from the query are in the form SchemaItemProp [].
    // Create the the array from the keyed Object.
    (fromDBProps as any).items = createItemRows(fromDBProps.items!);

    const actualProps = await SchemaParser.parse(fromDBProps, schema.context.getKnownSchemas());

    expect(actualProps).to.deep.equal(schema.toJSON());
  });

  it("Parse Schema with StructClass, props parsed correctly", async function () {
    const item = new StructClass(schema, "TestClass");
    schema.addItem(item);
    const fromDBProps = schema.toJSON();

    // SchemaItems from the query are in the form SchemaItemProp [].
    // Create the the array from the keyed Object.
    (fromDBProps as any).items = createItemRows(fromDBProps.items!);

    const actualProps = await SchemaParser.parse(fromDBProps, schema.context.getKnownSchemas());

    expect(actualProps).to.deep.equal(schema.toJSON());
  });

  function createSchemaJson(items: any): any {
    return {
      $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
      name: "TestSchema",
      version: "1.2.3",
      alias: "ts",
      items: {
        ...items
      },
    };
  }

  function createSchemaWithRelationships(relClassJson: any): any {
    return createSchemaJson({
      TestRelationship: {
        schemaItemType: "RelationshipClass",
        ...relClassJson,
      },
      SourceBaseEntity: {
        schemaItemType: "EntityClass",
      },
      TargetBaseEntity: {
        schemaItemType: "EntityClass",
      },
      TestSourceEntity: {
        schemaItemType: "EntityClass",
        baseClass: "TestSchema.SourceBaseEntity",
      },
      TestTargetEntity: {
        schemaItemType: "EntityClass",
        baseClass: "TestSchema.TargetBaseEntity",
      },
    });
  }

  const validRelationshipJson = {
    strength: "Embedding",
    strengthDirection: "Backward",
    modifier: "Sealed",
    source: {
      polymorphic: true,
      multiplicity: "(0..*)",
      roleLabel: "Source RoleLabel",
      abstractConstraint: "TestSchema.SourceBaseEntity",
      constraintClasses: [
        "TestSchema.TestSourceEntity",
      ],
    },
    target: {
      polymorphic: true,
      multiplicity: "(0..*)",
      roleLabel: "Target RoleLabel",
      abstractConstraint: "TestSchema.TargetBaseEntity",
      constraintClasses: [
        "TestSchema.TestTargetEntity",
      ],
    },
  };

  it("Parse Schema with RelationshipClass, props parsed correctly", async function () {
    const testSchema = await Schema.fromJson(createSchemaWithRelationships(validRelationshipJson), new SchemaContext());
    const fromDBProps = testSchema.toJSON();

    // SchemaItems from the query are in the form SchemaItemProp [].
    // Create the the array from the keyed Object.
    (fromDBProps as any).items = createItemRows(fromDBProps.items!);

    const actualProps = await SchemaParser.parse(fromDBProps, testSchema.context.getKnownSchemas());

    expect(actualProps).to.deep.equal(testSchema.toJSON());
  });

  function createSchemaWithMixin(): any {
    return createSchemaJson({
      TestMixin: {
        schemaItemType: "Mixin",
        appliesTo: "TestSchema.TestEntity",
      },
      TestEntity: {
        schemaItemType: "EntityClass",
      }
    });
  }

  it("Parse Schema with Mixin, props parsed correctly", async function () {
    const testSchema = await Schema.fromJson(createSchemaWithMixin(), new SchemaContext());
    const fromDBProps = testSchema.toJSON();

    // SchemaItems from the query are in the form SchemaItemProp [].
    // Create the the array from the keyed Object.
    (fromDBProps as any).items = createItemRows(fromDBProps.items!);
    const actualProps = await SchemaParser.parse(fromDBProps, testSchema.context.getKnownSchemas());

    expect(actualProps).to.deep.equal(testSchema.toJSON());
  });

  function createSchemaWithCustomAttributeClass(): any {
    return createSchemaJson({
      TestCustomAttributeClass: {
        schemaItemType: "CustomAttributeClass",
        appliesTo: "AnyClass",
      }
    });
  }

  it("Parse Schema with CustomAttributeClass, props parsed correctly", async function () {
    const testSchema = await Schema.fromJson(createSchemaWithCustomAttributeClass(), new SchemaContext());
    const fromDBProps = testSchema.toJSON();

    // Coming from database, appliesTo is a number, so force a reset here.
    const mixin = findItem("TestCustomAttributeClass", fromDBProps.items!);
    (mixin as any).appliesTo = CustomAttributeContainerType.AnyClass;

    // SchemaItems from the query are in the form SchemaItemProp [].
    // Create the the array from the keyed Object.
    (fromDBProps as any).items = createItemRows(fromDBProps.items!);

    const actualProps = await SchemaParser.parse(fromDBProps, testSchema.context.getKnownSchemas());

    expect(actualProps).to.deep.equal(testSchema.toJSON());
  });

  it("Parse Schema with SchemaItem, props parsed correctly", async function () {
    const item = new UnitSystem(schema, "TestUnitSystem");
    schema.addItem(item);
    const fromDBProps = schema.toJSON();

    // SchemaItems from the query are in the form SchemaItemProp [].
    // Create the the array from the keyed Object.
    (fromDBProps as any).items = createItemRows(fromDBProps.items!);

    const actualProps = await SchemaParser.parse(fromDBProps, schema.context.getKnownSchemas());

    expect(actualProps).to.deep.equal(schema.toJSON());
  });
});