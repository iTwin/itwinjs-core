/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { Suite } from "mocha";
import { _nativeDb, BriefcaseDb, BriefcaseManager, ChannelControl, DrawingCategory, IModelDb, IModelHost, SchemaSync, SnapshotDb } from "@itwin/core-backend";
import "./StartupShutdown"; // calls startup/shutdown IModelHost before/after all tests
import { AzuriteTest } from "./AzuriteTest";
import { HubMock } from "@itwin/core-backend/lib/cjs/internal/HubMock";
import { HubWrappers, IModelTestUtils, KnownTestLocations, withEditTxn } from "@itwin/core-backend/lib/cjs/test";
import { AccessToken, DbResult, Guid, Id64String, OpenMode } from "@itwin/core-bentley";
import * as path from "path";
import { ChangesetType, Code, ColorDef, GeometryStreamProps, IModel, SubCategoryAppearance } from "@itwin/core-common";
import { Arc3d, IModelJson, Point3d } from "@itwin/core-geometry";
import {
  assertChangesetTypeAndDescr, assertThrowsAsync, assertThrowsAsyncContaining, createTestIModel, enableSchemaSync, expectCacheTablesIdentical,
  expectCensusPreserved, expectMetadataTablesIdentical, expectNoForeignKeyViolations, expectPhysicalSchemaIdentical, extendedIt,
  importTinySchema as importSchema, initializeContainer, insertDrawingModelAndCategory, insertGeometricElement2d, openTestBriefcase,
  queryProfileVer, queryPropNames, querySchemaSyncDataVer, readElementProp, readTableRows, takeElementCensus, TestElementProps,
  TinyPrimitiveProp, TinySchema, tinySchemaToXml, TinyStructProp,
} from "./SchemaSyncTestUtils";
describe("Schema synchronization", function (this: Suite) {
  this.timeout(0);

  before(async () => {
    IModelHost.authorizationClient = new AzuriteTest.AuthorizationClient();
    AzuriteTest.userToken = AzuriteTest.service.userToken.readWrite;
  });

  after(async () => {
    IModelHost.authorizationClient = undefined;
  });

  // A test that fails before its own HubMock.shutdown() would otherwise take every later test with it.
  afterEach(() => {
    if (HubMock.isValid)
      HubMock.shutdown();
  });

  const imodelJsCoreDirname = path.join(__dirname, `../../../../..`);

  const readOverflowElementIds = (db: IModelDb): string[] => {
    let tableExists = false;
    db.withPreparedSqliteStatement("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (stmt) => {
      stmt.bindString(1, "bis_GeometricElement2d_Overflow");
      tableExists = stmt.step() === DbResult.BE_SQLITE_ROW;
    });
    assert.isTrue(tableExists, "BisCore's GeometricElement2d overflow table is missing");
    const ids: string[] = [];
    db.withPreparedSqliteStatement("SELECT ElementId FROM bis_GeometricElement2d_Overflow", (stmt) => {
      while (stmt.step() === DbResult.BE_SQLITE_ROW)
        ids.push(stmt.getValue(0).getId());
    });
    return ids;
  };

  const querySchemaId = (db: IModelDb, schemaName: string): string => db.withPreparedSqliteStatement("SELECT Id FROM ec_Schema WHERE Name=?", (stmt) => {
    stmt.bindString(1, schemaName);
    assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW, `${schemaName} is missing from ec_Schema`);
    return stmt.getValue(0).getId();
  });

  const pushAfterPull = async (briefcase: BriefcaseDb, accessToken: AccessToken, description: string): Promise<void> => {
    try {
      await briefcase.pushChanges({ accessToken, description });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("pull is required"))
        throw error;
      await briefcase.pullChanges({ accessToken });
      await briefcase.pushChanges({ accessToken, description });
    }
  };

  it("multi user workflow", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "imodel-sync-itwin-1" });

    const iTwinId = Guid.createValue();
    const user1AccessToken = "token 1";
    const user2AccessToken = "token 2";
    const user3AccessToken = "token 3";

    HubMock.startup("test", KnownTestLocations.outputDir);
    const version0 = IModelTestUtils.prepareOutputFile("schemaSync", "imodel1.bim");
    SnapshotDb.createEmpty(version0, { rootSubject: { name: "testSchemaSync" } }).close();

    const iModelId = await HubMock.createNewIModel({ accessToken: user1AccessToken, iTwinId, version0, iModelName: "schemaSync" });

    const openNewBriefcase = async (accessToken: AccessToken) => {
      const bcProps = await BriefcaseManager.downloadBriefcase({ iModelId, iTwinId, accessToken });
      return BriefcaseDb.open(bcProps);
    };

    const b1 = await openNewBriefcase(user1AccessToken);
    const b2 = await openNewBriefcase(user2AccessToken);
    const b3 = await openNewBriefcase(user3AccessToken);

    SchemaSync.setTestCache(b1, "briefcase1");
    SchemaSync.setTestCache(b2, "briefcase2");
    SchemaSync.setTestCache(b3, "briefcase3");

    await SchemaSync.initializeForIModel({ iModel: b1, containerProps });
    await b1.pushChanges({ accessToken: user1AccessToken, description: "enable shared schema channel" });
    assert.isTrue(b1[_nativeDb].schemaSyncEnabled());

    // b2 briefcase need to pull to enable shared schema channel.
    await b2.pullChanges({ accessToken: user2AccessToken });
    assert.isTrue(b2[_nativeDb].schemaSyncEnabled());

    // Import schema into b1 but do not push it.
    const schema1 = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestSchema1" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
        <ECEntityClass typeName="Pipe1">
            <BaseClass>bis:GeometricElement2d</BaseClass>
            <ECProperty propertyName="p1" typeName="int" />
            <ECProperty propertyName="p2" typeName="int" />
        </ECEntityClass>
    </ECSchema>`;
    await b1.importSchemaStrings([schema1]);

    // ensure b1 have class and its properties
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    assert.sameOrderedMembers(["p1", "p2"], Object.getOwnPropertyNames(b1.getMetaData("TestSchema1:Pipe1").properties));

    // Add properties in b2. The sync db already contains b1's unpushed import, so this composes both updates.
    const schema2 = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestSchema1" alias="ts" version="01.00.01" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
        <ECEntityClass typeName="Pipe1">
          <BaseClass>bis:GeometricElement2d</BaseClass>
          <ECProperty propertyName="p1" typeName="int" />
          <ECProperty propertyName="p2" typeName="int" />
          <ECProperty propertyName="p3" typeName="int" />
          <ECProperty propertyName="p4" typeName="int" />
        </ECEntityClass>
    </ECSchema>`;
    await b2.importSchemaStrings([schema2]);

    // ensure b2 have class and its properties
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    assert.sameOrderedMembers(["p1", "p2", "p3", "p4"], Object.getOwnPropertyNames(b2.getMetaData("TestSchema1:Pipe1").properties));

    // Re-importing adopts the sync db's existing answer without a whole-file pull.
    await b1.importSchemaStrings([schema2]);

    // ensure b1 have class and its properties
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    assert.sameOrderedMembers(["p1", "p2", "p3", "p4"], Object.getOwnPropertyNames(b1.getMetaData("TestSchema1:Pipe1").properties));

    // push changes
    await b1.pushChanges({ accessToken: user1AccessToken, description: "push schema changes" });
    await b2.pushChanges({ accessToken: user2AccessToken, description: "push similar changes as b1" });

    // b3 which has not seen any schema change
    await b3.pullChanges({ accessToken: user3AccessToken });

    // ensure b3 have class and its properties
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    assert.sameOrderedMembers(["p1", "p2", "p3", "p4"], Object.getOwnPropertyNames(b3.getMetaData("TestSchema1:Pipe1").properties));

    b1.close();
    b2.close();
    b3.close();
  });

  // The third briefcase only derives its tables from ec_, while data is inserted between the two schema changes.
  // That combination exercises the pull materialization path and makes physical-schema agreement observable.
  extendedIt("multi user workflow with a pull-only briefcase and interleaved data", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "schema-front-door-1" });
    const accessToken1 = "schema front door 1 user 1";
    const accessToken2 = "schema front door 1 user 2";
    const accessToken3 = "schema front door 1 user 3";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "schema front door 1", accessToken: accessToken1 });
    const b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken: accessToken1, cacheName: "schemaFrontDoor1b1" });
    const b2 = await openTestBriefcase({ iTwinId, iModelId, accessToken: accessToken2, cacheName: "schemaFrontDoor1b2" });
    const b3 = await openTestBriefcase({ iTwinId, iModelId, accessToken: accessToken3, cacheName: "schemaFrontDoor1b3" });

    try {
      await enableSchemaSync(b1, containerProps);
      await b2.pullChanges({ accessToken: accessToken2 });
      await b3.pullChanges({ accessToken: accessToken3 });

      const schemaV1: TinySchema = {
        name: "FrontDoorWorkflow",
        alias: "fdw",
        ver: "01.00.00",
        refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
        classes: [{
          type: "entity",
          name: "Pipe",
          baseClass: "bis:GeometricElement2d",
          props: [
            { kind: "primitive", name: "p0", type: "string" },
            { kind: "primitive", name: "p1", type: "string" },
          ],
        }],
      };
      await importSchema(b1, schemaV1);
      await b1.pushChanges({ accessToken: accessToken1, description: "front door initial schema" });
      await b2.pullChanges({ accessToken: accessToken2 });
      await b3.pullChanges({ accessToken: accessToken3 });

      const place = await insertDrawingModelAndCategory(b1, "FrontDoorWorkflow");
      const elementId = await insertGeometricElement2d(b1, {
        ...place,
        classFullName: "FrontDoorWorkflow:Pipe",
        props: { p0: "before second schema", p1: "preserve" },
      });
      await b1.pushChanges({ accessToken: accessToken1, description: "front door interleaved data" });
      await b2.pullChanges({ accessToken: accessToken2 });
      await b3.pullChanges({ accessToken: accessToken3 });

      const schemaV2: TinySchema = {
        ...schemaV1,
        ver: "01.00.01",
        classes: [{ ...schemaV1.classes![0], props: [
          ...schemaV1.classes![0].props!,
          { kind: "primitive", name: "p2", type: "string" },
          { kind: "primitive", name: "p3", type: "string" },
        ] }],
      };
      await importSchema(b2, schemaV2);
      await pushAfterPull(b2, accessToken2, "front door second schema");
      await b1.pullChanges({ accessToken: accessToken1 });
      await b3.pullChanges({ accessToken: accessToken3 });

      const className = "FrontDoorWorkflow:Pipe";
      for (const [index, briefcase] of [b1, b2, b3].entries()) {
        assert.deepEqual(queryPropNames(briefcase, className), ["p0", "p1", "p2", "p3"]);
        assert.equal(readElementProp(briefcase, elementId, "p0"), "before second schema", `p0 changed in b${index + 1}`);
        assert.equal(readElementProp(briefcase, elementId, "p1"), "preserve", `p1 changed in b${index + 1}`);
        expectNoForeignKeyViolations(briefcase, `front door b${index + 1}`);
      }

      const census1 = await takeElementCensus(b1, [className]);
      const census2 = await takeElementCensus(b2, [className]);
      const census3 = await takeElementCensus(b3, [className]);
      expectCensusPreserved(census1, census2, "between b1 and b2 after the pulling briefcase materialized the schema");
      expectCensusPreserved(census1, census3, "between b1 and b3 after the pulling briefcase materialized the schema");
      expectMetadataTablesIdentical(b1, b2, "front door metadata b1/b2", { a: "b1", b: "b2" });
      expectMetadataTablesIdentical(b1, b3, "front door metadata b1/b3", { a: "b1", b: "b3" });
      expectCacheTablesIdentical(b1, b2, "front door cache b1/b2", { a: "b1", b: "b2" });
      expectCacheTablesIdentical(b1, b3, "front door cache b1/b3", { a: "b1", b: "b3" });
      expectPhysicalSchemaIdentical(b1, b2, "front door physical schema b1/b2");
      expectPhysicalSchemaIdentical(b1, b3, "front door physical schema b1/b3");
    } finally {
      b3.close();
      b2.close();
      b1.close();
    }
  });
  it("import same schema from different briefcase", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "imodel-sync-itwin-2" });
    const iTwinId = Guid.createValue();
    const user1AccessToken = "token 1";
    const user2AccessToken = "token 2";
    const user3AccessToken = "token 3";

    HubMock.startup("test", KnownTestLocations.outputDir);
    const version0 = IModelTestUtils.prepareOutputFile("schemaSync", "imodel1.bim");
    SnapshotDb.createEmpty(version0, { rootSubject: { name: "testSchemaSync" } }).close();

    const iModelId = await HubMock.createNewIModel({ accessToken: user1AccessToken, iTwinId, version0, iModelName: "schemaSync" });

    const openNewBriefcase = async (accessToken: AccessToken) => {
      const bcProps = await BriefcaseManager.downloadBriefcase({ iModelId, iTwinId, accessToken });
      return BriefcaseDb.open(bcProps);
    };

    const b1 = await openNewBriefcase(user1AccessToken);
    const b2 = await openNewBriefcase(user2AccessToken);
    const b3 = await openNewBriefcase(user3AccessToken);

    SchemaSync.setTestCache(b1, "briefcase1a");
    SchemaSync.setTestCache(b2, "briefcase2a");
    SchemaSync.setTestCache(b3, "briefcase3a");

    await SchemaSync.initializeForIModel({ iModel: b1, containerProps });
    await b1.pushChanges({ accessToken: user1AccessToken, description: "enable shared schema channel" });
    assert.isTrue(b1[_nativeDb].schemaSyncEnabled());

    // b2 briefcase need to pull to enable shared schema channel.
    await b2.pullChanges({ accessToken: user2AccessToken });
    assert.isTrue(b2[_nativeDb].schemaSyncEnabled());

    // Import schema into b1 but do not push it.
    const schema1 = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestSchema1" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
        <ECEntityClass typeName="Pipe1">
            <BaseClass>bis:GeometricElement2d</BaseClass>
            <ECProperty propertyName="p1" typeName="int" />
            <ECProperty propertyName="p2" typeName="int" />
        </ECEntityClass>
    </ECSchema>`;
    await b1.importSchemaStrings([schema1]);

    // ensure b1 have class and its properties
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    assert.sameOrderedMembers(["p1", "p2"], Object.getOwnPropertyNames(b1.getMetaData("TestSchema1:Pipe1").properties));

    // import same schema from another briefcase
    await b2.importSchemaStrings([schema1]);

    // ensure b2 have class and its properties
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    assert.sameOrderedMembers(["p1", "p2"], Object.getOwnPropertyNames(b2.getMetaData("TestSchema1:Pipe1").properties));

    // Re-importing the same version adopts the shared answer without a whole-file pull.
    await b1.importSchemaStrings([schema1]);

    // ensure b1 have class and its properties
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    assert.sameOrderedMembers(["p1", "p2"], Object.getOwnPropertyNames(b1.getMetaData("TestSchema1:Pipe1").properties));

    // push changes
    await b1.pushChanges({ accessToken: user1AccessToken, description: "push schema changes" });
    await b2.pushChanges({ accessToken: user2AccessToken, description: "push similar changes as b1" });

    // b3 which has not seen any schema change
    await b3.pullChanges({ accessToken: user3AccessToken });

    // ensure b3 have class and its properties
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    assert.sameOrderedMembers(["p1", "p2"], Object.getOwnPropertyNames(b3.getMetaData("TestSchema1:Pipe1").properties));

    b1.close();
    b2.close();
    b3.close();
  });

  // Both domain schemas share a referenced schema, so the sync database must preserve one reference row and id.
  // Importing different closures on the two briefcases exercises reference reconciliation rather than duplicate import.
  extendedIt("import different schemas that share a reference", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "schema-front-door-2" });
    const accessToken1 = "schema front door 2 user 1";
    const accessToken2 = "schema front door 2 user 2";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "schema front door 2", accessToken: accessToken1 });
    const b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken: accessToken1, cacheName: "schemaFrontDoor2b1" });
    const b2 = await openTestBriefcase({ iTwinId, iModelId, accessToken: accessToken2, cacheName: "schemaFrontDoor2b2" });

    try {
      await enableSchemaSync(b1, containerProps);
      await b2.pullChanges({ accessToken: accessToken2 });

      const commonSchema: TinySchema = {
        name: "FrontDoorCommon",
        alias: "common",
        ver: "01.00.00",
        refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
        classes: [{
          type: "entity",
          name: "BaseElement",
          baseClass: "bis:GeometricElement2d",
          props: [{ kind: "primitive", name: "commonValue", type: "string" }],
        }],
      };
      await importSchema(b1, commonSchema);
      await b1.pushChanges({ accessToken: accessToken1, description: "front door common schema" });
      await b2.pullChanges({ accessToken: accessToken2 });

      const schemaA: TinySchema = {
        name: "FrontDoorSchemaA",
        alias: "fda",
        ver: "01.00.00",
        refs: [
          { name: "BisCore", ver: "01.00.00", alias: "bis" },
          { name: "FrontDoorCommon", ver: "01.00.00", alias: "common" },
        ],
        classes: [{
          type: "entity",
          name: "ElementA",
          baseClass: "common:BaseElement",
          props: [{ kind: "primitive", name: "fromA", type: "string" }],
        }],
      };
      const schemaB: TinySchema = {
        name: "FrontDoorSchemaB",
        alias: "fdb",
        ver: "01.00.00",
        refs: [
          { name: "BisCore", ver: "01.00.00", alias: "bis" },
          { name: "FrontDoorCommon", ver: "01.00.00", alias: "common" },
        ],
        classes: [{
          type: "entity",
          name: "ElementB",
          baseClass: "common:BaseElement",
          props: [{ kind: "primitive", name: "fromB", type: "string" }],
        }],
      };
      await Promise.all([importSchema(b1, schemaA), importSchema(b2, schemaB)]);
      await b1.pushChanges({ accessToken: accessToken1, description: "front door schema A" });
      await pushAfterPull(b2, accessToken2, "front door schema B");
      await b1.pullChanges({ accessToken: accessToken1 });
      await b2.pullChanges({ accessToken: accessToken2 });

      assert.equal(querySchemaId(b1, "FrontDoorCommon"), querySchemaId(b2, "FrontDoorCommon"), "the shared reference received different ids");
      assert.deepEqual(queryPropNames(b1, "FrontDoorSchemaA:ElementA"), ["fromA"]);
      assert.deepEqual(queryPropNames(b1, "FrontDoorSchemaB:ElementB"), ["fromB"]);
      assert.deepEqual(queryPropNames(b2, "FrontDoorSchemaA:ElementA"), ["fromA"]);
      assert.deepEqual(queryPropNames(b2, "FrontDoorSchemaB:ElementB"), ["fromB"]);
      expectMetadataTablesIdentical(b1, b2, "after different schemas with a shared reference", { a: "b1", b: "b2" });
      expectPhysicalSchemaIdentical(b1, b2, "after different schemas with a shared reference");
      expectNoForeignKeyViolations(b1, "shared reference b1");
      expectNoForeignKeyViolations(b2, "shared reference b2");
    } finally {
      b2.close();
      b1.close();
    }
  });
  it("override schema sync container", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "imodel-sync-itwin-1" });

    const iTwinId = Guid.createValue();
    const user1AccessToken = "token 1";
    const user2AccessToken = "token 2";
    const user3AccessToken = "token 3";

    HubMock.startup("test", KnownTestLocations.outputDir);
    const version0 = IModelTestUtils.prepareOutputFile("schemaSync", "imodel1.bim");
    SnapshotDb.createEmpty(version0, { rootSubject: { name: "testSchemaSync" } }).close();

    const iModelId = await HubMock.createNewIModel({ accessToken: user1AccessToken, iTwinId, version0, iModelName: "schemaSync" });

    const openNewBriefcase = async (accessToken: AccessToken) => {
      const bcProps = await BriefcaseManager.downloadBriefcase({ iModelId, iTwinId, accessToken });
      return BriefcaseDb.open(bcProps);
    };

    const b1 = await openNewBriefcase(user1AccessToken);
    const b2 = await openNewBriefcase(user2AccessToken);
    const b3 = await openNewBriefcase(user3AccessToken);

    SchemaSync.setTestCache(b1, "briefcase1");
    SchemaSync.setTestCache(b2, "briefcase2");
    SchemaSync.setTestCache(b3, "briefcase3");

    await SchemaSync.initializeForIModel({ iModel: b1, containerProps });
    await importSchema(b1, {
      name: "Test1",
      alias: "ts1",
      ver: "01.00.00",
      refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
      classes: [{
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          { kind: "primitive", name: "p0", type: "string" },
        ],
      },
      ],
    });
    assert.deepEqual(queryPropNames(b1, "Test1:Pipe1"), ["p0"]);
    await b1.pushChanges({ description: "Test1 schema push" });

    // B2 learns about Test1 from the changeset. The sync db distributes nothing on its own.
    await b2.pullChanges();
    assert.deepEqual(queryPropNames(b2, "Test1:Pipe1"), ["p0"]);

    // B2 switch container
    const newContainerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "imodel-sync-itwin-2" });
    await assertThrowsAsync(
      async () => SchemaSync.initializeForIModel({ iModel: b2, containerProps: newContainerProps }),
      "Local db already initialized to schema sync (container-id: imodel-sync-itwin-1)");

    await SchemaSync.initializeForIModel({ iModel: b2, containerProps: newContainerProps, overrideContainer: true });
    await importSchema(b2, {
      name: "Test1",
      alias: "ts1",
      ver: "01.00.01",
      refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
      classes: [{
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          { kind: "primitive", name: "p0", type: "string" },
          { kind: "primitive", name: "p1", type: "string" }, /* New property added by B2 using new imodel-sync-itwin-2 */
        ],
      },
      ],
    });
    assert.deepEqual(queryPropNames(b2, "Test1:Pipe1"), ["p0", "p1"]);
    await b2.pushChanges({ description: "b2 push" });

    // B1 still points at the old container and has seen none of this.
    assert.deepEqual(queryPropNames(b1, "Test1:Pipe1"), ["p0"]);

    // Pulling switches B1 to the new container and brings B2's schema with it.
    await b1.pullChanges();
    assert.deepEqual(queryPropNames(b1, "Test1:Pipe1"), ["p0", "p1"]);

    await importSchema(b1, {
      name: "Test1",
      alias: "ts1",
      ver: "01.00.02",
      refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
      classes: [{
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          { kind: "primitive", name: "p0", type: "string" },
          { kind: "primitive", name: "p1", type: "string" },
          { kind: "primitive", name: "p2", type: "string" },
        ],
      },
      ],
    });
    assert.deepEqual(queryPropNames(b1, "Test1:Pipe1"), ["p0", "p1", "p2"]);
    await b1.pushChanges({ description: "b1 push" });

    // B3 has been idle since before schema sync was enabled and catches up in one pull.
    await b3.pullChanges();
    assert.deepEqual(queryPropNames(b3, "Test1:Pipe1"), ["p0", "p1", "p2"]);

    await b2.pullChanges();
    assert.deepEqual(queryPropNames(b2, "Test1:Pipe1"), ["p0", "p1", "p2"]);

    // Expected history on master
    const masterHistory = (await HubMock.queryChangesets({ iModelId })).map((x) => {
      return { description: x.description, changesType: x.changesType, briefcaseId: x.briefcaseId };
    });

    const expectedHistory = [{
      description: "Enable SchemaSync for iModel with container-id: imodel-sync-itwin-1",
      changesType: 0,
      briefcaseId: 2,
    }, {
      description: "Test1 schema push",
      changesType: 65,
      briefcaseId: 2,
    }, {
      description: "Overriding SchemaSync for iModel with container-id: imodel-sync-itwin-2",
      changesType: 0,
      briefcaseId: 3,
    }, {
      description: "b2 push",
      changesType: 65,
      briefcaseId: 3,
    }, {
      description: "b1 push",
      changesType: 65,
      briefcaseId: 2,
    },
    ];
    assert.deepEqual(masterHistory, expectedHistory);

    [b1, b2, b3].forEach((b) => {
      withEditTxn(b, () => { });
      b.close();
    });
  });

  // The override must leave a briefcase with committed local work governed by its original container.
  // Silently reseeding a new authority would make that unpushed schema change unrecoverable.
  extendedIt("refuses to override schema sync with unpushed local changes", async () => {
    const firstContainer = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "schema-front-door-3a" });
    const secondContainer = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "schema-front-door-3b" });
    const accessToken1 = "schema front door 3 user 1";
    const accessToken2 = "schema front door 3 user 2";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "schema front door 3", accessToken: accessToken1 });
    const b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken: accessToken1, cacheName: "schemaFrontDoor3b1" });
    const b2 = await openTestBriefcase({ iTwinId, iModelId, accessToken: accessToken2, cacheName: "schemaFrontDoor3b2" });

    try {
      await enableSchemaSync(b1, firstContainer);
      await b2.pullChanges({ accessToken: accessToken2 });
      const schemaV1: TinySchema = {
        name: "FrontDoorOverride",
        alias: "fdo",
        ver: "01.00.00",
        refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
        classes: [{
          type: "entity",
          name: "Pipe",
          baseClass: "bis:GeometricElement2d",
          props: [{ kind: "primitive", name: "p0", type: "string" }],
        }],
      };
      await importSchema(b1, schemaV1);
      await b1.pushChanges({ accessToken: accessToken1, description: "front door override initial schema" });
      await b2.pullChanges({ accessToken: accessToken2 });

      await importSchema(b2, {
        ...schemaV1,
        ver: "01.00.01",
        classes: [{ ...schemaV1.classes![0], props: [
          ...schemaV1.classes![0].props!,
          { kind: "primitive", name: "unpushed", type: "string" },
        ] }],
      });
      assert.isTrue(b2.txns.hasLocalChanges);
      assert.equal(SchemaSync.queryContainerProps(b2)?.containerId, firstContainer.containerId);

      await assertThrowsAsync(
        async () => SchemaSync.initializeForIModel({ iModel: b2, containerProps: secondContainer, overrideContainer: true }),
        "Cannot enable SchemaSync while there are local changes",
      );
      assert.equal(SchemaSync.queryContainerProps(b2)?.containerId, firstContainer.containerId, "the override changed the local authority");
      assert.isTrue(b2.txns.hasLocalChanges, "the unpushed schema change was discarded");
      await b2.discardChanges();
    } finally {
      b2.close();
      b1.close();
    }
  });

  // This iModel starts on ECDb profile 4.0.0.1, which cannot read EC 3.2 schemas until the profile
  // is upgraded, so every schema here is authored at 3.1.
  const importSchemaEc31 = async (b: BriefcaseDb, s: TinySchema) => importSchema(b, { ...s, ecXmlVersion: "3.1" });

  it("test schema sync with profile and domain schema upgrade (from 4.0.0.1)", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "imodel-sync-itwin-1" });

    const iTwinId = Guid.createValue();
    const user1AccessToken = "token 1";
    const user2AccessToken = "token 2";
    const user3AccessToken = "token 3";

    HubMock.startup("test", KnownTestLocations.outputDir);

    // Setup seed file from existing 4.0.0.3 imodel
    const testFile = SnapshotDb.openDgnDb({ path: path.join(imodelJsCoreDirname, "core/backend/lib/cjs/test/assets/test_ec_4001.bim") }, OpenMode.ReadWrite);
    const version0 = testFile.getFilePath();
    testFile.closeFile();

    const iModelId = await HubMock.createNewIModel({ accessToken: user1AccessToken, iTwinId, version0, iModelName: "schemaSync" });

    const openNewBriefcase = async (accessToken: AccessToken) => {
      const bcProps = await BriefcaseManager.downloadBriefcase({ iModelId, iTwinId, accessToken });
      return BriefcaseDb.open(bcProps);
    };

    const b1Props = await BriefcaseManager.downloadBriefcase({ iModelId, iTwinId, accessToken: user1AccessToken });
    let b1 = await BriefcaseDb.open(b1Props);
    const b2 = await openNewBriefcase(user2AccessToken);
    const b3 = await openNewBriefcase(user3AccessToken);

    SchemaSync.setTestCache(b1, "briefcase1");
    SchemaSync.setTestCache(b2, "briefcase2");
    SchemaSync.setTestCache(b3, "briefcase3");

    // 1. B1 import a new schema
    // 2. B1 push it changes
    // 3. B1 enable schema sync (require schema lock + push changeset)
    await importSchemaEc31(b1, {
      name: "Test1",
      alias: "ts1",
      ver: "01.00.00",
      refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
      classes: [{
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          { kind: "primitive", name: "p0", type: "string" },
        ],
      },
      ],
    });

    assert.isUndefined(querySchemaSyncDataVer(b1), "SchemaSync data version should be undefined as its not initialized");
    assert.deepEqual(queryPropNames(b1, "Test1:Pipe1"), ["p0"]);
    // should fail as there are pending changeset.
    await assertThrowsAsync(
      async () => SchemaSync.initializeForIModel({ iModel: b1, containerProps }),
      "Cannot enable SchemaSync while there are local changes");

    // push changes and then retry.
    await b1.pushChanges({ description: "schema changes" });
    await assertChangesetTypeAndDescr(b1, ChangesetType.Schema, "schema changes");
    // initialize also save and push changeset.
    await SchemaSync.initializeForIModel({ iModel: b1, containerProps });
    assert.isFalse(b1.txns.hasLocalChanges);
    assert.isTrue(b1[_nativeDb].schemaSyncEnabled());
    assert.equal(querySchemaSyncDataVer(b1), "0x1", "SchemaSync data version should be set");
    await assertChangesetTypeAndDescr(b1, ChangesetType.Regular, "Enable SchemaSync for iModel with container-id: imodel-sync-itwin-1");

    // Make sure all briefcases are on the same profile version 4.0.0.1
    const initialProfileVersion = JSON.parse(`{"major":4,"minor":0,"sub1":0,"sub2":1}`);
    let b1ProfileVersion = JSON.parse(queryProfileVer(b1));
    expect(b1ProfileVersion.major === initialProfileVersion.major).to.be.true;
    expect(b1ProfileVersion.minor === initialProfileVersion.minor).to.be.true;
    expect(b1ProfileVersion.sub1 === initialProfileVersion.sub1).to.be.true;
    expect(b1ProfileVersion.sub2 === initialProfileVersion.sub2).to.be.true;

    let b2ProfileVersion = JSON.parse(queryProfileVer(b2));
    expect(b2ProfileVersion.major === initialProfileVersion.major).to.be.true;
    expect(b2ProfileVersion.minor === initialProfileVersion.minor).to.be.true;
    expect(b2ProfileVersion.sub1 === initialProfileVersion.sub1).to.be.true;
    expect(b2ProfileVersion.sub2 === initialProfileVersion.sub2).to.be.true;

    let b3ProfileVersion = JSON.parse(queryProfileVer(b3));
    expect(b3ProfileVersion.major === initialProfileVersion.major).to.be.true;
    expect(b3ProfileVersion.minor === initialProfileVersion.minor).to.be.true;
    expect(b3ProfileVersion.sub1 === initialProfileVersion.sub1).to.be.true;
    expect(b3ProfileVersion.sub2 === initialProfileVersion.sub2).to.be.true;

    b1.close();

    // 4. B1 profile/schema upgrade
    //    * With schema sync is on following will be done while holding write lock to container.
    //      * Push profile changeset
    //      * PUsh schema changeset
    // 5. B1 modify schema add new property but do not push to hub. But it will be push to SchemaSync container.
    await BriefcaseDb.upgradeSchemas(b1Props);
    b1 = await BriefcaseDb.open(b1Props);
    const latestProfileVersion = JSON.parse(`{"major":4,"minor":0,"sub1":0,"sub2":5}`);
    const b1LatestProfileVersion = JSON.parse(queryProfileVer(b1));
    expect(b1LatestProfileVersion.major).equals(latestProfileVersion.major);
    expect(b1LatestProfileVersion.minor).equals(latestProfileVersion.minor);
    expect(b1LatestProfileVersion.sub1).equals(latestProfileVersion.sub1);
    expect(b1LatestProfileVersion.sub2).equals(latestProfileVersion.sub2);

    assert.equal(querySchemaSyncDataVer(b1), "0x3", "profile & domain schema upgrade should change dataVer from 0x1 to 0x3");
    await assertChangesetTypeAndDescr(b1, ChangesetType.SchemaSync, "Upgraded domain schemas");
    // upgradeSchema() also push changes.
    assert.isFalse(b1.txns.hasLocalChanges);
    assert.isTrue(b1[_nativeDb].schemaSyncEnabled());
    await importSchemaEc31(b1, {
      name: "Test1",
      alias: "ts1",
      ver: "01.00.01",
      refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
      classes: [{
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          { kind: "primitive", name: "p0", type: "string" },
          { kind: "primitive", name: "p1", type: "string" },
        ],
      }],
    });
    assert.deepEqual(queryPropNames(b1, "Test1:Pipe1"), ["p0", "p1"]);
    assert.equal(querySchemaSyncDataVer(b1), "0x4", "Test1 schema update should change it from 0x3 to 0x4");
    await b1.pushChanges({ description: "b1 adds Test1.p1" });

    // 6. B2 import new schema but should fail as it does not see SchemaSync enable so it attempt acquire schema lock
    await assertThrowsAsync(async () => importSchemaEc31(b2, {
      name: "Test2",
      alias: "ts2",
      ver: "01.00.00",
      refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
      classes: [{
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          { kind: "primitive", name: "p0", type: "string" },
        ],
      }],
    }), "pull is required to obtain lock");
    assert.isUndefined(querySchemaSyncDataVer(b2), "should be undefined in B2");

    // 7. B2 pull changes it will get to point where profile/schema was upgraded.
    await b2.pullChanges();
    assert.isTrue(b2[_nativeDb].schemaSyncEnabled());
    assert.deepEqual(queryPropNames(b2, "Test1:Pipe1"), ["p0", "p1"]);
    await importSchemaEc31(b2, {
      name: "Test2",
      alias: "ts2",
      ver: "01.00.00",
      refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
      classes: [{
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          { kind: "primitive", name: "p0", type: "string" },
        ],
      }],
    });
    assert.deepEqual(queryPropNames(b2, "Test1:Pipe1"), ["p0", "p1"]);
    assert.deepEqual(queryPropNames(b2, "Test2:Pipe1"), ["p0"]);

    // B2 add new property p2 to Test1 schema
    await importSchemaEc31(b2, {
      name: "Test1",
      alias: "ts1",
      ver: "01.00.02",
      refs: [{ name: "BisCore", ver: "01.00.02", alias: "bis" }],
      classes: [{
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          { kind: "primitive", name: "p0", type: "string" },
          { kind: "primitive", name: "p1", type: "string" },
          { kind: "primitive", name: "p2", type: "string" }, /* New property added by B2*/
        ],
      }],
    });
    assert.deepEqual(queryPropNames(b2, "Test1:Pipe1"), ["p0", "p1", "p2"]);
    assert.deepEqual(queryPropNames(b2, "Test2:Pipe1"), ["p0"]);
    await b2.pushChanges({ description: "b2 adds Test2 and Test1.p2" });

    // B1 has not pulled, so B2's work is invisible to it.
    assert.deepEqual(queryPropNames(b1, "Test1:Pipe1"), ["p0", "p1"]);
    assert.deepEqual(queryPropNames(b1, "Test2:Pipe1"), []);

    await b1.pullChanges();
    assert.deepEqual(queryPropNames(b1, "Test1:Pipe1"), ["p0", "p1", "p2"]);
    assert.deepEqual(queryPropNames(b1, "Test2:Pipe1"), ["p0"]);

    // B3 does nothing this point and it does not even know Schema Sync is enabled.
    assert.deepEqual(queryPropNames(b3, "Test1:Pipe1"), []);
    assert.deepEqual(queryPropNames(b3, "Test2:Pipe1"), []);

    // B3 will not be able to pull any changes as its does not even know if container was setup.
    assert.isUndefined(querySchemaSyncDataVer(b3));
    SchemaSync.updateDbSchema(b3); // has no effect as b3 does not know if imodel has schema sync enabled.
    assert.isUndefined(querySchemaSyncDataVer(b3));
    assert.deepEqual(queryPropNames(b3, "Test1:Pipe1"), []);
    assert.deepEqual(queryPropNames(b3, "Test2:Pipe1"), []);

    // B3 pull changes from hub and now it should be at point where profile/schema was upgraded and SchemaSync was init.
    await b3.pullChanges();
    assert.deepEqual(queryPropNames(b3, "Test1:Pipe1"), ["p0", "p1", "p2"]);
    assert.deepEqual(queryPropNames(b3, "Test2:Pipe1"), ["p0"]);

    // B3 add new properties to Test1 & Test2 schema.
    await importSchemaEc31(b3, {
      name: "Test1",
      alias: "ts1",
      ver: "01.00.03",
      refs: [{ name: "BisCore", ver: "01.00.02", alias: "bis" }],
      classes: [{
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          { kind: "primitive", name: "p0", type: "string" }, /* Was added by B1 */
          { kind: "primitive", name: "p1", type: "string" }, /* Was added by B1 */
          { kind: "primitive", name: "p2", type: "string" }, /* Was added by B2 */
          { kind: "primitive", name: "p3", type: "string" }, /* New property added by B3*/
        ],
      }],
    });
    await importSchemaEc31(b3, {
      name: "Test2",
      alias: "ts2",
      ver: "01.00.01",
      refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
      classes: [{
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          { kind: "primitive", name: "p0", type: "string" }, /* Was added by B2 */
          { kind: "primitive", name: "p1", type: "string" }, /* New property added by B3 */
          { kind: "primitive", name: "p2", type: "string" }, /* New property added by B3  */
          { kind: "primitive", name: "p3", type: "string" }, /* New property added by B3  */
        ],
      }],
    });
    // B3 local view should confirm the schema changes.
    assert.deepEqual(queryPropNames(b3, "Test1:Pipe1"), ["p0", "p1", "p2", "p3"]);
    assert.deepEqual(queryPropNames(b3, "Test2:Pipe1"), ["p0", "p1", "p2", "p3"]);
    await b3.pushChanges({ description: "b3 adds Test1.p3 and Test2 props" });

    // Test all 3 briefcases for the upgraded profile version 4.0.0.X (where X is at least 4)
    const updatedProfileVersion = JSON.parse(`{"major":4,"minor":0,"sub1":0,"sub2":4}`);
    b1ProfileVersion = JSON.parse(queryProfileVer(b1));
    expect(b1ProfileVersion.major).to.be.equal(updatedProfileVersion.major, "Profile version major should be 4");
    expect(b1ProfileVersion.minor).to.be.equal(updatedProfileVersion.minor, "Profile version minor should be 0");
    expect(b1ProfileVersion.sub1).to.be.equal(updatedProfileVersion.sub1, "Profile version sub1 should be 0");
    expect(b1ProfileVersion.sub2).to.be.greaterThanOrEqual(updatedProfileVersion.sub2, "Profile version sub2 should be at least 4");

    b2ProfileVersion = JSON.parse(queryProfileVer(b2));
    expect(b2ProfileVersion.major).to.be.equal(updatedProfileVersion.major, "Profile version major should be 4");
    expect(b2ProfileVersion.minor).to.be.equal(updatedProfileVersion.minor, "Profile version minor should be 0");
    expect(b2ProfileVersion.sub1).to.be.equal(updatedProfileVersion.sub1, "Profile version sub1 should be 0");
    expect(b2ProfileVersion.sub2).to.be.greaterThanOrEqual(updatedProfileVersion.sub2, "Profile version sub2 should be at least 4");

    b3ProfileVersion = JSON.parse(queryProfileVer(b3));
    expect(b3ProfileVersion.major).to.be.equal(updatedProfileVersion.major, "Profile version major should be 4");
    expect(b3ProfileVersion.minor).to.be.equal(updatedProfileVersion.minor, "Profile version minor should be 0");
    expect(b3ProfileVersion.sub1).to.be.equal(updatedProfileVersion.sub1, "Profile version sub1 should be 0");
    expect(b3ProfileVersion.sub2).to.be.greaterThanOrEqual(updatedProfileVersion.sub2, "Profile version sub2 should be at least 4");

    // Everyone catches up through the timeline and lands on the same schemas and the same sync db version.
    await b1.pullChanges();
    await b2.pullChanges();
    assert.deepEqual(queryPropNames(b1, "Test1:Pipe1"), ["p0", "p1", "p2", "p3"]);
    assert.deepEqual(queryPropNames(b2, "Test2:Pipe1"), ["p0", "p1", "p2", "p3"]);
    assert.equal(querySchemaSyncDataVer(b1), querySchemaSyncDataVer(b3));
    assert.equal(querySchemaSyncDataVer(b2), querySchemaSyncDataVer(b3));

    // A new briefcase B4 should be able to apply change history with no local changes.
    const b4 = await openNewBriefcase(user3AccessToken);
    SchemaSync.setTestCache(b4, "briefcase4a");
    assert.equal(querySchemaSyncDataVer(b4), querySchemaSyncDataVer(b3));
    assert.deepEqual(queryPropNames(b4, "Test1:Pipe1"), ["p0", "p1", "p2", "p3"]);
    assert.deepEqual(queryPropNames(b4, "Test2:Pipe1"), ["p0", "p1", "p2", "p3"]);

    // Expected history on master
    const masterHistory = (await HubMock.queryChangesets({ iModelId })).map((x) => {
      return { description: x.description, changesType: x.changesType, briefcaseId: x.briefcaseId };
    });

    const expectedHistory = [{
      description: "schema changes",
      changesType: 1,
      briefcaseId: 2,
    }, {
      description: "Enable SchemaSync for iModel with container-id: imodel-sync-itwin-1",
      changesType: 0,
      briefcaseId: 2,
    }, {
      description: "Upgraded profile",
      changesType: 65,
      briefcaseId: 2,
    }, {
      description: "Upgraded domain schemas",
      changesType: 65,
      briefcaseId: 2,
    }, {
      description: "b1 adds Test1.p1",
      changesType: 65,
      briefcaseId: 2,
    }, {
      description: "b2 adds Test2 and Test1.p2",
      changesType: 65,
      briefcaseId: 3,
    }, {
      description: "b3 adds Test1.p3 and Test2 props",
      changesType: 65,
      briefcaseId: 4,
    },
    ];
    assert.deepEqual(masterHistory, expectedHistory);

    [b1, b2, b3, b4].forEach((b) => {
      withEditTxn(b, () => { });
      b.close();
    });
  });
  // B2 remains on the old profile and replays the profile/domain upgrade changesets from the timeline.
  // Its bis_* tables therefore have to be reconciled by replay, with the same data as the in-place upgrader.
  extendedIt("replays a profile upgrade on a second briefcase from 4.0.0.1", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "schema-front-door-4" });
    const accessToken1 = "schema front door 4 user 1";
    const accessToken2 = "schema front door 4 user 2";
    const accessToken3 = "schema front door 4 user 3";
    HubMock.startup("test", KnownTestLocations.outputDir);
    const testFile = SnapshotDb.openDgnDb({ path: path.join(imodelJsCoreDirname, "core/backend/lib/cjs/test/assets/test_ec_4001.bim") }, OpenMode.ReadWrite);
    const version0 = testFile.getFilePath();
    testFile.closeFile();
    const iTwinId = Guid.createValue();
    const iModelId = await HubMock.createNewIModel({ accessToken: accessToken1, iTwinId, version0, iModelName: "schema front door 4" });
    const b1Props = await BriefcaseManager.downloadBriefcase({ iModelId, iTwinId, accessToken: accessToken1 });
    let b1 = await BriefcaseDb.open(b1Props);
    const b2 = await openTestBriefcase({ iTwinId, iModelId, accessToken: accessToken2, cacheName: "schemaFrontDoor4b2" });
    const b3 = await openTestBriefcase({ iTwinId, iModelId, accessToken: accessToken3, cacheName: "schemaFrontDoor4b3" });
    SchemaSync.setTestCache(b1, "schemaFrontDoor4b1");

    try {
      const schemaV1: TinySchema = {
        name: "FrontDoorProfile401",
        alias: "fdp",
        ver: "01.00.00",
        ecXmlVersion: "3.1",
        refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
        classes: [{
          type: "entity",
          name: "Pipe",
          baseClass: "bis:GeometricElement2d",
          props: [{ kind: "primitive", name: "p0", type: "string" }],
        }],
      };
      await importSchemaEc31(b1, schemaV1);
      await b1.pushChanges({ accessToken: accessToken1, description: "front door 4 initial schema" });
      await SchemaSync.initializeForIModel({ iModel: b1, containerProps });
      await b2.pullChanges({ accessToken: accessToken2 });
      await b3.pullChanges({ accessToken: accessToken3 });

      const place = await insertDrawingModelAndCategory(b1, "FrontDoorProfile401");
      const elementId = await insertGeometricElement2d(b1, { ...place, classFullName: "FrontDoorProfile401:Pipe", props: { p0: "profile data" } });
      await b1.pushChanges({ accessToken: accessToken1, description: "front door 4 data" });
      await b2.pullChanges({ accessToken: accessToken2 });
      await b3.pullChanges({ accessToken: accessToken3 });
      const beforeB1 = await takeElementCensus(b1, ["FrontDoorProfile401:Pipe"]);
      const beforeB2 = await takeElementCensus(b2, ["FrontDoorProfile401:Pipe"]);

      assert.equal(b3[_nativeDb].executeSql("ALTER TABLE ec_Schema ADD COLUMN OriginalECXmlVersionMajor TEXT"), DbResult.BE_SQLITE_OK);
      b3[_nativeDb].saveChanges();
      assert.isFalse(b3.txns.hasLocalChanges, "direct profile damage created a local transaction");
      const b3ChangesetBeforeUpgrade = b3.changeset;

      b1.close();
      await BriefcaseDb.upgradeSchemas(b1Props);
      b1 = await BriefcaseDb.open(b1Props);
      SchemaSync.setTestCache(b1, "schemaFrontDoor4b1");
      await b2.pullChanges({ accessToken: accessToken2 });

      let damagedProfilePullError: unknown;
      try {
        await b3.pullChanges({ accessToken: accessToken3 });
      } catch (error) {
        damagedProfilePullError = error;
      }
      assert.isDefined(damagedProfilePullError, "pull accepted a failed profile-table DDL statement");
      assert.deepEqual(b3.changeset, b3ChangesetBeforeUpgrade, "failed profile upgrade advanced the briefcase");

      const afterB1 = await takeElementCensus(b1, ["FrontDoorProfile401:Pipe"]);
      const afterB2 = await takeElementCensus(b2, ["FrontDoorProfile401:Pipe"]);
      expectCensusPreserved(beforeB1, afterB1, "after the in-place profile upgrade");
      expectCensusPreserved(beforeB2, afterB2, "after replaying the profile upgrade");
      assert.equal(readElementProp(b1, elementId, "p0"), "profile data");
      assert.equal(readElementProp(b2, elementId, "p0"), "profile data");
      assert.equal(queryProfileVer(b1), queryProfileVer(b2), "the replaying briefcase kept the old BisCore profile");
      assert.deepEqual(queryPropNames(b1, "FrontDoorProfile401:Pipe"), ["p0"]);
      assert.deepEqual(queryPropNames(b2, "FrontDoorProfile401:Pipe"), ["p0"]);
      expectMetadataTablesIdentical(b1, b2, "after replaying the 4.0.0.1 profile upgrade", { a: "in-place", b: "replay" });
      expectCacheTablesIdentical(b1, b2, "after replaying the 4.0.0.1 profile upgrade", { a: "in-place", b: "replay" });
      expectPhysicalSchemaIdentical(b1, b2, "after replaying the 4.0.0.1 profile upgrade");
      expectNoForeignKeyViolations(b1, "4.0.0.1 profile upgrade in-place");
      expectNoForeignKeyViolations(b2, "4.0.0.1 profile upgrade replay");
    } finally {
      b3.close();
      b2.close();
      b1.close();
    }
  });
  it("test schema sync with profile and domain schema upgrade (from 4.0.0.3)", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "imodel-sync-itwin-1" });

    const iTwinId = Guid.createValue();
    const user1AccessToken = "token 1";
    const user2AccessToken = "token 2";
    const user3AccessToken = "token 3";

    HubMock.startup("test", KnownTestLocations.outputDir);

    // Setup seed file from existing 4.0.0.3 imodel
    const testFile = SnapshotDb.openDgnDb({ path: path.join(imodelJsCoreDirname, "core/backend/lib/cjs/test/assets/test_ec_4003.bim") }, OpenMode.ReadWrite);
    const version0 = testFile.getFilePath();
    testFile.closeFile();

    const iModelId = await HubMock.createNewIModel({ accessToken: user1AccessToken, iTwinId, version0, iModelName: "schemaSync" });

    const openNewBriefcase = async (accessToken: AccessToken) => {
      const bcProps = await BriefcaseManager.downloadBriefcase({ iModelId, iTwinId, accessToken });
      return BriefcaseDb.open(bcProps);
    };

    const b1Props = await BriefcaseManager.downloadBriefcase({ iModelId, iTwinId, accessToken: user1AccessToken });
    let b1 = await BriefcaseDb.open(b1Props);
    const b2 = await openNewBriefcase(user2AccessToken);
    const b3 = await openNewBriefcase(user3AccessToken);

    SchemaSync.setTestCache(b1, "briefcase1");
    SchemaSync.setTestCache(b2, "briefcase2");
    SchemaSync.setTestCache(b3, "briefcase3");

    // 1. B1 import a new schema
    // 2. B1 push it changes
    // 3. B1 enable schema sync (require schema lock + push changeset)
    await importSchema(b1, {
      name: "Test1",
      alias: "ts1",
      ver: "01.00.00",
      refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
      classes: [{
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          { kind: "primitive", name: "p0", type: "string" },
        ],
      },
      ],
    });

    assert.isUndefined(querySchemaSyncDataVer(b1), "SchemaSync data version should be undefined as its not initialized");
    assert.deepEqual(queryPropNames(b1, "Test1:Pipe1"), ["p0"]);
    // should fail as there are pending changeset.
    await assertThrowsAsync(
      async () => SchemaSync.initializeForIModel({ iModel: b1, containerProps }),
      "Cannot enable SchemaSync while there are local changes");

    // push changes and then retry.
    await b1.pushChanges({ description: "schema changes" });
    await assertChangesetTypeAndDescr(b1, ChangesetType.Schema, "schema changes");
    // initialize also save and push changeset.
    await SchemaSync.initializeForIModel({ iModel: b1, containerProps });
    assert.isFalse(b1.txns.hasLocalChanges);
    assert.isTrue(b1[_nativeDb].schemaSyncEnabled());
    assert.equal(querySchemaSyncDataVer(b1), "0x1", "SchemaSync data version should be set");
    await assertChangesetTypeAndDescr(b1, ChangesetType.Regular, "Enable SchemaSync for iModel with container-id: imodel-sync-itwin-1");

    // Make sure all briefcases are on the same profile version 4.0.0.3
    const initialProfileVersion = JSON.parse(`{"major":4,"minor":0,"sub1":0,"sub2":3}`);
    let b1ProfileVersion = JSON.parse(queryProfileVer(b1));
    expect(b1ProfileVersion.major === initialProfileVersion.major).to.be.true;
    expect(b1ProfileVersion.minor === initialProfileVersion.minor).to.be.true;
    expect(b1ProfileVersion.sub1 === initialProfileVersion.sub1).to.be.true;
    expect(b1ProfileVersion.sub2 === initialProfileVersion.sub2).to.be.true;

    let b2ProfileVersion = JSON.parse(queryProfileVer(b2));
    expect(b2ProfileVersion.major === initialProfileVersion.major).to.be.true;
    expect(b2ProfileVersion.minor === initialProfileVersion.minor).to.be.true;
    expect(b2ProfileVersion.sub1 === initialProfileVersion.sub1).to.be.true;
    expect(b2ProfileVersion.sub2 === initialProfileVersion.sub2).to.be.true;

    let b3ProfileVersion = JSON.parse(queryProfileVer(b3));
    expect(b3ProfileVersion.major === initialProfileVersion.major).to.be.true;
    expect(b3ProfileVersion.minor === initialProfileVersion.minor).to.be.true;
    expect(b3ProfileVersion.sub1 === initialProfileVersion.sub1).to.be.true;
    expect(b3ProfileVersion.sub2 === initialProfileVersion.sub2).to.be.true;

    b1.close();

    // 4. B1 profile/schema upgrade
    //    * With schema sync is on following will be done while holding write lock to container.
    //      * Push profile changeset
    //      * PUsh schema changeset
    // 5. B1 modify schema add new property but do not push to hub. But it will be push to SchemaSync container.
    await BriefcaseDb.upgradeSchemas(b1Props);
    b1 = await BriefcaseDb.open(b1Props);
    assert.equal(querySchemaSyncDataVer(b1), "0x3", "profile & domain schema upgrade should change dataVer from 0x1 to 0x3");
    await assertChangesetTypeAndDescr(b1, ChangesetType.SchemaSync, "Upgraded domain schemas");
    // upgradeSchema() also push changes.
    assert.isFalse(b1.txns.hasLocalChanges);
    assert.isTrue(b1[_nativeDb].schemaSyncEnabled());
    await importSchema(b1, {
      name: "Test1",
      alias: "ts1",
      ver: "01.00.01",
      refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
      classes: [{
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          { kind: "primitive", name: "p0", type: "string" },
          { kind: "primitive", name: "p1", type: "string" },
        ],
      }],
    });
    assert.deepEqual(queryPropNames(b1, "Test1:Pipe1"), ["p0", "p1"]);
    assert.equal(querySchemaSyncDataVer(b1), "0x4", "Test1 schema update should change it from 0x3 to 0x4");
    await b1.pushChanges({ description: "b1 adds Test1.p1" });

    // 6. B2 import new schema but should fail as it does not see SchemaSync enable so it attempt acquire schema lock
    await assertThrowsAsync(async () => importSchema(b2, {
      name: "Test2",
      alias: "ts2",
      ver: "01.00.00",
      refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
      classes: [{
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          { kind: "primitive", name: "p0", type: "string" },
        ],
      }],
    }), "pull is required to obtain lock");
    assert.isUndefined(querySchemaSyncDataVer(b2), "should be undefined in B2");

    // 7. B2 pull changes it will get to point where profile/schema was upgraded.
    await b2.pullChanges();
    assert.isTrue(b2[_nativeDb].schemaSyncEnabled());
    assert.deepEqual(queryPropNames(b2, "Test1:Pipe1"), ["p0", "p1"]);
    await importSchema(b2, {
      name: "Test2",
      alias: "ts2",
      ver: "01.00.00",
      refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
      classes: [{
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          { kind: "primitive", name: "p0", type: "string" },
        ],
      }],
    });
    assert.deepEqual(queryPropNames(b2, "Test1:Pipe1"), ["p0", "p1"]);
    assert.deepEqual(queryPropNames(b2, "Test2:Pipe1"), ["p0"]);

    // B2 add new property p2 to Test1 schema
    await importSchema(b2, {
      name: "Test1",
      alias: "ts1",
      ver: "01.00.02",
      refs: [{ name: "BisCore", ver: "01.00.02", alias: "bis" }],
      classes: [{
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          { kind: "primitive", name: "p0", type: "string" },
          { kind: "primitive", name: "p1", type: "string" },
          { kind: "primitive", name: "p2", type: "string" }, /* New property added by B2*/
        ],
      }],
    });
    assert.deepEqual(queryPropNames(b2, "Test1:Pipe1"), ["p0", "p1", "p2"]);
    assert.deepEqual(queryPropNames(b2, "Test2:Pipe1"), ["p0"]);
    await b2.pushChanges({ description: "b2 adds Test2 and Test1.p2" });

    // B1 has not pulled, so B2's work is invisible to it.
    assert.deepEqual(queryPropNames(b1, "Test1:Pipe1"), ["p0", "p1"]);
    assert.deepEqual(queryPropNames(b1, "Test2:Pipe1"), []);

    await b1.pullChanges();
    assert.deepEqual(queryPropNames(b1, "Test1:Pipe1"), ["p0", "p1", "p2"]);
    assert.deepEqual(queryPropNames(b1, "Test2:Pipe1"), ["p0"]);

    // B3 does nothing this point and it does not even know Schema Sync is enabled.
    assert.deepEqual(queryPropNames(b3, "Test1:Pipe1"), []);
    assert.deepEqual(queryPropNames(b3, "Test2:Pipe1"), []);

    // B3 will not be able to pull any changes as its does not even know if container was setup.
    assert.isUndefined(querySchemaSyncDataVer(b3));
    SchemaSync.updateDbSchema(b3); // has no effect as b3 does not know if imodel has schema sync enabled.
    assert.isUndefined(querySchemaSyncDataVer(b3));
    assert.deepEqual(queryPropNames(b3, "Test1:Pipe1"), []);
    assert.deepEqual(queryPropNames(b3, "Test2:Pipe1"), []);

    // B3 pull changes from hub and now it should be at point where profile/schema was upgraded and SchemaSync was init.
    await b3.pullChanges();
    assert.deepEqual(queryPropNames(b3, "Test1:Pipe1"), ["p0", "p1", "p2"]);
    assert.deepEqual(queryPropNames(b3, "Test2:Pipe1"), ["p0"]);

    // B3 add new properties to Test1 & Test2 schema.
    await importSchema(b3, {
      name: "Test1",
      alias: "ts1",
      ver: "01.00.03",
      refs: [{ name: "BisCore", ver: "01.00.02", alias: "bis" }],
      classes: [{
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          { kind: "primitive", name: "p0", type: "string" }, /* Was added by B1 */
          { kind: "primitive", name: "p1", type: "string" }, /* Was added by B1 */
          { kind: "primitive", name: "p2", type: "string" }, /* Was added by B2 */
          { kind: "primitive", name: "p3", type: "string" }, /* New property added by B3*/
        ],
      }],
    });
    assert.equal(querySchemaSyncDataVer(b3), "0x7");
    await importSchema(b3, {
      name: "Test2",
      alias: "ts2",
      ver: "01.00.01",
      refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
      classes: [{
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          { kind: "primitive", name: "p0", type: "string" }, /* Was added by B2 */
          { kind: "primitive", name: "p1", type: "string" }, /* New property added by B3 */
          { kind: "primitive", name: "p2", type: "string" }, /* New property added by B3  */
          { kind: "primitive", name: "p3", type: "string" }, /* New property added by B3  */
        ],
      }],
    });
    assert.equal(querySchemaSyncDataVer(b3), "0x8");
    // B3 local view should confirm the schema changes.
    assert.deepEqual(queryPropNames(b3, "Test1:Pipe1"), ["p0", "p1", "p2", "p3"]);
    assert.deepEqual(queryPropNames(b3, "Test2:Pipe1"), ["p0", "p1", "p2", "p3"]);
    await b3.pushChanges({ description: "b3 adds Test1.p3 and Test2 props" });

    // Test all 3 briefcases for the upgraded profile version 4.0.0.X (where X is at least 4)
    const updatedProfileVersion = JSON.parse(`{"major":4,"minor":0,"sub1":0,"sub2":4}`);
    b1ProfileVersion = JSON.parse(queryProfileVer(b1));
    expect(b1ProfileVersion.major).to.be.equal(updatedProfileVersion.major, "Profile version major should be 4");
    expect(b1ProfileVersion.minor).to.be.equal(updatedProfileVersion.minor, "Profile version minor should be 0");
    expect(b1ProfileVersion.sub1).to.be.equal(updatedProfileVersion.sub1, "Profile version sub1 should be 0");
    expect(b1ProfileVersion.sub2).to.be.greaterThanOrEqual(updatedProfileVersion.sub2, "Profile version sub2 should be at least 4");

    b2ProfileVersion = JSON.parse(queryProfileVer(b2));
    expect(b2ProfileVersion.major).to.be.equal(updatedProfileVersion.major, "Profile version major should be 4");
    expect(b2ProfileVersion.minor).to.be.equal(updatedProfileVersion.minor, "Profile version minor should be 0");
    expect(b2ProfileVersion.sub1).to.be.equal(updatedProfileVersion.sub1, "Profile version sub1 should be 0");
    expect(b2ProfileVersion.sub2).to.be.greaterThanOrEqual(updatedProfileVersion.sub2, "Profile version sub2 should be at least 4");

    b3ProfileVersion = JSON.parse(queryProfileVer(b3));
    expect(b3ProfileVersion.major).to.be.equal(updatedProfileVersion.major, "Profile version major should be 4");
    expect(b3ProfileVersion.minor).to.be.equal(updatedProfileVersion.minor, "Profile version minor should be 0");
    expect(b3ProfileVersion.sub1).to.be.equal(updatedProfileVersion.sub1, "Profile version sub1 should be 0");
    expect(b3ProfileVersion.sub2).to.be.greaterThanOrEqual(updatedProfileVersion.sub2, "Profile version sub2 should be at least 4");

    // Everyone catches up through the timeline and lands on the same schemas and the same sync db version.
    await b1.pullChanges();
    await b2.pullChanges();
    assert.deepEqual(queryPropNames(b1, "Test1:Pipe1"), ["p0", "p1", "p2", "p3"]);
    assert.deepEqual(queryPropNames(b2, "Test2:Pipe1"), ["p0", "p1", "p2", "p3"]);
    assert.equal(querySchemaSyncDataVer(b1), querySchemaSyncDataVer(b3));
    assert.equal(querySchemaSyncDataVer(b2), querySchemaSyncDataVer(b3));

    // A new briefcase B4 should be able to apply change history with no local changes.
    const b4 = await openNewBriefcase(user3AccessToken);
    SchemaSync.setTestCache(b4, "briefcase4a");
    assert.equal(querySchemaSyncDataVer(b4), querySchemaSyncDataVer(b3));
    assert.deepEqual(queryPropNames(b4, "Test1:Pipe1"), ["p0", "p1", "p2", "p3"]);
    assert.deepEqual(queryPropNames(b4, "Test2:Pipe1"), ["p0", "p1", "p2", "p3"]);

    // Expected history on master
    const masterHistory = (await HubMock.queryChangesets({ iModelId })).map((x) => {
      return { description: x.description, changesType: x.changesType, briefcaseId: x.briefcaseId };
    });

    const expectedHistory = [{
      description: "schema changes",
      changesType: 1,
      briefcaseId: 2,
    }, {
      description: "Enable SchemaSync for iModel with container-id: imodel-sync-itwin-1",
      changesType: 0,
      briefcaseId: 2,
    }, {
      description: "Upgraded profile",
      changesType: 65,
      briefcaseId: 2,
    }, {
      description: "Upgraded domain schemas",
      changesType: 65,
      briefcaseId: 2,
    }, {
      description: "b1 adds Test1.p1",
      changesType: 65,
      briefcaseId: 2,
    }, {
      description: "b2 adds Test2 and Test1.p2",
      changesType: 65,
      briefcaseId: 3,
    }, {
      description: "b3 adds Test1.p3 and Test2 props",
      changesType: 65,
      briefcaseId: 4,
    },
    ];
    assert.deepEqual(masterHistory, expectedHistory);

    [b1, b2, b3, b4].forEach((b) => {
      withEditTxn(b, () => { });
      b.close();
    });
  });
  // B2 is downloaded only after the profile and domain upgrade, so it replays the complete history from the timeline.
  // Comparing it with the in-place upgrader covers the fresh-briefcase path that never held the old profile.
  extendedIt("downloads a fresh briefcase after a profile upgrade from 4.0.0.3", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "schema-front-door-5" });
    const accessToken = "schema front door 5 user 1";
    const freshAccessToken = "schema front door 5 user 2";
    HubMock.startup("test", KnownTestLocations.outputDir);
    const testFile = SnapshotDb.openDgnDb({ path: path.join(imodelJsCoreDirname, "core/backend/lib/cjs/test/assets/test_ec_4003.bim") }, OpenMode.ReadWrite);
    const version0 = testFile.getFilePath();
    testFile.closeFile();
    const iTwinId = Guid.createValue();
    const iModelId = await HubMock.createNewIModel({ accessToken, iTwinId, version0, iModelName: "schema front door 5" });
    const b1Props = await BriefcaseManager.downloadBriefcase({ iModelId, iTwinId, accessToken });
    let b1 = await BriefcaseDb.open(b1Props);
    SchemaSync.setTestCache(b1, "schemaFrontDoor5b1");
    let b2: BriefcaseDb | undefined;

    try {
      const schemaV1: TinySchema = {
        name: "FrontDoorProfile403",
        alias: "fdf",
        ver: "01.00.00",
        ecXmlVersion: "3.1",
        refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
        classes: [{
          type: "entity",
          name: "Pipe",
          baseClass: "bis:GeometricElement2d",
          props: [{ kind: "primitive", name: "p0", type: "string" }],
        }],
      };
      await importSchemaEc31(b1, schemaV1);
      await b1.pushChanges({ accessToken, description: "front door 5 initial schema" });
      await SchemaSync.initializeForIModel({ iModel: b1, containerProps });
      const place = await insertDrawingModelAndCategory(b1, "FrontDoorProfile403");
      const elementId = await insertGeometricElement2d(b1, { ...place, classFullName: "FrontDoorProfile403:Pipe", props: { p0: "fresh data" } });
      await b1.pushChanges({ accessToken, description: "front door 5 data" });
      const before = await takeElementCensus(b1, ["FrontDoorProfile403:Pipe"]);

      b1.close();
      await BriefcaseDb.upgradeSchemas(b1Props);
      b1 = await BriefcaseDb.open(b1Props);
      SchemaSync.setTestCache(b1, "schemaFrontDoor5b1");
      await importSchemaEc31(b1, {
        ...schemaV1,
        ver: "01.00.01",
        classes: [{ ...schemaV1.classes![0], props: [
          ...schemaV1.classes![0].props!,
          { kind: "primitive", name: "p1", type: "string" },
        ] }],
      });
      await b1.pushChanges({ accessToken, description: "front door 5 domain upgrade" });

      b2 = await openTestBriefcase({ iTwinId, iModelId, accessToken: freshAccessToken, cacheName: "schemaFrontDoor5b2" });
      const after = await takeElementCensus(b2, ["FrontDoorProfile403:Pipe"]);
      expectCensusPreserved(before, after, "after a fresh briefcase replays the profile upgrade");
      assert.equal(readElementProp(b1, elementId, "p0"), "fresh data");
      assert.equal(readElementProp(b2, elementId, "p0"), "fresh data");
      assert.deepEqual(queryPropNames(b1, "FrontDoorProfile403:Pipe"), ["p0", "p1"]);
      assert.deepEqual(queryPropNames(b2, "FrontDoorProfile403:Pipe"), ["p0", "p1"]);
      assert.equal(queryProfileVer(b1), queryProfileVer(b2), "the fresh briefcase has a different profile version");
      assert.equal(querySchemaSyncDataVer(b1), querySchemaSyncDataVer(b2));
      expectMetadataTablesIdentical(b1, b2, "after a fresh 4.0.0.3 briefcase download", { a: "upgraded", b: "fresh" });
      expectCacheTablesIdentical(b1, b2, "after a fresh 4.0.0.3 briefcase download", { a: "upgraded", b: "fresh" });
      expectPhysicalSchemaIdentical(b1, b2, "after a fresh 4.0.0.3 briefcase download");
      expectNoForeignKeyViolations(b1, "4.0.0.3 upgraded briefcase");
      expectNoForeignKeyViolations(b2, "4.0.0.3 fresh briefcase");
    } finally {
      b2?.close();
      b1.close();
    }
  });
  it("import schema acquire schema lock when need to transform data", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "imodel-sync-itwin-2" });
    const iTwinId = Guid.createValue();
    const user1AccessToken = "token 1";
    const user2AccessToken = "token 2";
    const user3AccessToken = "token 3";
    const user4AccessToken = "token 4";

    HubMock.startup("test", KnownTestLocations.outputDir);
    const version0 = IModelTestUtils.prepareOutputFile("schemaSync", "imodel1.bim");
    SnapshotDb.createEmpty(version0, { rootSubject: { name: "testSchemaSync" } }).close();

    const iModelId = await HubMock.createNewIModel({ accessToken: user1AccessToken, iTwinId, version0, iModelName: "schemaSync" });

    const openNewBriefcase = async (accessToken: AccessToken) => {
      const bcProps = await BriefcaseManager.downloadBriefcase({ iModelId, iTwinId, accessToken });
      return BriefcaseDb.open(bcProps);
    };

    const b1 = await openNewBriefcase(user1AccessToken);
    const b2 = await openNewBriefcase(user2AccessToken);
    const b3 = await openNewBriefcase(user3AccessToken);
    const b4 = await openNewBriefcase(user4AccessToken);

    SchemaSync.setTestCache(b1, "briefcase1a");
    SchemaSync.setTestCache(b2, "briefcase2a");
    SchemaSync.setTestCache(b3, "briefcase3a");
    SchemaSync.setTestCache(b4, "briefcase4a");

    await SchemaSync.initializeForIModel({ iModel: b1, containerProps });
    await b1.pushChanges({ accessToken: user1AccessToken, description: "enable shared schema channel" });
    assert.isTrue(b1[_nativeDb].schemaSyncEnabled());
    const sequence = (start: number, stop: number, step: number = 1) => Array.from({ length: (stop - start) / step + 1 }, (_, i) => start + (i * step));

    await importSchema(b1, {
      name: "Test1",
      alias: "ts1",
      ver: "01.00.00",
      refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
      classes: [{
        type: "struct",
        name: "Struct1",
        props: [
          ...sequence(0, 10).map<TinyPrimitiveProp>((i) => { return { kind: "primitive", name: `p${i}`, type: "string" }; }),
        ],
      }, {
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          ...sequence(0, 1).map<TinyStructProp>((i) => { return { kind: "struct", name: `s${i}`, type: "Struct1" }; }),
        ],
      }],
    });
    await b1.pushChanges({ description: "schema with 5 props" });

    await b2.pullChanges();
    await b3.pullChanges();
    assert.isTrue(b2[_nativeDb].schemaSyncEnabled());

    // Widening Struct1 moves data, which a plain import refuses on a schema-sync iModel.
    const test1WithWideStruct: TinySchema = {
      name: "Test1",
      alias: "ts1",
      ver: "01.00.01",
      refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
      classes: [{
        type: "struct",
        name: "Struct1",
        props: [
          ...sequence(0, 30).map<TinyPrimitiveProp>((i) => { return { kind: "primitive", name: `p${i}`, type: "string" }; }),
        ],
      }, {
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          ...sequence(0, 1).map<TinyStructProp>((i) => { return { kind: "struct", name: `s${i}`, type: "Struct1" }; }),
        ],
      }],
    };
    await assertThrowsAsyncContaining(
      async () => importSchema(b1, test1WithWideStruct),
      "Use BriefcaseDb.upgradeSchemas");

    // B2 imports additively and holds on to the shared lock by not pushing, which blocks the transform.
    await importSchema(b2, {
      name: "Test2",
      alias: "ts2",
      ver: "01.00.00",
      refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
      classes: [{
        type: "struct",
        name: "Struct1",
        props: [
          ...sequence(0, 10).map<TinyPrimitiveProp>((i) => { return { kind: "primitive", name: `p${i}`, type: "string" }; }),
        ],
      }, {
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          ...sequence(0, 1).map<TinyStructProp>((i) => { return { kind: "struct", name: `s${i}`, type: "Struct1" }; }),
        ],
      }],
    });
    await assertThrowsAsync(
      async () => b1.upgradeSchemaStrings([tinySchemaToXml(test1WithWideStruct)], { description: "schema with 30 props in test1:Pipe1" }),
      "shared lock is held");

    await b2.pushChanges({ description: "schema with 10 props in test2:Pipe1" });

    // With the shared lock gone the transform runs, and it pushes its own changeset.
    await b1.pullChanges();
    await b1.upgradeSchemaStrings([tinySchemaToXml(test1WithWideStruct)], { description: "schema with 30 props in test1:Pipe1" });
    assert.isFalse(b1.txns.hasLocalChanges, "upgradeSchemaStrings pushes what it imported");

    await b3.pullChanges();
    await importSchema(b3, {
      name: "Test2",
      alias: "ts2",
      ver: "01.00.01",
      refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
      classes: [{
        type: "struct",
        name: "Struct1",
        props: [
          ...sequence(0, 10).map<TinyPrimitiveProp>((i) => { return { kind: "primitive", name: `p${i}`, type: "string" }; }),
        ],
      }, {
        type: "entity",
        name: "Pipe1",
        baseClass: "bis:GeometricElement2d",
        props: [
          ...sequence(0, 1).map<TinyStructProp>((i) => { return { kind: "struct", name: `s${i}`, type: "Struct1" }; }),
          { kind: "primitive", name: "extra", type: "string" },
        ],
      }],
    });
    await b3.pushChanges({ description: "schema with extra prop in test2:Pipe1" });

    await b4.pullChanges();

    const masterHistory = (await HubMock.queryChangesets({ iModelId })).map((x) => {
      return { description: x.description, changesType: x.changesType, briefcaseId: x.briefcaseId };
    });

    const expectedHistory = [{
      description: "Enable SchemaSync for iModel with container-id: imodel-sync-itwin-2",
      changesType: 0,
      briefcaseId: 2,
    }, {
      description: "schema with 5 props",
      changesType: 65,
      briefcaseId: 2,
    }, {
      description: "schema with 10 props in test2:Pipe1",
      changesType: 65,
      briefcaseId: 3,
    }, {
      description: "schema with 30 props in test1:Pipe1",
      changesType: 65,
      briefcaseId: 2,
    }, {
      description: "schema with extra prop in test2:Pipe1",
      changesType: 65,
      briefcaseId: 4,
    }];

    assert.deepEqual(masterHistory, expectedHistory);
    [b1, b2, b3, b4].forEach((b) => {
      withEditTxn(b, () => { });
      b.close();
    });
  });

  // A deletion reports a different upgrade status from a transform, yet its upgrade still needs the exclusive schema lock.
  // Keep that lock occupied with an additive import so the deletion path cannot accidentally bypass acquisition.
  extendedIt("import schema acquire schema lock when need to delete data", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "schema-front-door-6" });
    const accessToken1 = "schema front door 6 user 1";
    const accessToken2 = "schema front door 6 user 2";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "schema front door 6", accessToken: accessToken1 });
    const b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken: accessToken1, cacheName: "schemaFrontDoor6b1" });
    const b2 = await openTestBriefcase({ iTwinId, iModelId, accessToken: accessToken2, cacheName: "schemaFrontDoor6b2" });

    try {
      await enableSchemaSync(b1, containerProps);
      const schemaV1: TinySchema = {
        name: "FrontDoorDeletionLock",
        alias: "fdl",
        ver: "01.00.00",
        dynamic: true,
        refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
        classes: [{
          type: "entity",
          name: "Pipe",
          baseClass: "bis:GeometricElement2d",
          props: [
            { kind: "primitive", name: "keep", type: "string" },
            { kind: "primitive", name: "remove", type: "string" },
          ],
        }],
      };
      await importSchema(b1, schemaV1);
      await b1.pushChanges({ accessToken: accessToken1, description: "front door 6 initial schema" });
      await b2.pullChanges({ accessToken: accessToken2 });
      const place = await insertDrawingModelAndCategory(b1, "FrontDoorDeletionLock");
      const elementId = await insertGeometricElement2d(b1, {
        ...place,
        classFullName: "FrontDoorDeletionLock:Pipe",
        props: { keep: "preserve", remove: "delete" },
      });
      await b1.pushChanges({ accessToken: accessToken1, description: "front door 6 data" });
      await b2.pullChanges({ accessToken: accessToken2 });

      const schemaWithoutProperty: TinySchema = {
        ...schemaV1,
        ver: "02.00.00",
        classes: [{ ...schemaV1.classes![0], props: [{ kind: "primitive", name: "keep", type: "string" }] }],
      };
      let caughtError: unknown;
      try {
        await importSchema(b1, schemaWithoutProperty);
      } catch (error) {
        caughtError = error;
      }
      assert.isDefined(caughtError, "the deleting import should require an upgrade");
      assert.isTrue(SchemaSync.requiresUpgrade(caughtError));
      assert.equal((caughtError as { errorNumber?: number }).errorNumber, DbResult.BE_SQLITE_ERROR_DataDeletionRequired);

      await importSchema(b2, {
        name: "FrontDoorDeletionLockOther",
        alias: "fdlo",
        ver: "01.00.00",
        refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
        classes: [{
          type: "entity",
          name: "Other",
          baseClass: "bis:GeometricElement2d",
          props: [{ kind: "primitive", name: "value", type: "string" }],
        }],
      });
      await assertThrowsAsyncContaining(
        async () => b1.upgradeSchemaStrings([tinySchemaToXml(schemaWithoutProperty)], { accessToken: accessToken1, description: "delete property while locked" }),
        "shared lock is held",
      );
      await b2.pushChanges({ accessToken: accessToken2, description: "front door 6 additive schema" });
      await b1.pullChanges({ accessToken: accessToken1 });
      await b1.upgradeSchemaStrings([tinySchemaToXml(schemaWithoutProperty)], { accessToken: accessToken1, description: "front door 6 delete property" });
      assert.equal(readElementProp(b1, elementId, "keep"), "preserve");
      assert.isUndefined(readElementProp(b1, elementId, "remove"));
      assert.deepEqual(queryPropNames(b1, "FrontDoorDeletionLock:Pipe"), ["keep"]);
    } finally {
      b2.close();
      b1.close();
    }
  });

  const structAndPipeSchema = (structMemberCount: number, ver: string): TinySchema => ({
    name: "TestRetry",
    alias: "tr",
    ver,
    refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
    classes: [{
      type: "struct",
      name: "Struct1",
      props: Array.from({ length: structMemberCount }, (_, i): TinyPrimitiveProp => ({ kind: "primitive", name: `p${i}`, type: "string" })),
    }, {
      type: "entity",
      name: "Pipe1",
      baseClass: "bis:GeometricElement2d",
      props: [
        { kind: "primitive", name: "name", type: "string" },
        { kind: "struct", name: "s0", type: "Struct1" },
        { kind: "struct", name: "s1", type: "Struct1" },
      ],
    }],
  });

  // Struct members are what the widening actually reshuffles across the shared columns, so a test
  // that only fills the entity's own properties never puts a value in a column that moves.
  const structValue = (label: string, memberCount: number): { [member: string]: string } =>
    Object.fromEntries(Array.from({ length: memberCount }, (_, i) => [`p${i}`, `${label}-p${i}`]));

  it("routes a data transform to upgradeSchemas and keeps the data", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "imodel-sync-itwin-3" });
    const accessToken = "schema retry token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "schema retry", accessToken });
    const b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "schemaRetry" });

    try {
      await enableSchemaSync(b1, containerProps);
      await importSchema(b1, structAndPipeSchema(11, "01.00.00"));
      await b1.pushChanges({ accessToken, description: "initial schema" });

      const place = await insertDrawingModelAndCategory(b1, "Retry");
      const elementId = await insertGeometricElement2d(b1, {
        ...place,
        classFullName: "TestRetry:Pipe1",
        props: { name: "keep", s0: structValue("s0", 11), s1: structValue("s1", 11) },
      });
      await b1.pushChanges({ accessToken, description: "insert data" });

      // Without this the struct members could read as undefined all along and the census below would
      // compare nothing, which is the shape of a test that passes while proving nothing.
      assert.equal(readElementProp(b1, elementId, "s0")?.p0, "s0-p0", "the struct members were never stored");
      const before = await takeElementCensus(b1, ["TestRetry:Pipe1"]);

      // Widening the struct reshuffles the shared columns, which the update path refuses.
      const widened = tinySchemaToXml(structAndPipeSchema(31, "01.00.01"));
      let caughtError: unknown;
      try {
        await b1.importSchemaStrings([widened]);
      } catch (err) {
        caughtError = err;
      }
      assert.isDefined(caughtError, "importing a schema that moves data should fail");
      assert.isTrue(SchemaSync.requiresUpgrade(caughtError), "the C++ status did not survive the addon boundary");
      assert.equal((caughtError as { errorNumber?: number }).errorNumber, DbResult.BE_SQLITE_ERROR_DataTransformRequired);

      await b1.upgradeSchemaStrings([widened], { accessToken, description: "widen the struct" });
      assert.include(queryPropNames(b1, "TestRetry:Struct1"), "p30");
      assert.equal(readElementProp(b1, elementId, "name"), "keep");
      assert.equal(readElementProp(b1, elementId, "s0")?.p10, "s0-p10", "s0 lost its members when the columns moved");
      assert.equal(readElementProp(b1, elementId, "s1")?.p10, "s1-p10", "s1 lost its members when the columns moved");
      expectCensusPreserved(before, await takeElementCensus(b1, ["TestRetry:Pipe1"]), "after widening the struct");
      assert.isFalse(b1.txns.hasLocalChanges, "upgradeSchemaStrings pushes the schema change");
    } finally {
      b1.close();
    }
  });

  // Widening the struct also moves the element's mapped properties into BisCore's overflow table.
  // The census alone can miss a row that becomes invisible through the EC join, so inspect overflow directly.
  extendedIt("routes a data transform with overflow rows to upgradeSchemas", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "schema-front-door-7" });
    const accessToken = "schema front door 7 token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "schema front door 7", accessToken });
    const b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "schemaFrontDoor7b1" });

    try {
      await enableSchemaSync(b1, containerProps);
      const initial = structAndPipeSchema(11, "01.00.00");
      await importSchema(b1, initial);
      await b1.pushChanges({ accessToken, description: "front door 7 initial schema" });
      const place = await insertDrawingModelAndCategory(b1, "FrontDoorTransformOverflow");
      const elementId = await insertGeometricElement2d(b1, {
        ...place,
        classFullName: "TestRetry:Pipe1",
        props: { name: "overflow-preserved", s0: structValue("of0", 11), s1: structValue("of1", 11) },
      });
      await b1.pushChanges({ accessToken, description: "front door 7 data" });
      assert.equal(readElementProp(b1, elementId, "s0")?.p0, "of0-p0", "the struct members were never stored");
      const before = await takeElementCensus(b1, ["TestRetry:Pipe1"]);
      const widenedSchema = structAndPipeSchema(31, "01.00.01");
      widenedSchema.classes![1].props!.push(...Array.from({ length: 40 }, (_, index): TinyPrimitiveProp => ({
        kind: "primitive",
        name: `overflow${index}`,
        type: "string",
      })));
      const widened = tinySchemaToXml(widenedSchema);

      let caughtError: unknown;
      try {
        await b1.importSchemaStrings([widened]);
      } catch (error) {
        caughtError = error;
      }
      assert.isDefined(caughtError, "the overflow transform should require an upgrade");
      assert.isTrue(SchemaSync.requiresUpgrade(caughtError));
      assert.equal((caughtError as { errorNumber?: number }).errorNumber, DbResult.BE_SQLITE_ERROR_DataTransformRequired);
      await b1.upgradeSchemaStrings([widened], { accessToken, description: "front door 7 widen into overflow" });

      const overflowIds = readOverflowElementIds(b1);
      assert.include(overflowIds, elementId, "the transformed element has no BisCore overflow row");
      expectCensusPreserved(before, await takeElementCensus(b1, ["TestRetry:Pipe1"]), "after transforming into overflow");
      assert.equal(readElementProp(b1, elementId, "name"), "overflow-preserved");
      assert.equal(readElementProp(b1, elementId, "s0")?.p10, "of0-p10", "s0 lost its members on the way into overflow");
      assert.equal(readElementProp(b1, elementId, "s1")?.p10, "of1-p10", "s1 lost its members on the way into overflow");
      assert.isFalse(b1.txns.hasLocalChanges);
    } finally {
      b1.close();
    }
  });
  it("deletes a property through upgradeSchemas and keeps the rest of the data", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "imodel-sync-itwin-4" });
    const accessToken = "schema deletion token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "schema deletion", accessToken });
    const b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "schemaDeletion" });

    try {
      await enableSchemaSync(b1, containerProps);
      // Dropping a property is a major EC change, so the read version has to go up, and on an iModel
      // only a dynamic schema may raise its read version. Connectors mark their schemas this way.
      const twoProps: TinySchema = {
        name: "TestDeletion",
        alias: "td",
        ver: "01.00.00",
        dynamic: true,
        refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
        classes: [{
          type: "entity",
          name: "Pipe1",
          baseClass: "bis:GeometricElement2d",
          props: [
            { kind: "primitive", name: "p0", type: "string" },
            { kind: "primitive", name: "p1", type: "string" },
          ],
        }],
      };
      await importSchema(b1, twoProps);
      await b1.pushChanges({ accessToken, description: "initial schema" });

      const place = await insertDrawingModelAndCategory(b1, "Deletion");
      const elementId = await insertGeometricElement2d(b1, { ...place, classFullName: "TestDeletion:Pipe1", props: { p0: "keep", p1: "delete" } });
      await b1.pushChanges({ accessToken, description: "insert data" });

      const oneProp: TinySchema = { ...twoProps, ver: "02.00.00", classes: [{ ...twoProps.classes![0], props: [{ kind: "primitive", name: "p0", type: "string" }] }] };
      let caughtError: unknown;
      try {
        await importSchema(b1, oneProp);
      } catch (err) {
        caughtError = err;
      }
      assert.isDefined(caughtError, "importing a schema that drops a property should fail");
      assert.isTrue(SchemaSync.requiresUpgrade(caughtError), "the C++ status did not survive the addon boundary");
      assert.equal((caughtError as { errorNumber?: number }).errorNumber, DbResult.BE_SQLITE_ERROR_DataDeletionRequired);

      await b1.upgradeSchemaStrings([tinySchemaToXml(oneProp)], { accessToken, description: "drop p1" });
      assert.deepEqual(queryPropNames(b1, "TestDeletion:Pipe1"), ["p0"]);
      assert.equal(readElementProp(b1, elementId, "p0"), "keep");
      assert.isUndefined(readElementProp(b1, elementId, "p1"), "p1 should be gone");
      assert.isFalse(b1.txns.hasLocalChanges, "upgradeSchemaStrings pushes the schema change");
    } finally {
      b1.close();
    }
  });

  // The empty class is still data-bearing by map strategy, even with no instances, while its sibling has data.
  // Upgrade must remove only the empty class and preserve the sibling's rows.
  extendedIt("deletes an empty class through upgradeSchemas and keeps a sibling's data", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "schema-front-door-8" });
    const accessToken = "schema front door 8 token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "schema front door 8", accessToken });
    const b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "schemaFrontDoor8b1" });

    try {
      await enableSchemaSync(b1, containerProps);
      const schemaV1: TinySchema = {
        name: "FrontDoorClassDeletion",
        alias: "fdc",
        ver: "01.00.00",
        dynamic: true,
        refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
        classes: [{
          type: "entity",
          name: "Kept",
          baseClass: "bis:GeometricElement2d",
          props: [{ kind: "primitive", name: "value", type: "string" }],
        }, {
          type: "entity",
          name: "Empty",
          baseClass: "bis:GeometricElement2d",
          props: [{ kind: "primitive", name: "unused", type: "string" }],
        }],
      };
      await importSchema(b1, schemaV1);
      await b1.pushChanges({ accessToken, description: "front door 8 initial schema" });
      const place = await insertDrawingModelAndCategory(b1, "FrontDoorClassDeletion");
      const keptId = await insertGeometricElement2d(b1, { ...place, classFullName: "FrontDoorClassDeletion:Kept", props: { value: "keep" } });
      await b1.pushChanges({ accessToken, description: "front door 8 sibling data" });
      const before = await takeElementCensus(b1, ["FrontDoorClassDeletion:Kept"]);
      const withoutEmpty: TinySchema = { ...schemaV1, ver: "02.00.00", classes: [schemaV1.classes![0]] };

      let caughtError: unknown;
      try {
        await importSchema(b1, withoutEmpty);
      } catch (error) {
        caughtError = error;
      }
      assert.isDefined(caughtError, "deleting the empty class should require an upgrade");
      assert.isTrue(SchemaSync.requiresUpgrade(caughtError));
      assert.equal((caughtError as { errorNumber?: number }).errorNumber, DbResult.BE_SQLITE_ERROR_DataDeletionRequired);
      await b1.upgradeSchemaStrings([tinySchemaToXml(withoutEmpty)], { accessToken, description: "front door 8 delete empty class" });

      expectCensusPreserved(before, await takeElementCensus(b1, ["FrontDoorClassDeletion:Kept"]), "after deleting the empty class");
      assert.equal(readElementProp(b1, keptId, "value"), "keep");
      assert.deepEqual(queryPropNames(b1, "FrontDoorClassDeletion:Kept"), ["value"]);
      assert.deepEqual(queryPropNames(b1, "FrontDoorClassDeletion:Empty"), []);
    } finally {
      b1.close();
    }
  });
  it("requiresUpgrade returns false for unrelated errors", () => {
    assert.isFalse(SchemaSync.requiresUpgrade(new Error("invalid schema")));
    assert.isFalse(SchemaSync.requiresUpgrade({ errorNumber: DbResult.BE_SQLITE_ERROR }));
  });

  // Profile upgrades use this status, while SchemaSync.requiresUpgrade is deliberately limited to data moves and deletions.
  // Keep the profile-upgrade status out of that set so callers do not take the wrong upgrade path.
  extendedIt("requiresUpgrade returns false for SchemaUpgradeRequired", () => {
    assert.isFalse(SchemaSync.requiresUpgrade({ errorNumber: DbResult.BE_SQLITE_ERROR_SchemaUpgradeRequired }));
  });

  extendedIt("enables schema sync for an existing iModel with schemas and data", async () => {
    const iTwinId = Guid.createValue();
    const accessToken = "schema enable token";

    HubMock.startup("test", KnownTestLocations.outputDir);
    const version0 = IModelTestUtils.prepareOutputFile("schemaSync", "imodel-enable.bim");
    SnapshotDb.createEmpty(version0, { rootSubject: { name: "schema enable" } }).close();
    const iModelId = await HubMock.createNewIModel({ accessToken, iTwinId, version0, iModelName: "schema enable" });
    const bcProps = await BriefcaseManager.downloadBriefcase({ iModelId, iTwinId, accessToken });
    const b1 = await BriefcaseDb.open(bcProps);

    try {
      await importSchema(b1, {
        name: "TestExisting",
        alias: "te",
        ver: "01.00.00",
        refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
        classes: [{
          type: "entity",
          name: "Pipe1",
          baseClass: "bis:GeometricElement2d",
          props: [{ kind: "primitive", name: "p0", type: "string" }],
        }],
      });
      await b1.locks.acquireLocks({ shared: IModel.dictionaryId });
      const codeProps = Code.createEmpty();
      codeProps.value = "DrawingModel";
      const [, drawingModelId] = withEditTxn(b1, (txn) => IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, codeProps, true));
      const drawingCategoryId = withEditTxn(b1, (txn) => DrawingCategory.insert(txn, IModel.dictionaryId, "ExistingCategory", new SubCategoryAppearance()));
      await b1.locks.acquireLocks({ shared: drawingModelId });
      const elementProps: TestElementProps = {
        classFullName: "TestExisting:Pipe1",
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        p0: "existing data",
      };
      const elementId = withEditTxn(b1, (txn) => txn.insertElement(elementProps));
      await b1.pushChanges({ accessToken, description: "existing schema and data" });

      const originalUserToken = AzuriteTest.userToken;
      AzuriteTest.userToken = AzuriteTest.service.userToken.admin;
      try {
        const containerProps = await SchemaSync.enableForIModel({
          iModel: b1,
          label: "SchemaSync existing data",
          description: "SchemaSync test with existing schemas and data",
        });
        assert.isTrue(SchemaSync.isEnabled(b1));
        assert.equal(SchemaSync.queryContainerProps(b1)?.containerId, containerProps.containerId);
        assert.equal(readElementProp(b1, elementId, "p0"), "existing data");
        assert.isFalse(b1.txns.hasLocalChanges, "enableForIModel pushes the initialization changeset");
      } finally {
        AzuriteTest.userToken = originalUserToken;
      }
    } finally {
      b1.close();
    }
  });

  // Enabling an existing file must mirror both physical-only shapes: link-table rows and BisCore overflow rows.
  // These are absent from the briefcase's EC metadata until initialization rebuilds the sync view.
  extendedIt("enables an existing iModel with a link table and overflow rows", async () => {
    const accessToken = "schema front door 10 token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "schema front door 10", accessToken });
    const b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "schemaFrontDoor10b1" });

    try {
      const sourceProperties: { [name: string]: any } = { stable: "source" };
      for (let index = 0; index < 40; ++index)
        sourceProperties[`overflow${index}`] = `value-${index}`;
      const schema: TinySchema = {
        name: "FrontDoorExistingShapes",
        alias: "fes",
        ver: "01.00.00",
        refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
        classes: [{
          type: "entity",
          name: "SourceElement",
          baseClass: "bis:GeometricElement2d",
          props: [
            { kind: "primitive", name: "stable", type: "string" },
            ...Array.from({ length: 40 }, (_, index): TinyPrimitiveProp => ({ kind: "primitive", name: `overflow${index}`, type: "string" })),
          ],
        }, {
          type: "entity",
          name: "TargetElement",
          baseClass: "bis:GeometricElement2d",
          props: [{ kind: "primitive", name: "targetValue", type: "string" }],
        }],
        rawXml: [`<ECRelationshipClass typeName="SourceTargets" strength="referencing" strengthDirection="forward" modifier="Sealed">
    <BaseClass>bis:ElementRefersToElements</BaseClass>
    <Source multiplicity="(0..*)" roleLabel="source" polymorphic="true" abstractConstraint="bis:GeometricElement2d">
        <Class class="SourceElement"/>
    </Source>
    <Target multiplicity="(0..*)" roleLabel="target" polymorphic="true" abstractConstraint="bis:GeometricElement2d">
        <Class class="TargetElement"/>
    </Target>
</ECRelationshipClass>`],
      };
      await importSchema(b1, schema);
      await b1.pushChanges({ accessToken, description: "front door 10 existing schema" });
      const place = await insertDrawingModelAndCategory(b1, "FrontDoorExistingShapes");
      const sourceId = await insertGeometricElement2d(b1, { ...place, classFullName: "FrontDoorExistingShapes:SourceElement", props: sourceProperties });
      const targetId = await insertGeometricElement2d(b1, { ...place, classFullName: "FrontDoorExistingShapes:TargetElement", props: { targetValue: "target" } });
      const relationshipId = withEditTxn(b1, (txn) => txn.insertRelationship({
        classFullName: "FrontDoorExistingShapes:SourceTargets",
        sourceId,
        targetId,
      }));
      assert.isNotEmpty(relationshipId);
      await b1.pushChanges({ accessToken, description: "front door 10 existing physical data" });

      const originalUserToken = AzuriteTest.userToken;
      AzuriteTest.userToken = AzuriteTest.service.userToken.admin;
      try {
        await SchemaSync.enableForIModel({ iModel: b1, label: "SchemaSync existing physical shapes" });
      } finally {
        AzuriteTest.userToken = originalUserToken;
      }

      assert.isTrue(SchemaSync.isEnabled(b1));
      assert.include(readOverflowElementIds(b1), sourceId, "the existing source element has no overflow row after enable");
      // A BisCore-derived relationship maps into bis_ElementRefersToElements rather than a table of its own.
      const linkRows = await b1.createQueryReader("SELECT ECInstanceId FROM FrontDoorExistingShapes.SourceTargets").toArray();
      assert.lengthOf(linkRows, 1, "the existing link-table row was not preserved");
      assert.isNotEmpty(readTableRows(b1, "bis_ElementRefersToElements"), "the link table lost its rows");
      assert.equal(readElementProp(b1, sourceId, "stable"), "source");
      assert.equal(readElementProp(b1, sourceId, "overflow39"), "value-39");
      assert.equal(readElementProp(b1, targetId, "targetValue"), "target");
      expectNoForeignKeyViolations(b1, "existing physical shapes after enable");
      assert.isFalse(b1.txns.hasLocalChanges);
    } finally {
      b1.close();
    }
  });

  it("revert timeline changes", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "imodel-sync-itwin-1" });
    HubMock.startup("test", KnownTestLocations.outputDir);
    const adminToken = "super manager token";
    const iModelName = "test";
    const iTwinId = HubMock.iTwinId;
    const rwIModelId = await HubMock.createNewIModel({ iTwinId, iModelName, description: "TestSubject", accessToken: adminToken });
    assert.isNotEmpty(rwIModelId);
    const b1 = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken });
    await SchemaSync.initializeForIModel({ iModel: b1, containerProps });
    const b2 = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken });
    assert.isTrue(SchemaSync.isEnabled(b1));
    assert.isTrue(SchemaSync.isEnabled(b2));

    let nProps = 0;
    // 1. Import schema with class that span overflow table.
    const addPropertyAndImportSchema = async (b: BriefcaseDb) => {
      ++nProps;
      const schema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="ts" version="01.00.${nProps}" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
        <ECEntityClass typeName="Test2dElement">
            <BaseClass>bis:GraphicalElement2d</BaseClass>
            ${Array(nProps).fill(undefined).map((_, i) => `<ECProperty propertyName="p${i + 1}" typeName="string"/>`).join("\n")}
        </ECEntityClass>
    </ECSchema>`;
      await b.importSchemaStrings([schema]);
    };
    await addPropertyAndImportSchema(b1);
    b1.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    // Create drawing model and category
    await b1.locks.acquireLocks({ shared: IModel.dictionaryId });
    const codeProps = Code.createEmpty();
    codeProps.value = "DrawingModel";
    const [, drawingModelId] = withEditTxn(b1, (txn) => IModelTestUtils.createAndInsertDrawingPartitionAndModel(txn, codeProps, true));
    let drawingCategoryId = DrawingCategory.queryCategoryIdByName(b1, IModel.dictionaryId, "MyDrawingCategory");
    if (undefined === drawingCategoryId)
      drawingCategoryId = withEditTxn(b1, (txn) => DrawingCategory.insert(txn, IModel.dictionaryId, "MyDrawingCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() })));

    await b1.pushChanges({ description: "setup category", accessToken: adminToken });

    const createEl = async (args: { [key: string]: any }) => {
      await b1.locks.acquireLocks({ exclusive: drawingModelId });
      const geomArray: Arc3d[] = [
        Arc3d.createXY(Point3d.create(0, 0), 5),
        Arc3d.createXY(Point3d.create(5, 5), 2),
        Arc3d.createXY(Point3d.create(-5, -5), 20),
      ];

      const geometryStream: GeometryStreamProps = [];
      for (const geom of geomArray) {
        const arcData = IModelJson.Writer.toIModelJson(geom);
        geometryStream.push(arcData);
      }

      const e1 = {
        classFullName: `TestDomain:Test2dElement`,
        model: drawingModelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        geom: geometryStream,
        ...args,
      };
      return withEditTxn(b1, (txn) => txn.insertElement(e1));
    };
    const updateEl = async (id: Id64String, args: { [key: string]: any }) => {
      await b1.locks.acquireLocks({ exclusive: id });
      withEditTxn(b1, (txn) => {
        const updatedElementProps = Object.assign(b1.elements.getElementProps(id), args);
        txn.updateElement(updatedElementProps);
      });
    };

    const deleteEl = async (id: Id64String) => {
      await b1.locks.acquireLocks({ exclusive: id });
      withEditTxn(b1, (txn) => txn.deleteElement(id));
    };
    const getChanges = async () => {
      return HubMock.downloadChangesets({ iModelId: rwIModelId, targetDir: path.join(KnownTestLocations.outputDir, rwIModelId, "changesets") });
    };

    const findEl = (id: Id64String, b = b1) => {
      try {
        return b.elements.getElementProps(id);
      } catch {
        return undefined;
      }
    };
    // 2. Insert a element for the class
    const el1 = await createEl({ p1: "test1" });
    const el2 = await createEl({ p1: "test2" });
    await b1.pushChanges({ description: "insert 2 elements" });

    // 3. Update the element.
    await updateEl(el1, { p1: "test3" });
    await b1.pushChanges({ description: "update element 1" });

    // 4. Delete the element.
    await deleteEl(el2);
    const el3 = await createEl({ p1: "test4" });
    await b1.pushChanges({ description: "delete element 2" });

    // 5. import schema and insert element 4 & update element 3
    await addPropertyAndImportSchema(b1);
    const el4 = await createEl({ p1: "test5", p2: "test6" });
    await updateEl(el3, { p1: "test7", p2: "test8" });
    await b1.pushChanges({ description: "import schema, insert element 4 & update element 3" });

    assert.isDefined(findEl(el1));
    assert.isUndefined(findEl(el2));
    assert.isDefined(findEl(el3));
    assert.isDefined(findEl(el4));
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    assert.deepEqual(Object.getOwnPropertyNames(b1.getMetaData("TestDomain:Test2dElement").properties), ["p1", "p2"]);
    // 6. Revert to timeline 2
    await b2.revertAndPushChanges({ toIndex: 3, description: "revert to timeline 2" });

    assert.equal((await getChanges()).at(-1)!.description, "revert to timeline 2");
    await b1.pullChanges();
    assert.isUndefined(findEl(el1));
    assert.isUndefined(findEl(el2));
    assert.isUndefined(findEl(el3));
    assert.isUndefined(findEl(el4));
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    assert.deepEqual(Object.getOwnPropertyNames(b1.getMetaData("TestDomain:Test2dElement").properties), ["p1", "p2"]);

    await b2.revertAndPushChanges({ toIndex: 7, description: "reinstate last reverted changeset" });
    assert.equal((await getChanges()).at(-1)!.description, "reinstate last reverted changeset");
    await b1.pullChanges();
    assert.isDefined(findEl(el1));
    assert.isUndefined(findEl(el2));
    assert.isDefined(findEl(el3));
    assert.isDefined(findEl(el4));
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    assert.deepEqual(Object.getOwnPropertyNames(b1.getMetaData("TestDomain:Test2dElement").properties), ["p1", "p2"]);

    await addPropertyAndImportSchema(b1);
    const el5 = await createEl({ p1: "test9", p2: "test10", p3: "test11" });
    await updateEl(el1, { p1: "test12", p2: "test13", p3: "test114" });
    await b1.pushChanges({ description: "import schema, insert element 5 & update element 1" });
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    assert.deepEqual(Object.getOwnPropertyNames(b1.getMetaData("TestDomain:Test2dElement").properties), ["p1", "p2", "p3"]);

    // skip schema changes & auto generated comment
    await b1.revertAndPushChanges({ toIndex: 2, skipSchemaChanges: true });
    assert.equal((await getChanges()).at(-1)!.description, "Reverted changes from 9 to 2 (schema changes skipped)");
    assert.isUndefined(findEl(el1));
    assert.isUndefined(findEl(el2));
    assert.isUndefined(findEl(el3));
    assert.isUndefined(findEl(el4));
    assert.isUndefined(findEl(el5));
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    assert.deepEqual(Object.getOwnPropertyNames(b1.getMetaData("TestDomain:Test2dElement").properties), ["p1", "p2", "p3"]);

    await b1.revertAndPushChanges({ toIndex: 10 });
    assert.equal((await getChanges()).at(-1)!.description, "Reverted changes from 10 to 10 (schema changes skipped)");
    assert.isDefined(findEl(el1));
    assert.isUndefined(findEl(el2));
    assert.isDefined(findEl(el3));
    assert.isDefined(findEl(el4));
    assert.isDefined(findEl(el5));
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    assert.deepEqual(Object.getOwnPropertyNames(b1.getMetaData("TestDomain:Test2dElement").properties), ["p1", "p2", "p3"]);

    // schema sync should be skip for revert
    await b2.pullChanges();
    const b3 = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken });
    assert.isTrue(SchemaSync.isEnabled(b3));

    // b2 reverts, and its schema stays put because revert skips schema changes.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    assert.deepEqual(Object.getOwnPropertyNames(b2.getMetaData("TestDomain:Test2dElement").properties), ["p1", "p2", "p3"]);
    await b2.revertAndPushChanges({ toIndex: 11 });
    assert.equal((await getChanges()).at(-1)!.description, "Reverted changes from 11 to 11 (schema changes skipped)");
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    assert.deepEqual(Object.getOwnPropertyNames(b2.getMetaData("TestDomain:Test2dElement").properties), ["p1", "p2", "p3"]);

    await b1.pullChanges();
    await addPropertyAndImportSchema(b1);
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    assert.deepEqual(Object.getOwnPropertyNames(b1.getMetaData("TestDomain:Test2dElement").properties), ["p1", "p2", "p3", "p4"]);

    // b1 has not pushed, so nobody else sees p4 yet.
    await b3.pullChanges();
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    assert.deepEqual(Object.getOwnPropertyNames(b3.getMetaData("TestDomain:Test2dElement").properties), ["p1", "p2", "p3"]);

    await b1.pushChanges({ description: "add p4" });
    await b1.pullChanges();
    await b2.pullChanges();
    await b3.pullChanges();

    assert.isUndefined(findEl(el1, b1));
    assert.isUndefined(findEl(el2, b1));
    assert.isUndefined(findEl(el3, b1));
    assert.isUndefined(findEl(el4, b1));
    assert.isUndefined(findEl(el5, b1));
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    assert.deepEqual(Object.getOwnPropertyNames(b1.getMetaData("TestDomain:Test2dElement").properties), ["p1", "p2", "p3", "p4"]);

    assert.isUndefined(findEl(el1, b2));
    assert.isUndefined(findEl(el2, b2));
    assert.isUndefined(findEl(el3, b2));
    assert.isUndefined(findEl(el4, b2));
    assert.isUndefined(findEl(el5, b2));
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    assert.deepEqual(Object.getOwnPropertyNames(b2.getMetaData("TestDomain:Test2dElement").properties), ["p1", "p2", "p3", "p4"]);

    assert.isUndefined(findEl(el1, b3));
    assert.isUndefined(findEl(el2, b3));
    assert.isUndefined(findEl(el3, b3));
    assert.isUndefined(findEl(el4, b3));
    assert.isUndefined(findEl(el5, b3));
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    assert.deepEqual(Object.getOwnPropertyNames(b3.getMetaData("TestDomain:Test2dElement").properties), ["p1", "p2", "p3", "p4"]);

    b1.close();
    b2.close();
    b3.close();
  });

  // Revert is forced to skip schema rows on a sync-enabled file, so the watching briefcase must see the
  // same retained schema and the reverted data after it pulls the new timeline changeset.
  extendedIt("reverts a schema changeset with a watching briefcase", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "schema-front-door-11" });
    const accessToken1 = "schema front door 11 user 1";
    const accessToken2 = "schema front door 11 user 2";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "schema front door 11", accessToken: accessToken1 });
    const b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken: accessToken1, cacheName: "schemaFrontDoor11b1" });
    const b2 = await openTestBriefcase({ iTwinId, iModelId, accessToken: accessToken2, cacheName: "schemaFrontDoor11b2" });

    try {
      await enableSchemaSync(b1, containerProps);
      await b2.pullChanges({ accessToken: accessToken2 });
      const schemaV1: TinySchema = {
        name: "FrontDoorRevert",
        alias: "fdr",
        ver: "01.00.00",
        refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
        classes: [{
          type: "entity",
          name: "Pipe",
          baseClass: "bis:GeometricElement2d",
          props: [{ kind: "primitive", name: "p0", type: "string" }],
        }],
      };
      await importSchema(b1, schemaV1);
      await b1.pushChanges({ accessToken: accessToken1, description: "front door 11 initial schema" });
      await b2.pullChanges({ accessToken: accessToken2 });
      const place = await insertDrawingModelAndCategory(b1, "FrontDoorRevert");
      const firstElementId = await insertGeometricElement2d(b1, { ...place, classFullName: "FrontDoorRevert:Pipe", props: { p0: "retained" } });
      await b1.pushChanges({ accessToken: accessToken1, description: "front door 11 first data" });
      await b2.pullChanges({ accessToken: accessToken2 });

      const schemaV2: TinySchema = {
        ...schemaV1,
        ver: "01.00.01",
        classes: [{ ...schemaV1.classes![0], props: [
          ...schemaV1.classes![0].props!,
          { kind: "primitive", name: "p1", type: "string" },
        ] }],
      };
      await importSchema(b1, schemaV2);
      const secondElementId = await insertGeometricElement2d(b1, { ...place, classFullName: "FrontDoorRevert:Pipe", props: { p0: "reverted", p1: "reverted" } });
      await b1.pushChanges({ accessToken: accessToken1, description: "front door 11 schema and second data" });
      await b2.pullChanges({ accessToken: accessToken2 });
      assert.deepEqual(queryPropNames(b2, "FrontDoorRevert:Pipe"), ["p0", "p1"]);
      assert.equal(readElementProp(b2, secondElementId, "p1"), "reverted");

      const latestIndex = b1.changeset.index!;
      await b1.revertAndPushChanges({ toIndex: latestIndex, accessToken: accessToken1, description: "front door 11 revert schema changeset" });
      await b2.pullChanges({ accessToken: accessToken2 });

      for (const briefcase of [b1, b2]) {
        assert.deepEqual(queryPropNames(briefcase, "FrontDoorRevert:Pipe"), ["p0", "p1"]);
        assert.equal(readElementProp(briefcase, firstElementId, "p0"), "retained");
        assert.isUndefined(readElementProp(briefcase, secondElementId, "p1"));
        expectNoForeignKeyViolations(briefcase, "after reverting the schema changeset");
      }
      expectMetadataTablesIdentical(b1, b2, "after the watching briefcase pulled the revert", { a: "reverter", b: "watcher" });
      expectCacheTablesIdentical(b1, b2, "after the watching briefcase pulled the revert", { a: "reverter", b: "watcher" });
      expectPhysicalSchemaIdentical(b1, b2, "after the watching briefcase pulled the revert");
    } finally {
      b2.close();
      b1.close();
    }
  });

  // A revert on a schema-sync-enabled iModel is downgraded to data only: revertAndPushChanges forces
  // skipSchemaChanges on regardless of what the caller asked for, and RevertChangesArgs types the
  // flag as `true | undefined` so a caller cannot even ask for the other behaviour. Nothing rewinds
  // the sync db, which is why the schema half has to stay put - the briefcase would otherwise end up
  // behind an authority that still describes the schema it just dropped.
  extendedIt("a revert on a schema sync iModel keeps the schema and leaves the sync db alone", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "schema-front-door-12" });
    const accessToken = "schema front door 12 user";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "schema front door 12", accessToken });
    const b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "schemaFrontDoor12b1" });

    try {
      await enableSchemaSync(b1, containerProps);
      const schemaV1: TinySchema = {
        name: "FrontDoorRevertSkip",
        alias: "fdrs",
        ver: "01.00.00",
        refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
        classes: [{
          type: "entity",
          name: "Pipe",
          baseClass: "bis:GeometricElement2d",
          props: [{ kind: "primitive", name: "p0", type: "string" }],
        }],
      };
      await importSchema(b1, schemaV1);
      await b1.pushChanges({ accessToken, description: "front door 12 initial schema" });
      const place = await insertDrawingModelAndCategory(b1, "FrontDoorRevertSkip");
      const firstElementId = await insertGeometricElement2d(b1, { ...place, classFullName: "FrontDoorRevertSkip:Pipe", props: { p0: "retained" } });
      await b1.pushChanges({ accessToken, description: "front door 12 first data" });

      // A schema change and a data change that depends on it.
      await importSchema(b1, {
        ...schemaV1,
        ver: "01.00.01",
        classes: [{ ...schemaV1.classes![0], props: [
          { kind: "primitive", name: "p0", type: "string" },
          { kind: "primitive", name: "p1", type: "string" },
        ] }],
      });
      const secondElementId = await insertGeometricElement2d(b1, { ...place, classFullName: "FrontDoorRevertSkip:Pipe", props: { p0: "kept", p1: "reverted" } });
      await b1.pushChanges({ accessToken, description: "front door 12 schema and data" });
      const indexOfTheSecondRound = b1.changeset.index!;

      const dataVerBeforeRevert = querySchemaSyncDataVer(b1);
      assert.deepEqual(queryPropNames(b1, "FrontDoorRevertSkip:Pipe"), ["p0", "p1"]);

      // No skipSchemaChanges and no description, so the default request is "revert everything" and
      // the auto-generated description reports what actually happened.
      await b1.revertAndPushChanges({ toIndex: indexOfTheSecondRound, accessToken });

      const latest = await HubMock.getLatestChangeset({ iModelId });
      expect(latest.description).to.contain("schema changes skipped",
        "the revert did not report skipping the schema half, so the override may have stopped happening");

      assert.deepEqual(queryPropNames(b1, "FrontDoorRevertSkip:Pipe"), ["p0", "p1"],
        "the schema was reverted, which would leave the briefcase behind a sync db that still describes p1");
      assert.equal(readElementProp(b1, firstElementId, "p0"), "retained");
      assert.isUndefined(readElementProp(b1, secondElementId, "p0"), "the data half of the revert did not happen");
      assert.equal(querySchemaSyncDataVer(b1), dataVerBeforeRevert, "the revert moved the schema sync data version");
      expectNoForeignKeyViolations(b1, "after a revert that skipped the schema half");
    } finally {
      b1.close();
    }
  });
});
