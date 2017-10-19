/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";

import { ECSchema } from "../../source/Metadata/Schema";
import { Class, EntityClass, MixinClass, StructClass } from "../../source/Metadata/Class";
import { ECObjectsError } from "../../source/Exception";

describe("schema api test", () => {
describe("essential pieces of a schema", () => {
  it("should be able to create a schema with only the essentials", () => {
    const testSchema = new ECSchema("TestSchemaCreation", 10, 99, 15);
    assert.equal(testSchema.name, "TestSchemaCreation");
    assert.equal(testSchema.readVersion, 10);
    assert.equal(testSchema.writeVersion, 99);
    assert.equal(testSchema.minorVersion, 15);
  });

  it("setting properties", () => {
    const testSchema = new ECSchema("TestSchema", 1, 0, 2);
    testSchema.alias = "ts";
    assert.isDefined(testSchema.alias);
    assert.equal(testSchema.alias, "ts");

    testSchema.description = "Test setting a description";
    assert.isDefined(testSchema.description);
    assert.equal(testSchema.description, "Test setting a description");
  });

  it("should fail to create schema with invalid version numbers", () => {
    expect(() => {new ECSchema("NewSchemaWithInvalidReadVersion", 123, 4, 5); }).to.throw(ECObjectsError);
    expect(() => {new ECSchema("NewSchemaWithInvalidWriteVersion", 12, 345, 6); }).to.throw(ECObjectsError);
    expect(() => {new ECSchema("NewSchemaWithInvalidMinorVersion", 12, 34, 567); }).to.throw(ECObjectsError);
  });

  it("should throw when attempting to change the version to an invalid version", () => {
    const testSchema = new ECSchema("TestSchema", 1, 1, 1);
    expect(() => {testSchema.readVersion = 123; }).to.throw(ECObjectsError);
    expect(testSchema.readVersion).equal(1);
    expect(() => {testSchema.writeVersion = 123; }).to.throw(ECObjectsError);
    expect(testSchema.writeVersion).equal(1);
    expect(() => {testSchema.minorVersion = 123; }).to.throw(ECObjectsError);
    expect(testSchema.minorVersion).equal(1);
  });
});

describe("class", () => {
  it("should succeed for entity class", () => {
    const testSchema = new ECSchema("TestSchema", 1, 1, 1);
    testSchema.createEntityClass("TestEntity");

    expect(testSchema.getClass("TestEntity")).instanceof(Class);
    expect(testSchema.getClass<EntityClass>("TestEntity")).instanceof(EntityClass);
  });

  it("should succeed for mixin class", () => {
    const testSchema = new ECSchema("TestSchema", 1, 2, 3);
    testSchema.createMixinClass("TestMixin");

    expect(testSchema.getClass("TestMixin")).instanceof(Class);
    expect(testSchema.getClass<MixinClass>("TestMixin")).instanceof(MixinClass);
  });

  it("should succeed for struct class", () => {
    const testSchema = new ECSchema("TestSchema", 1, 2, 3);
    testSchema.createStructClass("TestStruct");

    expect(testSchema.getClass("TestStruct")).instanceof(Class);
    expect(testSchema.getClass<StructClass>("TestStruct")).instanceof(StructClass);
  });

  it("should succeed with case-insentive search", () => {
    const testSchema = new ECSchema("TestSchema", 1, 0, 0);
    testSchema.createEntityClass("testEntity");

    expect(testSchema.getClass("TESTENTITY")).not.undefined;
    expect(testSchema.getClass("TestEntity")).not.undefined;
    expect(testSchema.getClass("testEntity")).not.undefined;
  });
});

}); // Schema tests
