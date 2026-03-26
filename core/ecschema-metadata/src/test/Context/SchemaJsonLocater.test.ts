/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { SchemaJsonLocater } from "../../SchemaJsonLocater";
import { SchemaMatchType } from "../../ECObjects";
import { SchemaContext } from "../../Context";
import { SchemaKey } from "../../SchemaKey";
import { ECSchemaNamespaceUris, Schema, SchemaProps } from "../../ecschema-metadata";

describe("SchemaJsonLocater", () => {

  const schemaProps: SchemaProps = {
    $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
    alias: "a",
    description: "This is a test Schema.",
    label: "SchemaA",
    name: "SchemaA",
    version: "01.00.04",
  };

  describe("getSchema", () => {
    it("should return undefined if schemaPropGetter fails", async () => {
      const schemaLocater = new SchemaJsonLocater(() => { throw new Error("something went wrong") });
      const testKey = new SchemaKey("TestSchema", 1, 0, 0);
      await expect(schemaLocater.getSchema(testKey, SchemaMatchType.Latest, new SchemaContext())).resolves.toBeUndefined();
    });

    it("should return undefined if schemaPropGetter returns undefined", async () => {
      const schemaLocater = new SchemaJsonLocater(() => undefined);
      const testKey = new SchemaKey("TestSchema", 1, 0, 0);
      await expect(schemaLocater.getSchema(testKey, SchemaMatchType.Latest, new SchemaContext())).resolves.toBeUndefined();
    });

    it("should return the schema if schemaPropGetter returns props", async () => {
      const schemaLocater = new SchemaJsonLocater(() => schemaProps);
      const testKey = new SchemaKey("SchemaA", 1, 0, 4);
      await expect( schemaLocater.getSchema(testKey, SchemaMatchType.Latest, new SchemaContext())).resolves.toSatisfy((schema: Schema) => {
        expect(schema).toBeInstanceOf(Schema);
        expect(schema.schemaKey.toString()).equals("SchemaA.01.00.04");
        expect(schema).has.property("label", "SchemaA");
        expect(schema).has.property("description", "This is a test Schema.");
        return true;
      });
    });
  });

  describe("getSchemaSync", () => {
    it("should return undefined if schemaPropGetter fails", async () => {
      const schemaLocater = new SchemaJsonLocater(() => { throw new Error("something went wrong") });
      const testKey = new SchemaKey("TestSchema", 1, 0, 0);
      expect(schemaLocater.getSchemaSync(testKey, SchemaMatchType.Latest, new SchemaContext())).toBeUndefined();
    });

    it("should return undefined if schemaPropGetter returns undefined", async () => {
      const schemaLocater = new SchemaJsonLocater(() => undefined);
      const testKey = new SchemaKey("TestSchema", 1, 0, 0);
      expect(schemaLocater.getSchemaSync(testKey, SchemaMatchType.Latest, new SchemaContext())).toBeUndefined();
    });

    it("should return the schema if schemaPropGetter returns props", async () => {
      const schemaLocater = new SchemaJsonLocater(() => schemaProps);
      const testKey = new SchemaKey("SchemaA", 1, 0, 4);
      expect(schemaLocater.getSchemaSync(testKey, SchemaMatchType.Latest, new SchemaContext())).toSatisfy((schema: Schema) => {
        expect(schema).toBeInstanceOf(Schema);
        expect(schema.schemaKey.toString()).equals("SchemaA.01.00.04");
        expect(schema).has.property("label", "SchemaA");
        expect(schema).has.property("description", "This is a test Schema.");
        return true;
      });
    });
  });

});