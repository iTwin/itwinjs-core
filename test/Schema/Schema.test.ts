/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";

import { ECSchema } from "../../source/Metadata/Schema";
import { ECObjectsError } from "../../source/Exception";

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
