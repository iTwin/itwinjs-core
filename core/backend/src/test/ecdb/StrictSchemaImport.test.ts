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

  // Helper to write schema XML and attempt import into a fresh ECDb.
  // Returns the error message on failure so tests can assert on the specific rejection reason.
  function importSchemaXml(testName: string, schemaXml: string): { ecdb: ECDb; succeeded: boolean; error?: string } {
    const ecdb = ECDbTestHelper.createECDb(outDir, `${testName}.ecdb`);

    const schemaPath = path.join(outDir, `${testName}.ecschema.xml`);
    if (IModelJsFs.existsSync(schemaPath))
      IModelJsFs.unlinkSync(schemaPath);
    IModelJsFs.writeFileSync(schemaPath, schemaXml);

    try {
      ecdb.importSchema(schemaPath);
      return { ecdb, succeeded: true };
    } catch (e: unknown) {
      return { ecdb, succeeded: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  // NOTE: All tests using xmlns 3.99.99 hit ECDb's version gate
  // (OriginalECXmlVersion > Latest) before any construct-level validation runs.
  // The ecobjects parser reads tolerantly (strict=false) during initial parse,
  // silently defaulting unknown constructs. Then SchemaWriter rejects the schema
  // purely because of the future version. We assert on the version-gate error
  // message to be transparent about what's actually being tested.
  // These tests remain valuable as regression coverage: if the version gate is
  // ever relaxed, they'll start passing and signal that construct-level strict
  // validation needs its own coverage.

  it("should reject a future-version schema with unknown class modifier", () => {
    const { ecdb, succeeded, error } = importSchemaXml("strictImportModifier", `<?xml version="1.0" encoding="utf-8" ?>
      <ECSchema schemaName="FutureSchema" alias="fs" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.99.99">
        <ECEntityClass typeName="TestClass" modifier="FutureModifier">
          <ECProperty propertyName="Prop1" typeName="string" />
        </ECEntityClass>
      </ECSchema>`);
    ecdb.closeDb();

    assert.isFalse(succeeded, "ECDb should reject a future-version schema with unknown class modifier");
    assert.isDefined(error);
    assert.match(error!, /higher ECXml version/i, "Expected rejection at the version gate, not at the construct level");
  });

  it("should reject a future-version schema with unknown property type", () => {
    const { ecdb, succeeded, error } = importSchemaXml("strictImportPropType", `<?xml version="1.0" encoding="utf-8" ?>
      <ECSchema schemaName="FutureSchema" alias="fs" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.99.99">
        <ECEntityClass typeName="TestClass" modifier="None">
          <ECProperty propertyName="FutureProp" typeName="FuturePrimitiveType" />
        </ECEntityClass>
      </ECSchema>`);
    ecdb.closeDb();

    assert.isFalse(succeeded, "ECDb should reject a future-version schema with unknown property type");
    assert.isDefined(error);
    assert.match(error!, /higher ECXml version/i, "Expected rejection at the version gate, not at the construct level");
  });

  it("should reject a future-version schema with unknown enum backing type", () => {
    const { ecdb, succeeded, error } = importSchemaXml("strictImportEnum", `<?xml version="1.0" encoding="utf-8" ?>
      <ECSchema schemaName="FutureSchema" alias="fs" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.99.99">
        <ECEnumeration typeName="TestEnum" backingTypeName="FutureType" isStrict="true">
          <ECEnumerator name="Val1" value="1" displayLabel="Value One" />
        </ECEnumeration>
      </ECSchema>`);
    ecdb.closeDb();

    assert.isFalse(succeeded, "ECDb should reject a future-version schema with unknown enum backing type");
    assert.isDefined(error);
    assert.match(error!, /higher ECXml version/i, "Expected rejection at the version gate, not at the construct level");
  });

  it("should reject a future-version schema with unknown relationship strength", () => {
    const { ecdb, succeeded, error } = importSchemaXml("strictImportStrength", `<?xml version="1.0" encoding="utf-8" ?>
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
    assert.isDefined(error);
    assert.match(error!, /higher ECXml version/i, "Expected rejection at the version gate, not at the construct level");
  });

  it("should reject a future-version schema even with only known constructs", () => {
    const { ecdb, succeeded, error } = importSchemaXml("strictImportFutureKnown", `<?xml version="1.0" encoding="utf-8" ?>
      <ECSchema schemaName="FutureButValid" alias="fv" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.99.99">
        <ECEntityClass typeName="TestClass" modifier="None">
          <ECProperty propertyName="Prop1" typeName="string" />
        </ECEntityClass>
      </ECSchema>`);
    ecdb.closeDb();

    assert.isFalse(succeeded, "ECDb should reject any schema with future ECXml version");
    assert.isDefined(error);
    assert.match(error!, /higher ECXml version/i, "Expected rejection at the version gate");
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

  // Current-version (3.2) schemas with unknown constructs.
  // For 3.2, OriginalECXmlVersionGreaterThan(Latest) is false, so no tolerance path
  // is entered. Unknown constructs are rejected during XML parse by the ecobjects layer,
  // before SchemaWriter is even reached.

  it("should reject a current-version schema with unknown class modifier", () => {
    const { ecdb, succeeded, error } = importSchemaXml("strictCurrentModifier", `<?xml version="1.0" encoding="utf-8" ?>
      <ECSchema schemaName="BadModifier" alias="bm" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECEntityClass typeName="TestClass" modifier="FutureModifier">
          <ECProperty propertyName="Prop1" typeName="string" />
        </ECEntityClass>
      </ECSchema>`);
    ecdb.closeDb();

    assert.isFalse(succeeded, "Should reject unknown modifier in a 3.2 schema");
    assert.isDefined(error);
    assert.match(error!, /invalid modifier|FutureModifier/i, "Expected construct-level rejection for unknown modifier");
  });

  it("should reject a current-version schema with unknown property type", () => {
    const { ecdb, succeeded, error } = importSchemaXml("strictCurrentPropType", `<?xml version="1.0" encoding="utf-8" ?>
      <ECSchema schemaName="BadPropType" alias="bp" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECEntityClass typeName="TestClass" modifier="None">
          <ECProperty propertyName="FutureProp" typeName="FuturePrimitiveType" />
        </ECEntityClass>
      </ECSchema>`);
    ecdb.closeDb();

    assert.isFalse(succeeded, "Should reject unknown property type in a 3.2 schema");
    assert.isDefined(error);
    assert.match(error!, /FuturePrimitiveType/i, "Expected construct-level rejection for unknown property type");
  });

  it("should reject a current-version schema with unknown enum backing type", () => {
    const { ecdb, succeeded, error } = importSchemaXml("strictCurrentEnum", `<?xml version="1.0" encoding="utf-8" ?>
      <ECSchema schemaName="BadEnum" alias="be" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECEnumeration typeName="TestEnum" backingTypeName="FutureType" isStrict="true">
          <ECEnumerator name="Val1" value="1" displayLabel="Value One" />
        </ECEnumeration>
      </ECSchema>`);
    ecdb.closeDb();

    assert.isFalse(succeeded, "Should reject unknown enum backing type in a 3.2 schema");
    assert.isDefined(error);
    assert.match(error!, /FutureType|invalid.*type/i, "Expected construct-level rejection for unknown enum backing type");
  });

  it("should reject a current-version schema with unknown relationship strength", () => {
    const { ecdb, succeeded, error } = importSchemaXml("strictCurrentStrength", `<?xml version="1.0" encoding="utf-8" ?>
      <ECSchema schemaName="BadStrength" alias="bs" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
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

    assert.isFalse(succeeded, "Should reject unknown relationship strength in a 3.2 schema");
    assert.isDefined(error);
  });
});
