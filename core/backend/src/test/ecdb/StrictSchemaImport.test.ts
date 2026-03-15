/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { IModelJsFs } from "../../IModelJsFs";
import { ECDb } from "../../core-backend";
import { KnownTestLocations } from "../KnownTestLocations";
import { ECDbTestHelper } from "./ECDbTestHelper";

describe("StrictSchemaImport", () => {
  const outDir = KnownTestLocations.outputDir;

  // Helper to write schema XML and attempt import into a fresh ECDb
  function importSchemaXml(testName: string, schemaXml: string): { ecdb: ECDb; succeeded: boolean } {
    const ecdb = ECDbTestHelper.createECDb(outDir, `${testName}.ecdb`);

    const schemaPath = path.join(outDir, `${testName}.ecschema.xml`);
    if (IModelJsFs.existsSync(schemaPath))
      IModelJsFs.unlinkSync(schemaPath);
    IModelJsFs.writeFileSync(schemaPath, schemaXml);

    try {
      ecdb.importSchema(schemaPath);
      return { ecdb, succeeded: true };
    } catch {
      return { ecdb, succeeded: false };
    }
  }

  it("should reject a future-version schema with unknown class modifier", () => {
    const { ecdb, succeeded } = importSchemaXml("strictImportModifier", `<?xml version="1.0" encoding="utf-8" ?>
      <ECSchema schemaName="FutureSchema" alias="fs" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.99.99">
        <ECEntityClass typeName="TestClass" modifier="FutureModifier">
          <ECProperty propertyName="Prop1" typeName="string" />
        </ECEntityClass>
      </ECSchema>`);
    ecdb.closeDb();

    assert.isFalse(succeeded, "ECDb should reject a future-version schema with unknown class modifier");
  });

  it("should reject a future-version schema with unknown property type", () => {
    const { ecdb, succeeded } = importSchemaXml("strictImportPropType", `<?xml version="1.0" encoding="utf-8" ?>
      <ECSchema schemaName="FutureSchema" alias="fs" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.99.99">
        <ECEntityClass typeName="TestClass" modifier="None">
          <ECProperty propertyName="FutureProp" typeName="FuturePrimitiveType" />
        </ECEntityClass>
      </ECSchema>`);
    ecdb.closeDb();

    assert.isFalse(succeeded, "ECDb should reject a future-version schema with unknown property type");
  });

  it("should reject a future-version schema with unknown enum backing type", () => {
    const { ecdb, succeeded } = importSchemaXml("strictImportEnum", `<?xml version="1.0" encoding="utf-8" ?>
      <ECSchema schemaName="FutureSchema" alias="fs" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.99.99">
        <ECEnumeration typeName="TestEnum" backingTypeName="FutureType" isStrict="true">
          <ECEnumerator name="Val1" value="1" displayLabel="Value One" />
        </ECEnumeration>
      </ECSchema>`);
    ecdb.closeDb();

    assert.isFalse(succeeded, "ECDb should reject a future-version schema with unknown enum backing type");
  });

  it("should reject a future-version schema with unknown relationship strength", () => {
    const { ecdb, succeeded } = importSchemaXml("strictImportStrength", `<?xml version="1.0" encoding="utf-8" ?>
      <ECSchema schemaName="FutureSchema" alias="fs" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.99.99">
        <ECEntityClass typeName="SourceClass" modifier="None">
          <ECProperty propertyName="Prop1" typeName="string" />
        </ECEntityClass>
        <ECEntityClass typeName="TargetClass" modifier="None">
          <ECProperty propertyName="Prop1" typeName="string" />
        </ECEntityClass>
        <ECRelationshipClass typeName="TestRel" strength="FutureStrength" strengthDirection="Forward" modifier="None">
          <Source multiplicity="(0..*)" roleLabel="source" polymorphic="true">
            <Class class="SourceClass" />
          </Source>
          <Target multiplicity="(0..*)" roleLabel="target" polymorphic="true">
            <Class class="TargetClass" />
          </Target>
        </ECRelationshipClass>
      </ECSchema>`);
    ecdb.closeDb();

    assert.isFalse(succeeded, "ECDb should reject a future-version schema with unknown relationship strength");
  });

  it("should reject a future-version schema even with only known constructs", () => {
    const { ecdb, succeeded } = importSchemaXml("strictImportFutureKnown", `<?xml version="1.0" encoding="utf-8" ?>
      <ECSchema schemaName="FutureButValid" alias="fv" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.99.99">
        <ECEntityClass typeName="TestClass" modifier="None">
          <ECProperty propertyName="Prop1" typeName="string" />
        </ECEntityClass>
      </ECSchema>`);
    ecdb.closeDb();

    // ECDb has a version check that rejects OriginalECXmlVersion > Latest
    assert.isFalse(succeeded, "ECDb should reject any schema with future ECXml version");
  });

  it("should accept a valid current-version schema", () => {
    const { ecdb, succeeded } = importSchemaXml("strictImportValid", `<?xml version="1.0" encoding="utf-8" ?>
      <ECSchema schemaName="ValidSchema" alias="vs" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECEntityClass typeName="TestClass" modifier="None">
          <ECProperty propertyName="Prop1" typeName="string" />
          <ECProperty propertyName="Prop2" typeName="int" />
        </ECEntityClass>
      </ECSchema>`);
    ecdb.closeDb();

    assert.isTrue(succeeded, "A valid current-version schema should import successfully");
  });
});
