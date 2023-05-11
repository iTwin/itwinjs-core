/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as fs from "fs";
import * as path from "path";
import { ECDb, IModelJsFs, PhysicalElement, SnapshotDb, StandaloneDb } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { DbResult, Logger, LogLevel } from "@itwin/core-bentley";
import { KnownTestLocations } from "../KnownTestLocations";

describe("Schema XML Import Tests", () => {
  let imodel: SnapshotDb;

  before(() => {
    // initialize logging
    if (false) {
      Logger.initializeToConsole();
      Logger.setLevelDefault(LogLevel.Error);
    }
    const testFileName = IModelTestUtils.prepareOutputFile("SchemaXMLImport", "SchemaXMLImport.bim");
    imodel = SnapshotDb.createEmpty(testFileName, { rootSubject: { name: "SchemaXMLImportTest" } }); // IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
    assert.exists(imodel);
  });

  after(() => {
    if (imodel)
      imodel.close();
  });

  it("should import schema XML", async () => {
    const schemaFilePath = path.join(KnownTestLocations.assetsDir, "Test3.ecschema.xml");
    const schemaString = fs.readFileSync(schemaFilePath, "utf8");

    await imodel.importSchemaStrings([schemaString]); // will throw an exception if import fails

    const testDomainClass = imodel.getMetaData("Test3:Test3Element"); // will throw on failure

    assert.equal(testDomainClass.baseClasses.length, 1);
    assert.equal(testDomainClass.baseClasses[0], PhysicalElement.classFullName);
  });

  it("schema shared channel", async () => {
    const seedFileName = IModelTestUtils.prepareOutputFile("sharedSchemaChannel", "sharedSchemaChannel.bim");
    const seedDb = StandaloneDb.createEmpty(seedFileName, { rootSubject: { name: "sharedSchemaChannelTest" } });

    const getCheckSum = (db: StandaloneDb | ECDb, type: "ecdb_schema" | "ecdb_map" | "sqlite_schema") => {
      return db.withStatement(`PRAGMA checksum(${type})`, (stmt) => {
        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step());
        const val = stmt.getValue(0).getString();
        assert.isNotEmpty(val);
        stmt.dispose();
        return val;
      });
    };

    const getSchemaHashes = (db: StandaloneDb) => {
      return {
        eCDbSchema: getCheckSum(db, "ecdb_schema"),
        eCDbMap: getCheckSum(db, "ecdb_map"),
        sQLiteSchema: getCheckSum(db, "sqlite_schema"),
      };
    };

    // create empty channel db.
    const channelUri = IModelTestUtils.prepareOutputFile("channel", "channel.ecdb");
    const channelDb = new ECDb();
    channelDb.createDb(channelUri);
    channelDb.saveChanges();
    channelDb.closeDb();

    // initialize shared channel.
    seedDb.sharedChannelInit(channelUri);
    seedDb.performCheckpoint();
    seedDb.close();

    // create first briefcase
    const b0Uri = path.join(path.dirname(seedFileName), "b0.bim");
    IModelJsFs.copySync(seedFileName, b0Uri);
    const b0 = StandaloneDb.openFile(b0Uri);

    // create second briefcase
    const b1Uri = path.join(path.dirname(seedFileName), "b1.bim");
    IModelJsFs.copySync(seedFileName, b1Uri);
    const b1 = StandaloneDb.openFile(b1Uri);

    // create third briefcase
    const b2Uri = path.join(path.dirname(seedFileName), "b2.bim");
    IModelJsFs.copySync(seedFileName, b2Uri);
    const b2 = StandaloneDb.openFile(b2Uri);

    // import schema in briefcase 1
    const schema1 = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestSchema1" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
        <ECEntityClass typeName="Pipe1">
            <BaseClass>bis:GeometricElement2d</BaseClass>
            <ECProperty propertyName="p1" typeName="int" />
            <ECProperty propertyName="p2" typeName="int" />
        </ECEntityClass>
    </ECSchema>`;
    await b0.importSchemaStrings([schema1], channelUri);

    const schema2 = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestSchema1" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
        <ECEntityClass typeName="Pipe1">
          <BaseClass>bis:GeometricElement2d</BaseClass>
          <ECProperty propertyName="p1" typeName="int" />
          <ECProperty propertyName="p2" typeName="int" />
          <ECProperty propertyName="p3" typeName="int" />
          <ECProperty propertyName="p4" typeName="int" />
        </ECEntityClass>
    </ECSchema>`;
    await b1.importSchemaStrings([schema2], channelUri);

    b0.sharedChannelPull(channelUri);

    // test default URI
    b2.sharedChannelDefaultUri = channelUri;
    assert.equal(b2.sharedChannelDefaultUri, channelUri);
    b2.sharedChannelPull();

    // b1 = b2 == b0
    const b0Hashes = getSchemaHashes(b0);
    const b1Hashes = getSchemaHashes(b1);
    const b2Hashes = getSchemaHashes(b2);
    assert.deepEqual(b0Hashes, b1Hashes);
    assert.deepEqual(b0Hashes, b2Hashes);

    const schema3 = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestSchema1" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
        <ECEntityClass typeName="Pipe1">
          <BaseClass>bis:GeometricElement2d</BaseClass>
          <ECProperty propertyName="p1" typeName="int" />
          <ECProperty propertyName="p2" typeName="int" />
          <ECProperty propertyName="p3" typeName="int" />
          <ECProperty propertyName="p4" typeName="int" />
          <ECProperty propertyName="p5" typeName="int" />
          <ECProperty propertyName="p6" typeName="int" />
        </ECEntityClass>
    </ECSchema>`;
    await b2.importSchemaStrings([schema3]);

    b0.saveChanges();
    b1.saveChanges();
    b2.saveChanges();
    b0.close();
    b1.close();
    b2.close();
  });

});
