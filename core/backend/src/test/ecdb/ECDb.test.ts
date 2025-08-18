/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as path from "path";
import { ECDb } from "../../core-backend";
import { IModelError } from "@itwin/core-common";
import { Guid } from "@itwin/core-bentley";
import { KnownTestLocations } from "../KnownTestLocations";
import { ECDbTestHelper } from "./ECDbTestHelper";
import { IModelJsFs } from "../../IModelJsFs";

describe("ECDb", () => {
  const outDir = KnownTestLocations.outputDir;

  describe("dropSchemas()", () => {
    it("should drop a single schema", () => {
      const schemaXml = `<?xml version="1.0" encoding="utf-8"?>
        <ECSchema schemaName="TestSchema" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
          <ECEntityClass typeName="TestClass">
            <ECProperty propertyName="TestProperty" typeName="string"/>
          </ECEntityClass>
        </ECSchema>`;

      using ecdb = ECDbTestHelper.createECDb(outDir, "dropSingleSchema.ecdb", schemaXml);
      const schemaProps = ecdb.getSchemaProps("TestSchema");
      expect(schemaProps.name).to.equal("TestSchema");

      ecdb.dropSchemas(["TestSchema"]);

      expect(() => ecdb.getSchemaProps("TestSchema")).to.throw();
    });

    it("should drop multiple schemas", () => {
      const schema1Xml = `<?xml version="1.0" encoding="utf-8"?>
        <ECSchema schemaName="Schema1" alias="s1" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
          <ECEntityClass typeName="Class1">
            <ECProperty propertyName="Property1" typeName="string"/>
          </ECEntityClass>
        </ECSchema>`;

      const schema2Xml = `<?xml version="1.0" encoding="utf-8"?>
        <ECSchema schemaName="Schema2" alias="s2" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
          <ECEntityClass typeName="Class2">
            <ECProperty propertyName="Property2" typeName="int"/>
          </ECEntityClass>
        </ECSchema>`;

      using ecdb = ECDbTestHelper.createECDb(outDir, "dropMultipleSchemas.ecdb");

      const schema1Path = path.join(outDir, `${Guid.createValue()}.ecschema.xml`);
      const schema2Path = path.join(outDir, `${Guid.createValue()}.ecschema.xml`);
      IModelJsFs.writeFileSync(schema1Path, schema1Xml);
      IModelJsFs.writeFileSync(schema2Path, schema2Xml);

      ecdb.importSchema(schema1Path);
      ecdb.importSchema(schema2Path);

      expect(ecdb.getSchemaProps("Schema1").name).to.equal("Schema1");
      expect(ecdb.getSchemaProps("Schema2").name).to.equal("Schema2");

      ecdb.dropSchemas(["Schema1", "Schema2"]);

      expect(() => ecdb.getSchemaProps("Schema1")).to.throw();
      expect(() => ecdb.getSchemaProps("Schema2")).to.throw();

      IModelJsFs.unlinkSync(schema1Path);
      IModelJsFs.unlinkSync(schema2Path);
    });

    it("should handle empty schema array gracefully", () => {
      using ecdb = ECDbTestHelper.createECDb(outDir, "dropEmptyArray.ecdb");

      expect(() => ecdb.dropSchemas([])).to.not.throw();
    });

    it("should throw error when dropping non-existent schema", () => {
      using ecdb = ECDbTestHelper.createECDb(outDir, "dropNonExistent.ecdb");

      expect(() => ecdb.dropSchemas(["NonExistentSchema"])).to.throw(IModelError);
    });

    it("should handle schema with dependencies", () => {
      const refSchemaXml = `<?xml version="1.0" encoding="utf-8"?>
        <ECSchema schemaName="RefSchema" alias="ref" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
          <ECEntityClass typeName="BaseClass">
            <ECProperty propertyName="BaseProperty" typeName="string"/>
          </ECEntityClass>
        </ECSchema>`;

      const dependentSchemaXml = `<?xml version="1.0" encoding="utf-8"?>
        <ECSchema schemaName="DependentSchema" alias="dep" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
          <ECSchemaReference name="RefSchema" version="01.00.00" alias="ref"/>
          <ECEntityClass typeName="DerivedClass">
            <BaseClass>ref:BaseClass</BaseClass>
            <ECProperty propertyName="DerivedProperty" typeName="int"/>
          </ECEntityClass>
        </ECSchema>`;

      using ecdb = ECDbTestHelper.createECDb(outDir, "dropWithDependencies.ecdb");

      const refSchemaPath = path.join(outDir, `${Guid.createValue()}.ecschema.xml`);
      const dependentSchemaPath = path.join(outDir, `${Guid.createValue()}.ecschema.xml`);
      IModelJsFs.writeFileSync(refSchemaPath, refSchemaXml);
      IModelJsFs.writeFileSync(dependentSchemaPath, dependentSchemaXml);

      ecdb.importSchema(refSchemaPath);
      ecdb.importSchema(dependentSchemaPath);

      expect(ecdb.getSchemaProps("RefSchema").name).to.equal("RefSchema");
      expect(ecdb.getSchemaProps("DependentSchema").name).to.equal("DependentSchema");
      ecdb.dropSchemas(["DependentSchema"]);
      expect(() => ecdb.getSchemaProps("DependentSchema")).to.throw();
      expect(ecdb.getSchemaProps("RefSchema").name).to.equal("RefSchema");

      ecdb.dropSchemas(["RefSchema"]);
      expect(() => ecdb.getSchemaProps("RefSchema")).to.throw();

      IModelJsFs.unlinkSync(refSchemaPath);
      IModelJsFs.unlinkSync(dependentSchemaPath);
    });

    it("should throw error when ECDb is not open", () => {
      const ecdb = new ECDb();

      expect(() => ecdb.dropSchemas(["TestSchema"])).to.throw(IModelError);
    });
  });
});