/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";

import { ECSchema } from "../../source/Metadata/Schema";
// import { ECObjectsError, ECObjectsStatus } from "../../source/Exception";

describe("essential pieces of a schema", () => {
  it("should be able to create a schema with only the essentials", () => {
    const testSchema = new ECSchema("TestSchemaCreation", 10, 99, 15);
    assert.equal(testSchema.name, "TestSchemaCreation");
    assert.equal(testSchema.readVersion, 10);
    assert.equal(testSchema.writeVersion, 99);
    assert.equal(testSchema.minorVersion, 15);
  });

  // it("should fail to create schema with invalid version numbers", () => {
  //   const ecError = new ECObjectsError(ECObjectsStatus.InvalidECVersion);

  //   try {
  //     new ECSchema("NewSchemaWithInvalidReadVersion", 123, 4, 5);
  //     assert.fail();
  //   } catch (err) {
  //     assert.isTrue(err instanceof ECObjectsError);
  //   }

  //   expect(() => {new ECSchema("NewSchemaWithInvalidReadVersion", 123, 4, 5); }).to.throw(ecError);
  //   expect(() => {new ECSchema("NewSchemaWithInvalidWriteVersion", 12, 345, 6); }).to.throw(ECObjectsError, "ECObjectsStatus.InvalidECVersion", "Should throw an Error when write version is too long");
  //   expect(() => {new ECSchema("NewSchemaWithInvalidMinorVersion", 12, 34, 567); }).to.throw(ECObjectsError, "ECObjectsStatus.InvalidECVersion", "Should throw an Error when minor version is too long");
  // });
});
