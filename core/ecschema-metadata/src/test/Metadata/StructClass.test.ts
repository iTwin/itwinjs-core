/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { SchemaContext } from "../../Context";
import { StructClass } from "../../Metadata/Class";
import { Schema } from "../../Metadata/Schema";
import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";

/* eslint-disable @typescript-eslint/naming-convention */

describe("StructClass", () => {

  it("should get fullName", async () => {
    const schemaJson = createSchemaJsonWithItems({
      testStruct: {
        schemaItemType: "StructClass",
      },
    });

    const ecSchema = await Schema.fromJson(schemaJson, new SchemaContext());
    assert.isDefined(ecSchema);
    const structClass = await ecSchema.getItem("testStruct", StructClass);
    assert.isDefined(structClass);
    expect(structClass!.fullName).eq("TestSchema.testStruct");
  });

  describe("struct class type safety checks", () => {
    const typeCheckJson = createSchemaJsonWithItems({
      TestStructClass: {
        schemaItemType: "StructClass",
        label: "Test Struct Class",
        description: "Used for testing",
        modifier: "Sealed",
      },
      TestPhenomenon: {
        schemaItemType: "Phenomenon",
        definition: "LENGTH(1)",
      },
    });

    let ecSchema: Schema;

    before(async () => {
      ecSchema = await Schema.fromJson(typeCheckJson, new SchemaContext());
      assert.isDefined(ecSchema);
    });

    it("typeguard and type assertion should work on StructClass", async () => {
      const testStructClass = await ecSchema.getItem("TestStructClass");
      assert.isDefined(testStructClass);
      expect(StructClass.isStructClass(testStructClass)).to.be.true;
      expect(() => StructClass.assertIsStructClass(testStructClass)).not.to.throw();
      // verify against other schema item type
      const testPhenomenon = await ecSchema.getItem("TestPhenomenon");
      assert.isDefined(testPhenomenon);
      expect(StructClass.isStructClass(testPhenomenon)).to.be.false;
      expect(() => StructClass.assertIsStructClass(testPhenomenon)).to.throw();
    });

    it("StructClass type should work with getItem/Sync", async () => {
      expect(await ecSchema.getItem("TestStructClass", StructClass)).to.be.instanceof(StructClass);
      expect(ecSchema.getItemSync("TestStructClass", StructClass)).to.be.instanceof(StructClass);
    });

    it("StructClass type should reject for other item types on getItem/Sync", async () => {
      expect(await ecSchema.getItem("TestPhenomenon", StructClass)).to.be.undefined;
      expect(ecSchema.getItemSync("TestPhenomenon", StructClass)).to.be.undefined;
    });
  });
});
