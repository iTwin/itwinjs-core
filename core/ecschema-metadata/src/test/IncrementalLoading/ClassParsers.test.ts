/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { beforeEach, describe, expect, it } from "vitest";
import { MutableSchema, Schema } from "../../Metadata/Schema";
import { CustomAttribute } from "../../Metadata/CustomAttribute";
import { SchemaContext } from "../../Context";
import { DelayedPromiseWithProps } from "../../DelayedPromise";
import { CustomAttributeContainerType } from "../../ECObjects";
import { ClassParser, CustomAttributeClassParser, MixinParser } from "../../IncrementalLoading/ClassParsers";
import { ECClass, MutableClass } from "../../Metadata/Class";
import { CustomAttributeClass, MutableCAClass } from "../../Metadata/CustomAttributeClass";
import { Mixin, MutableMixin } from "../../Metadata/Mixin";
import { MutableProperty } from "../../Metadata/Property";
import { SchemaItemKey } from "../../SchemaKey";
import { EntityClass } from "../../Metadata/EntityClass";

/* eslint-disable @typescript-eslint/naming-convention */

interface CustomAttributeData { ecClass: string; ecSchema: string;[propName: string]: any; }

describe("ClassParser Tests", function () {
  let schema: MutableSchema;
  let refSchema: Schema;

  beforeEach(async () => {
    const context = new SchemaContext();
    schema = new Schema(context, "TestSchema", "ts", 1, 0, 0) as MutableSchema;
    refSchema = new Schema(context, "RefSchema", "rs", 1, 0, 0);
    await schema.addReference(refSchema);
    await context.addSchema(schema);
    await context.addSchema(refSchema);
  })

  it("Parse EntityClass, props parsed correctly", async function () {
    const attributeData: CustomAttributeData = {
      ecClass: 'PropertyMap',
      ecSchema: 'ECDbMap.02.04',
      PropertyMap: {
        Collation: 'NoCase',
        IsNullable: false,
        IsUnique: true
      }
    }

    const customAttribute: CustomAttribute = {
      className: "ECDbMap.PropertyMap",
      Collation: "NoCase",
      IsNullable: false,
      IsUnique: true
    }

    const ecClass = new EntityClass(schema, "TestClass") as ECClass as MutableClass;
    ecClass.addCustomAttribute(customAttribute);
    const property = await (ecClass).createPrimitiveProperty("TestProp") as MutableProperty;
    property.addCustomAttribute(customAttribute);
    const fromDBProps = ecClass.toJSON();
    // Coming from database, customAttributes has a different form, so force a reset here.
    (fromDBProps as any).customAttributes = [attributeData];
    (fromDBProps.properties![0] as any).customAttributes = [attributeData];

    const classParser = new ClassParser(schema.name, schema.context.getKnownSchemas());
    const props = await classParser.parse(fromDBProps);
    expect(props).toEqual(ecClass.toJSON());
  });

  it("Parse Mixin, appliesTo defined in same schema, parsed correctly", async function () {
    const ecClass = new Mixin(schema, "TestClass") as MutableMixin;
    const entityClass = new EntityClass(schema, "TestEntityClass");
    ecClass.setAppliesTo(new DelayedPromiseWithProps<SchemaItemKey, EntityClass>(entityClass.key, async () => entityClass));

    const fromDBProps = ecClass.toJSON();
    const parser = new MixinParser(schema.name, schema.context.getKnownSchemas());
    const props = await parser.parse(fromDBProps);

    expect(props.customAttributes).toBeUndefined();
    expect(props.appliesTo).toBe("TestSchema.TestEntityClass");
    expect(props).toEqual(ecClass.toJSON());
  });

  it("Parse Mixin, appliesTo defined in reference schema, parsed correctly", async function () {
    const ecClass = new Mixin(schema, "TestClass") as MutableMixin;
    const entityClass = new EntityClass(refSchema, "TestEntityClass");
    ecClass.setAppliesTo(new DelayedPromiseWithProps<SchemaItemKey, EntityClass>(entityClass.key, async () => entityClass));
    const fromDBProps = ecClass.toJSON();

    const parser = new MixinParser(schema.name, schema.context.getKnownSchemas());
    const props = await parser.parse(fromDBProps);

    expect(props.customAttributes).toBeUndefined();
    expect(props.appliesTo).toBe("RefSchema.TestEntityClass");
    expect(props).toEqual(ecClass.toJSON());
  });

  it("Parse Mixin, multiple CustomAttributes, non-IsMixin attributes parsed correctly", async function () {
    const testAttribute: CustomAttributeData = {
      className: "TestSchema.TestAttribute",
      ecClass: "TestAttribute",
      ecSchema: "TestSchema.01.00",
    }

    const ecClass = new Mixin(schema, "TestClass") as MutableMixin;
    const entityClass = new EntityClass(schema, "TestEntityClass");
    (ecClass as ECClass as MutableClass).addCustomAttribute({ className: "TestSchema.TestAttribute" });
    ecClass.setAppliesTo(new DelayedPromiseWithProps<SchemaItemKey, EntityClass>(entityClass.key, async () => entityClass));

    const fromDBProps = ecClass.toJSON();
    (fromDBProps as any).customAttributes = [testAttribute];

    const parser = new MixinParser(schema.name, schema.context.getKnownSchemas());
    const props = await parser.parse(fromDBProps);

    expect(props.customAttributes?.length).toBe(1);
    expect(props.customAttributes![0].className).toBe("TestSchema.TestAttribute");
    expect(props.appliesTo).toBe("TestSchema.TestEntityClass");
    expect(props).toEqual(ecClass.toJSON());
  });

  it("Parse CustomAttribute, appliesTo EntityClass, parsed correctly", async function () {
    const ecClass = new CustomAttributeClass(schema, "TestClass") as MutableCAClass;
    ecClass.setAppliesTo(CustomAttributeContainerType.Schema | CustomAttributeContainerType.AnyClass);
    const fromDBProps = ecClass.toJSON();
    // Coming from database, appliesTo is a number, so force a reset here.
    (fromDBProps as any).appliesTo = CustomAttributeContainerType.Schema | CustomAttributeContainerType.AnyClass;

    const parser = new CustomAttributeClassParser(schema.name, schema.context.getKnownSchemas());
    const props = await parser.parse(fromDBProps);

    expect(props.appliesTo).toBe("Schema, AnyClass");
    expect(props).toEqual(ecClass.toJSON());
  });
});