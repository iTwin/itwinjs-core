/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect, assert } from "chai";
import { KnownTestLocations } from "../KnownTestLocations";
import { ECDbTestHelper } from "./ECDbTestHelper";

describe("ECDb", () => {
  const outDir = KnownTestLocations.outputDir;

  describe("dropSchemas()", () => {
    it("should drop a single schema", () => {
      using ecdb = ECDbTestHelper.createECDb(outDir, "test.ecdb",
        `<ECSchema schemaName="Test" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECEntityClass typeName="Foo" modifier="Sealed">
            <ECProperty propertyName="n" typeName="int"/>
          </ECEntityClass>
        </ECSchema>`);
      assert.isTrue(ecdb.isOpen);
      ecdb.saveChanges();
      const schemaProps = ecdb.getSchemaProps("Test");
      expect(schemaProps.name).to.equal("Test");

      ecdb.dropSchema(["Test"]);
      expect(() => ecdb.getSchemaProps("Test")).to.throw();
    });
  });
});