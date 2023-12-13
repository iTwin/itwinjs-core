/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { convertEC2SchemasToEC3Schemas, ECDb, ECSqlStatement, upgradeCustomAttributesToEC3 } from "../core-backend";
import { KnownTestLocations } from "./KnownTestLocations";
import { ECDbTestHelper } from "./ecdb/ECDbTestHelper";
import { DbResult } from "@itwin/core-bentley";

describe("convertEC2Schemas", () => {
  it("verify namespace", () => {
    const ec2SchemaXml = `<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="TestSchema" version="1.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.2.0">
        <ECSchemaReference name="RefSchema" version="01.00" prefix="rs" />
        <ECClass typeName="TestEntityClass" isDomainClass="true" />
      </ECSchema>`;

    const ec2RefSchema = `<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="RefSchema" nameSpacePrefix="rs" version="1.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.2.0">
        <ECClass typeName="TestStructClass" isStruct="true" />
      </ECSchema>`;

    const ec3Schemas: string[] = convertEC2SchemasToEC3Schemas([ec2SchemaXml, ec2RefSchema]);
    assert.equal(ec3Schemas.length, 2);
    // converted EC3 schemas are in the same order as of input schemas
    const ec3SchemaXml = ec3Schemas[0];
    const ec3RefSchema = ec3Schemas[1];

    assert.isTrue(ec3SchemaXml.includes("http://www.bentley.com/schemas/Bentley.ECXML.3.2"));
    assert.isTrue(ec3RefSchema.includes("http://www.bentley.com/schemas/Bentley.ECXML.3.2"));
  });

  it("rename reserved words", async () => {
    const ec2SchemaXml = `<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="TestSchema" version="1.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.2.0">
        <ECClass typeName="TestEntityClass" isDomainClass="true">
          <ECProperty propertyName="Id" typeName="string" />
          <ECProperty propertyName="ECInstanceId" typeName="string" />
          <ECProperty propertyName="ECClassId" typeName="string" />
          <ECProperty propertyName="SourceECInstanceId" typeName="string" />
          <ECProperty propertyName="SourceId" typeName="string" />
          <ECProperty propertyName="SourceECClassId" typeName="string" />
          <ECProperty propertyName="TargetECInstanceId" typeName="string" />
          <ECProperty propertyName="TargetId" typeName="string" />
          <ECProperty propertyName="TargetECClassId" typeName="string" />
        </ECClass>
        <ECClass typeName="TestStructClass" isStruct="true">
          <ECProperty propertyName="Id" typeName="string" />
          <ECProperty propertyName="ECInstanceId" typeName="string" />
          <ECProperty propertyName="ECClassId" typeName="string" />
        </ECClass>
      </ECSchema>`;

    const ec3Schemas: string[] = convertEC2SchemasToEC3Schemas([ec2SchemaXml]);
    assert.equal(ec3Schemas.length, 1);
    const schemasWithUpdatedCA: string[] = upgradeCustomAttributesToEC3(ec3Schemas);
    assert.equal(schemasWithUpdatedCA.length, 1);

    const outDir = KnownTestLocations.outputDir;
    const db: ECDb = ECDbTestHelper.createECDb(outDir, "RenameReservedWords.ecdb", schemasWithUpdatedCA[0]);
    assert.isTrue(db !== undefined);
    assert.isTrue(db.isOpen);

    const propNamesInEntityClass = [];
    let stmt: ECSqlStatement = db.prepareStatement("SELECT p.Name FROM meta.ECPropertyDef p JOIN meta.ECClassDef c USING meta.ClassOwnsLocalProperties JOIN meta.ECSchemaDef s USING meta.SchemaOwnsClasses WHERE s.Name='TestSchema' AND c.Name='TestEntityClass' ORDER BY p.Ordinal");
    let rowCount = 0;
    while (stmt.step() === DbResult.BE_SQLITE_ROW) {
      rowCount++;
      const row = stmt.getRow();
      propNamesInEntityClass.push(row.name);
    }
    stmt.dispose();
    assert.equal(rowCount, 9);

    assert.isFalse(propNamesInEntityClass.includes("Id"));  // The Id property is a reserved keyword and should have been renamed
    assert.isFalse(propNamesInEntityClass.includes("ECClassId")); // The ECClassId property is a reserved keyword and should have been renamed
    assert.isFalse(propNamesInEntityClass.includes("ECInstanceId"));  // The ECInstanceId property is a reserved keyword and should have been renamed
    assert.isTrue(propNamesInEntityClass.includes("TestSchema_Id_")); // The Id property is a reserved keyword and should have been renamed
    assert.isTrue(propNamesInEntityClass.includes("TestSchema_ECClassId_"));  // The ECClassId property is a reserved keyword and should have been renamed
    assert.isTrue(propNamesInEntityClass.includes("TestSchema_ECInstanceId_")); // The ECInstanceId property is a reserved keyword and should have been renamed
    assert.isTrue(propNamesInEntityClass.includes("SourceECInstanceId")); // The SourceECInstanceId property is allowed on Entity classes and should not be renamed
    assert.isTrue(propNamesInEntityClass.includes("SourceId")); // The SourceId property is allowed on Entity classes and should not be renamed
    assert.isTrue(propNamesInEntityClass.includes("SourceECClassId"));  // The SourceECClassId property is allowed on Entity classes and should not be renamed
    assert.isTrue(propNamesInEntityClass.includes("TargetECInstanceId")); // The TargetECInstanceId property is allowed on Entity classes and should not be renamed
    assert.isTrue(propNamesInEntityClass.includes("TargetId")); // The TargetId property is allowed on Entity classes and should not be renamed
    assert.isTrue(propNamesInEntityClass.includes("TargetECClassId"));  // The TargetECClassId property is allowed on Entity classes and should not be renamed

    const propNamesInStructClass = [];
    stmt = db.prepareStatement("SELECT p.Name FROM meta.ECPropertyDef p JOIN meta.ECClassDef c USING meta.ClassOwnsLocalProperties JOIN meta.ECSchemaDef s USING meta.SchemaOwnsClasses WHERE s.Name='TestSchema' AND c.Name='TestStructClass' ORDER BY p.Ordinal");
    rowCount = 0;
    while (stmt.step() === DbResult.BE_SQLITE_ROW) {
      rowCount++;
      const row = stmt.getRow();
      propNamesInStructClass.push(row.name);
    }
    stmt.dispose();
    assert.equal(rowCount, 3);

    assert.isTrue(propNamesInStructClass.includes("Id")); // The Id property is not a reserved keyword for Struct classes and should not be renamed
    assert.isTrue(propNamesInStructClass.includes("ECClassId"));  // The ECClassId property is not a reserved keyword for Struct classes and should not be renamed
    assert.isTrue(propNamesInStructClass.includes("ECInstanceId")); // The ECInstanceId property is not a reserved keyword for Struct classes and should not be renamed
    assert.isFalse(propNamesInStructClass.includes("TestSchema_Id_"));  // The Id property is not a reserved keyword for Struct classes and should not be renamed
    assert.isFalse(propNamesInStructClass.includes("TestSchema_ECClassId_")); // The ECClassId property is not a reserved keyword for Struct classes and should not be renamed
    assert.isFalse(propNamesInStructClass.includes("TestSchema_ECInstanceId_"));  // The ECInstanceId property is not a reserved keyword for Struct classes and should not be renamed
  });
});
