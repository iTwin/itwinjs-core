/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, describe, expect, it } from "vitest";
import { SchemaContext } from "../../Context";
import { deserializeXml, deserializeXmlSync } from "../TestUtils/DeserializationHelpers";



/**
 * Tests for strict schema validation on SchemaContext.
 * In tolerant mode (default), unknown property types from schemas with a newer EC spec version
 * are silently defaulted to "string". In strict mode, they throw ECSchemaError.
 *
 * Schemas use xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.3" (newer than current 3.2)
 * to trigger the isECSpecVersionNewer() path.
 */
describe("StrictSchemaValidation", () => {

  // Schema XML with a future EC spec version and an unknown property type
  const futureSchemaWithUnknownType = `<?xml version="1.0" encoding="utf-8"?>
    <ECSchema schemaName="TestSchema" alias="ts" version="01.00.00"
      xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.3">
      <ECEntityClass typeName="TestClass">
        <ECProperty propertyName="FutureProp" typeName="FuturePrimitiveType" />
        <ECProperty propertyName="KnownProp" typeName="string" />
      </ECEntityClass>
    </ECSchema>`;

  // Schema XML with current EC spec version and valid types
  const currentSchemaValid = `<?xml version="1.0" encoding="utf-8"?>
    <ECSchema schemaName="TestSchema" alias="ts" version="01.00.00"
      xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECEntityClass typeName="TestClass">
        <ECProperty propertyName="Prop1" typeName="string" />
        <ECProperty propertyName="Prop2" typeName="int" />
      </ECEntityClass>
    </ECSchema>`;

  // Schema XML with current EC spec version but an unknown property type.
  // This should fail regardless of strict mode since the tolerance path
  // is only entered for schemas with version > current (3.2).
  const currentSchemaWithUnknownType = `<?xml version="1.0" encoding="utf-8"?>
    <ECSchema schemaName="TestSchema" alias="ts" version="01.00.00"
      xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECEntityClass typeName="TestClass">
        <ECProperty propertyName="FutureProp" typeName="FuturePrimitiveType" />
        <ECProperty propertyName="KnownProp" typeName="string" />
      </ECEntityClass>
    </ECSchema>`;

  describe("strictSchemaValidation flag", () => {
    it("should default to false", () => {
      const context = new SchemaContext();
      expect(context.strictSchemaValidation).toBe(false);
    });

    it("should be settable and gettable", () => {
      const context = new SchemaContext();
      context.strictSchemaValidation = true;
      expect(context.strictSchemaValidation).toBe(true);
      context.strictSchemaValidation = false;
      expect(context.strictSchemaValidation).toBe(false);
    });
  });

  describe("async deserialization", () => {
    it("tolerant mode defaults unknown property type to string", async () => {
      const context = new SchemaContext();
      assert.isFalse(context.strictSchemaValidation);

      const schema = await deserializeXml(futureSchemaWithUnknownType, context);
      expect(schema).toBeDefined();

      const testClass = await schema.getItem("TestClass");
      expect(testClass).toBeDefined();
    });

    it("strict mode rejects unknown property type from future schema", async () => {
      const context = new SchemaContext();
      context.strictSchemaValidation = true;

      await expect(deserializeXml(futureSchemaWithUnknownType, context))
        .rejects.toThrow(/unknown type.*FuturePrimitiveType.*Strict/i);
    });

    it("strict mode accepts valid current-version schema", async () => {
      const context = new SchemaContext();
      context.strictSchemaValidation = true;

      const schema = await deserializeXml(currentSchemaValid, context);
      expect(schema).toBeDefined();

      const testClass = await schema.getItem("TestClass");
      expect(testClass).toBeDefined();
    });
  });

  describe("sync deserialization", () => {
    it("tolerant mode defaults unknown property type to string", () => {
      const context = new SchemaContext();

      const schema = deserializeXmlSync(futureSchemaWithUnknownType, context);
      expect(schema).toBeDefined();

      const testClass = schema.getItemSync("TestClass");
      expect(testClass).toBeDefined();
    });

    it("strict mode rejects unknown property type from future schema", () => {
      const context = new SchemaContext();
      context.strictSchemaValidation = true;

      expect(() => deserializeXmlSync(futureSchemaWithUnknownType, context))
        .toThrow(/unknown type.*FuturePrimitiveType.*Strict/i);
    });

    it("strict mode accepts valid current-version schema", () => {
      const context = new SchemaContext();
      context.strictSchemaValidation = true;

      const schema = deserializeXmlSync(currentSchemaValid, context);
      expect(schema).toBeDefined();

      const testClass = schema.getItemSync("TestClass");
      expect(testClass).toBeDefined();
    });
  });

  describe("current-version schema with unknown types", () => {
    it("async: rejects unknown type in tolerant mode (no version-based tolerance for 3.2)", async () => {
      const context = new SchemaContext();
      assert.isFalse(context.strictSchemaValidation);

      await expect(deserializeXml(currentSchemaWithUnknownType, context))
        .rejects.toThrow(/FuturePrimitiveType/i);
    });

    it("async: rejects unknown type in strict mode", async () => {
      const context = new SchemaContext();
      context.strictSchemaValidation = true;

      await expect(deserializeXml(currentSchemaWithUnknownType, context))
        .rejects.toThrow(/FuturePrimitiveType/i);
    });

    it("sync: rejects unknown type in tolerant mode (no version-based tolerance for 3.2)", () => {
      const context = new SchemaContext();

      expect(() => deserializeXmlSync(currentSchemaWithUnknownType, context))
        .toThrow(/FuturePrimitiveType/i);
    });

    it("sync: rejects unknown type in strict mode", () => {
      const context = new SchemaContext();
      context.strictSchemaValidation = true;

      expect(() => deserializeXmlSync(currentSchemaWithUnknownType, context))
        .toThrow(/FuturePrimitiveType/i);
    });
  });
});
