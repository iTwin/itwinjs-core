/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect, assert } from "chai";
import * as path from "path";
import { IModelJsFs } from "../../IModelJsFs";
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

  it("should drop multiple schemas", () => {
    const testSchema1Xml = `<?xml version="1.0" encoding="utf-8"?>
      <ECSchema schemaName="TestSchema1" alias="ts1" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECEntityClass typeName="TestClass1">
          <ECProperty propertyName="Prop1" typeName="string"/>
        </ECEntityClass>
      </ECSchema>`;

    const testSchema2Xml = `<?xml version="1.0" encoding="utf-8"?>
      <ECSchema schemaName="TestSchema2" alias="ts2" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="TestSchema1" version="01.00.00" alias="ts1"/>
        <ECEntityClass typeName="TestClass2">
          <ECProperty propertyName="Prop2" typeName="string"/>
        </ECEntityClass>
      </ECSchema>`;

    using ecdb = ECDbTestHelper.createECDb(outDir, "drop-multiple-schemas.ecdb");
    assert.isTrue(ecdb.isOpen);

    const schema1Path = path.join(outDir, "TestSchema1.ecschema.xml");
    IModelJsFs.writeFileSync(schema1Path, testSchema1Xml);
    ecdb.importSchema(schema1Path);

    const schema2Path = path.join(outDir, "TestSchema2.ecschema.xml");
    IModelJsFs.writeFileSync(schema2Path, testSchema2Xml);
    ecdb.importSchema(schema2Path);

    ecdb.saveChanges();

    const schema1Props = ecdb.getSchemaProps("TestSchema1");
    expect(schema1Props.name).to.equal("TestSchema1");
    const schema2Props = ecdb.getSchemaProps("TestSchema2");
    expect(schema2Props.name).to.equal("TestSchema2");

    expect(() => ecdb.dropSchema(["TestSchema1"])).to.throw();

    const stillExistsSchema1 = ecdb.getSchemaProps("TestSchema1");
    expect(stillExistsSchema1.name).to.equal("TestSchema1");

    ecdb.dropSchema(["TestSchema2", "TestSchema1"]);

    expect(() => ecdb.getSchemaProps("TestSchema2")).to.throw();
    expect(() => ecdb.getSchemaProps("TestSchema1")).to.throw();

    IModelJsFs.removeSync(schema1Path);
    IModelJsFs.removeSync(schema2Path);
  })
});