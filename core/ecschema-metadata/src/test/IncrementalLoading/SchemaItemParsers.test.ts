/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { beforeEach, describe, expect, it } from "vitest";
import { SchemaContext } from "../../Context";
import { KindOfQuantityParser, SchemaItemParser } from "../../IncrementalLoading/SchemaItemParsers";
import { KindOfQuantity, MutableKindOfQuantity } from "../../Metadata/KindOfQuantity";
import { MutableSchema, Schema } from "../../Metadata/Schema";
import { SchemaKey } from "../../SchemaKey";
import { TestSchemaLocater } from "./FormatTestHelper";
import { UnitSystem } from "../../Metadata/UnitSystem";

describe("SchemaItemParsers Tests", function () {
  let schema: MutableSchema;
  let formatsSchema: Schema;

  beforeEach(async () => {
    const context = new SchemaContext();
    context.addLocater(new TestSchemaLocater());
    schema = new Schema(context, "TestSchema", "ts", 1, 0, 0) as MutableSchema;
    const refSchema = context.getSchemaSync(new SchemaKey("formats", 1, 0, 0));
    if (!refSchema)
      throw new Error("Could not load formats schema");
    formatsSchema = refSchema;
    await schema.addReference(formatsSchema);
    await context.addSchema(schema);

  })

  describe("SchemaItemParser Tests", function () {
    it("Parse SchemaItem, props parsed correctly", async function () {
      const item = new UnitSystem(schema, "TestUnitSystem");
      const fromDBProps = item.toJSON();
      const parser = new SchemaItemParser(schema.name, schema.context.getKnownSchemas());
      const props = await parser.parse(fromDBProps);
      expect(props).toEqual(item.toJSON());
    });

    it("getQualifiedTypeName, no alias, fullname resolved", async function () {
      const parser = new SchemaItemParser(schema.name, schema.context.getKnownSchemas());
      const name = parser.getQualifiedTypeName("TestSchemaItem");
      expect(name).toEqual("TestSchema.TestSchemaItem");
    });

    it("getQualifiedTypeName, with alias, fullname resolved", async function () {
      const parser = new SchemaItemParser(schema.name, schema.context.getKnownSchemas());
      const name = parser.getQualifiedTypeName("ts:TestSchemaItem");
      expect(name).toEqual("TestSchema.TestSchemaItem");
    });

    it("getQualifiedTypeName, with bad alias, throws", async function () {
      const parser = new SchemaItemParser(schema.name, schema.context.getKnownSchemas());
      expect(() => parser.getQualifiedTypeName("bad:TestSchemaItem")).to.throw(Error, "No valid schema found for alias 'bad'");
    });
  });

  describe("KindOfQuantityParser Tests", function () {
    const baseJson = {
      schemaItemType: "KindOfQuantity",
      name: "TestKindOfQuantity",
      label: "SomeDisplayLabel",
      description: "A really long description...",
    };

    it("Parse KOQ, units in different schema, props parsed correctly", async function () {
      const koqJson = {
        ...baseJson,
        relativeError: 4,
        persistenceUnit: "Formats.YRD",
        presentationUnits: [
          "Formats.DoubleUnitFormat(6)[Formats.YRD|yard(s)][Formats.FT|feet]",
        ],
      };

      const item = new KindOfQuantity(schema, "TestKindOfQuantity") as MutableKindOfQuantity;
      await item.fromJSON(koqJson);
      const fromDBProps = item.toJSON();

      // Coming from database, units have an XML typed name (alias:name) so force a reset here
      (fromDBProps as any).persistenceUnit = "f:YRD";
      (fromDBProps as any).presentationUnits = ["f:DoubleUnitFormat(6)[f:YRD|yard(s)][f:FT|feet]"];

      const parser = new KindOfQuantityParser(schema.name, schema.context.getKnownSchemas());
      const props = await parser.parse(fromDBProps);
      expect(props).toEqual(item.toJSON());
    });

    it("Parse KOQ, units in same schema, props parsed correctly", async function () {
      const koqJson = {
        ...baseJson,
        relativeError: 4,
        persistenceUnit: "Formats.YRD",
        presentationUnits: [
          "Formats.DoubleUnitFormat(6)[Formats.YRD|yard(s)][Formats.FT|feet]",
        ],
      };

      const item = new KindOfQuantity(formatsSchema, "TestKindOfQuantity") as MutableKindOfQuantity;
      await item.fromJSON(koqJson);
      const fromDBProps = item.toJSON();

      // Coming from database, units have an XML typed name (alias:name) so force a reset here
      // Notice the types are not aliased
      (fromDBProps as any).persistenceUnit = "YRD";
      (fromDBProps as any).presentationUnits = ["DoubleUnitFormat(6)[YRD|yard(s)][FT|feet]"];

      const parser = new KindOfQuantityParser(formatsSchema.name, schema.context.getKnownSchemas());
      const props = await parser.parse(fromDBProps);
      expect(props).toEqual(item.toJSON());
    });
  });
});
