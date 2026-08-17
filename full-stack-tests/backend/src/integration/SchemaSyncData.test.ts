/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*---------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Suite } from "mocha";
import { BriefcaseDb, IModelDb, IModelHost } from "@itwin/core-backend";
import { HubMock } from "@itwin/core-backend/lib/cjs/internal/HubMock";
import { withEditTxn } from "@itwin/core-backend/lib/cjs/test";
import { DbResult } from "@itwin/core-bentley";
import {
  createTestIModel, enableSchemaSync, expectCacheTablesIdentical, expectCensusPreserved, expectMetadataTablesIdentical, expectNoForeignKeyViolations,
  expectPhysicalSchemaIdentical, importTinySchema, initializeContainer, insertDrawingModelAndCategory, insertGeometricElement2d, openTestBriefcase,
  queryPropNames, readElementProp, takeElementCensus,
  TinyPrimitiveProp, TinySchema, tinySchemaToXml,
} from "./SchemaSyncTestUtils";
import "./StartupShutdown"; // calls startup/shutdown IModelHost before/after all tests
import { AzuriteTest } from "./AzuriteTest";

describe("Schema synchronization data", function (this: Suite) {
  this.timeout(0);

  before(async () => {
    IModelHost.authorizationClient = new AzuriteTest.AuthorizationClient();
    AzuriteTest.userToken = AzuriteTest.service.userToken.readWrite;
  });

  after(async () => {
    IModelHost.authorizationClient = undefined;
  });

  afterEach(() => {
    if (HubMock.isValid)
      HubMock.shutdown();
  });

  const bisCoreRef = { name: "BisCore", ver: "01.00.00", alias: "bis" };

  // A GeometricElement2d subclass whose properties outgrow the shared column budget spills into
  // BisCore's overflow table, so pre-existing rows need an overflow row written for them.
  const geometricElement2dOverflowTable = "bis_GeometricElement2d_Overflow";

  const readOverflowElementIds = (db: IModelDb, tableName: string): string[] => {
    let tableExists = false;
    db.withPreparedSqliteStatement(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`, (stmt) => {
      stmt.bindString(1, tableName);
      tableExists = stmt.step() === DbResult.BE_SQLITE_ROW;
    });
    assert.isTrue(tableExists, `${tableName} does not exist, so nothing spilled`);

    const elementIds: string[] = [];
    db.withPreparedSqliteStatement(`SELECT ElementId FROM [${tableName}]`, (stmt) => {
      while (stmt.step() === DbResult.BE_SQLITE_ROW)
        elementIds.push(stmt.getValue(0).getId());
    });
    return elementIds;
  };

  const makeStringProperties = (count: number, prefix = "p"): TinyPrimitiveProp[] => Array.from({ length: count }, (_, i) => ({
    kind: "primitive",
    name: `${prefix}${i}`,
    type: "string",
  }));

  it("data survives a property added through the sync db", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "sync-data-1" });
    const accessToken = "sync data 1 token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "sync data 1", accessToken });
    let b1: BriefcaseDb | undefined;

    try {
      b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncData1b1" });
      await enableSchemaSync(b1, containerProps);

      const schemaV1: TinySchema = {
        name: "SchemaSyncDataAdd",
        alias: "ssda",
        ver: "01.00.00",
        refs: [bisCoreRef],
        classes: [{
          type: "entity",
          name: "DataElement",
          baseClass: "bis:GeometricElement2d",
          props: [
            { kind: "primitive", name: "stableText", type: "string" },
            { kind: "primitive", name: "stableNumber", type: "int" },
          ],
        }],
      };
      await importTinySchema(b1, schemaV1);
      await b1.pushChanges({ accessToken, description: "initial data schema" });

      const place = await insertDrawingModelAndCategory(b1, "SyncDataAdd");
      const elementIds = [
        await insertGeometricElement2d(b1, { ...place, classFullName: "SchemaSyncDataAdd:DataElement", props: { stableText: "first", stableNumber: 1 } }),
        await insertGeometricElement2d(b1, { ...place, classFullName: "SchemaSyncDataAdd:DataElement", props: { stableText: "second", stableNumber: 2 } }),
        await insertGeometricElement2d(b1, { ...place, classFullName: "SchemaSyncDataAdd:DataElement", props: { stableText: "third", stableNumber: 3 } }),
      ];
      await b1.pushChanges({ accessToken, description: "insert data" });

      const before = await takeElementCensus(b1, ["SchemaSyncDataAdd:DataElement"]);
      const schemaV2: TinySchema = {
        ...schemaV1,
        ver: "01.00.01",
        classes: [{ ...schemaV1.classes![0], props: [...schemaV1.classes![0].props!, { kind: "primitive", name: "addedText", type: "string" }] }],
      };
      await importTinySchema(b1, schemaV2);
      const after = await takeElementCensus(b1, ["SchemaSyncDataAdd:DataElement"]);

      expectCensusPreserved(before, after, "after adding a property");
      for (const [index, elementId] of elementIds.entries()) {
        assert.equal(readElementProp(b1, elementId, "stableText"), ["first", "second", "third"][index]);
        assert.equal(readElementProp(b1, elementId, "stableNumber"), index + 1);
        assert.isUndefined(readElementProp(b1, elementId, "addedText"));
      }
      await b1.pushChanges({ accessToken, description: "add property" });
    } finally {
      b1?.close();
    }
  });

  // Several schema/data rounds force each schema rebuild to consume the current ec_ rows, exposing defects that only appear after a later rebuild.
  it("data survives several sequential schema changes with data between them #extended", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "sync-data-6" });
    const accessToken = "sync data 6 token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "sync data 6", accessToken });
    let b1: BriefcaseDb | undefined;

    try {
      b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncData6b1" });
      await enableSchemaSync(b1, containerProps);

      const schemaV1: TinySchema = {
        name: "SchemaSyncDataRounds",
        alias: "ssdr",
        ver: "01.00.00",
        refs: [bisCoreRef],
        classes: [{
          type: "entity",
          name: "DataElement",
          baseClass: "bis:GeometricElement2d",
          props: [
            { kind: "primitive", name: "stableText", type: "string" },
            { kind: "primitive", name: "stableNumber", type: "int" },
          ],
        }],
      };
      await importTinySchema(b1, schemaV1);
      await b1.pushChanges({ accessToken, description: "initial rounds schema" });

      const place = await insertDrawingModelAndCategory(b1, "SyncDataRounds");
      await insertGeometricElement2d(b1, {
        ...place,
        classFullName: "SchemaSyncDataRounds:DataElement",
        props: { stableText: "round zero", stableNumber: 0 },
      });
      await b1.pushChanges({ accessToken, description: "insert initial rounds data" });

      const schemaV2: TinySchema = {
        ...schemaV1,
        ver: "01.00.01",
        classes: [{ ...schemaV1.classes![0], props: [...schemaV1.classes![0].props!, { kind: "primitive", name: "roundOneText", type: "string" }] }],
      };
      const schemaV3: TinySchema = {
        ...schemaV2,
        ver: "01.00.02",
        classes: [{ ...schemaV2.classes![0], props: [...schemaV2.classes![0].props!, { kind: "primitive", name: "roundTwoText", type: "string" }] }],
      };
      const schemaV4: TinySchema = {
        ...schemaV3,
        ver: "01.00.03",
        classes: [{ ...schemaV3.classes![0], props: [...schemaV3.classes![0].props!, { kind: "primitive", name: "roundThreeText", type: "string" }] }],
      };
      const rounds = [
        { schema: schemaV2, propertyName: "roundOneText", propertyValue: "round one" },
        { schema: schemaV3, propertyName: "roundTwoText", propertyValue: "round two" },
        { schema: schemaV4, propertyName: "roundThreeText", propertyValue: "round three" },
      ];
      let before = await takeElementCensus(b1, ["SchemaSyncDataRounds:DataElement"]);
      for (const [index, round] of rounds.entries()) {
        await importTinySchema(b1, round.schema);
        const after = await takeElementCensus(b1, ["SchemaSyncDataRounds:DataElement"]);
        expectCensusPreserved(before, after, `after sequential schema round ${index + 1}`);
        await insertGeometricElement2d(b1, {
          ...place,
          classFullName: "SchemaSyncDataRounds:DataElement",
          props: { stableText: `round ${index + 1}`, stableNumber: index + 1, [round.propertyName]: round.propertyValue },
        });
        await b1.pushChanges({ accessToken, description: `insert data after round ${index + 1}` });
        before = await takeElementCensus(b1, ["SchemaSyncDataRounds:DataElement"]);
      }
      assert.include(queryPropNames(b1, "SchemaSyncDataRounds:DataElement"), "roundThreeText");
    } finally {
      b1?.close();
    }
  });

  it("data survives on a briefcase that only pulls", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "sync-data-2" });
    const writerToken = "sync data 2 writer token";
    const readerToken = "sync data 2 reader token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "sync data 2", accessToken: writerToken });
    let b1: BriefcaseDb | undefined;
    let b2: BriefcaseDb | undefined;

    try {
      b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken: writerToken, cacheName: "syncData2b1" });
      b2 = await openTestBriefcase({ iTwinId, iModelId, accessToken: readerToken, cacheName: "syncData2b2" });
      await enableSchemaSync(b1, containerProps);

      const schemaV1: TinySchema = {
        name: "SchemaSyncDataPull",
        alias: "ssdp",
        ver: "01.00.00",
        refs: [bisCoreRef],
        classes: [{
          type: "entity",
          name: "DataElement",
          baseClass: "bis:GeometricElement2d",
          props: [{ kind: "primitive", name: "stableText", type: "string" }],
        }],
      };
      await importTinySchema(b1, schemaV1);
      await b1.pushChanges({ accessToken: writerToken, description: "initial pull schema" });
      await b2.pullChanges({ accessToken: readerToken });

      const place = await insertDrawingModelAndCategory(b1, "SyncDataPull");
      const elementIds = [
        await insertGeometricElement2d(b1, { ...place, classFullName: "SchemaSyncDataPull:DataElement", props: { stableText: "pulled first" } }),
        await insertGeometricElement2d(b1, { ...place, classFullName: "SchemaSyncDataPull:DataElement", props: { stableText: "pulled second" } }),
      ];
      await b1.pushChanges({ accessToken: writerToken, description: "insert pull data" });
      await b2.pullChanges({ accessToken: readerToken });

      const beforeB1 = await takeElementCensus(b1, ["SchemaSyncDataPull:DataElement"]);
      const beforeB2 = await takeElementCensus(b2, ["SchemaSyncDataPull:DataElement"]);
      const schemaV2: TinySchema = {
        ...schemaV1,
        ver: "01.00.01",
        classes: [{ ...schemaV1.classes![0], props: [...schemaV1.classes![0].props!, { kind: "primitive", name: "addedText", type: "string" }] }],
      };
      await importTinySchema(b1, schemaV2);
      await b1.pushChanges({ accessToken: writerToken, description: "add pulled property" });

      const beforeSchemaPullB2 = await takeElementCensus(b2, ["SchemaSyncDataPull:DataElement"]);
      await b2.pullChanges({ accessToken: readerToken });
      const afterB1 = await takeElementCensus(b1, ["SchemaSyncDataPull:DataElement"]);
      const afterB2 = await takeElementCensus(b2, ["SchemaSyncDataPull:DataElement"]);

      expectCensusPreserved(beforeB1, afterB1, "on the importing briefcase");
      expectCensusPreserved(beforeB2, afterB2, "on the pulling briefcase");
      expectCensusPreserved(beforeSchemaPullB2, afterB2, "across the pulling schema changeset");
      for (const elementId of elementIds) {
        assert.isUndefined(readElementProp(b1, elementId, "addedText"));
        assert.isUndefined(readElementProp(b2, elementId, "addedText"));
      }
      expectMetadataTablesIdentical(b1, b2, "after the pulling briefcase materializes the schema", { a: "b1", b: "b2" });
    } finally {
      b2?.close();
      b1?.close();
    }
  });

  // The late briefcase must materialize every historical schema change from the timeline, rather than relying on a table it rebuilt after each pull.
  it("data survives on a fresh briefcase downloaded after all schema changes #extended", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "sync-data-7" });
    const writerToken = "sync data 7 writer token";
    const readerToken = "sync data 7 reader token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "sync data 7", accessToken: writerToken });
    let b1: BriefcaseDb | undefined;
    let b2: BriefcaseDb | undefined;

    try {
      b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken: writerToken, cacheName: "syncData7b1" });
      await enableSchemaSync(b1, containerProps);

      const schemaV1: TinySchema = {
        name: "SchemaSyncDataFreshPull",
        alias: "ssdfp",
        ver: "01.00.00",
        refs: [bisCoreRef],
        classes: [{
          type: "entity",
          name: "DataElement",
          baseClass: "bis:GeometricElement2d",
          props: [{ kind: "primitive", name: "stableText", type: "string" }],
        }],
      };
      await importTinySchema(b1, schemaV1);
      await b1.pushChanges({ accessToken: writerToken, description: "initial fresh pull schema" });
      const place = await insertDrawingModelAndCategory(b1, "SyncDataFreshPull");
      await insertGeometricElement2d(b1, { ...place, classFullName: "SchemaSyncDataFreshPull:DataElement", props: { stableText: "fresh first" } });
      await insertGeometricElement2d(b1, { ...place, classFullName: "SchemaSyncDataFreshPull:DataElement", props: { stableText: "fresh second" } });
      await b1.pushChanges({ accessToken: writerToken, description: "insert fresh pull data" });

      const schemaV2: TinySchema = {
        ...schemaV1,
        ver: "01.00.01",
        classes: [{ ...schemaV1.classes![0], props: [...schemaV1.classes![0].props!, { kind: "primitive", name: "firstAddedText", type: "string" }] }],
      };
      await importTinySchema(b1, schemaV2);
      await b1.pushChanges({ accessToken: writerToken, description: "add first fresh pull property" });
      await insertGeometricElement2d(b1, {
        ...place,
        classFullName: "SchemaSyncDataFreshPull:DataElement",
        props: { stableText: "fresh third", firstAddedText: "first added" },
      });
      await b1.pushChanges({ accessToken: writerToken, description: "insert after first fresh pull schema" });

      const schemaV3: TinySchema = {
        ...schemaV2,
        ver: "01.00.02",
        classes: [{ ...schemaV2.classes![0], props: [...schemaV2.classes![0].props!, { kind: "primitive", name: "secondAddedText", type: "string" }] }],
      };
      await importTinySchema(b1, schemaV3);
      await b1.pushChanges({ accessToken: writerToken, description: "add second fresh pull property" });
      await insertGeometricElement2d(b1, {
        ...place,
        classFullName: "SchemaSyncDataFreshPull:DataElement",
        props: { stableText: "fresh fourth", firstAddedText: "first added again", secondAddedText: "second added" },
      });
      await b1.pushChanges({ accessToken: writerToken, description: "insert after second fresh pull schema" });

      const beforeB1 = await takeElementCensus(b1, ["SchemaSyncDataFreshPull:DataElement"]);
      b2 = await openTestBriefcase({ iTwinId, iModelId, accessToken: readerToken, cacheName: "syncData7b2" });
      const afterB2 = await takeElementCensus(b2, ["SchemaSyncDataFreshPull:DataElement"]);
      expectCensusPreserved(beforeB1, afterB2, "on the fresh briefcase downloaded from the timeline");
      assert.include(queryPropNames(b2, "SchemaSyncDataFreshPull:DataElement"), "secondAddedText");
      expectMetadataTablesIdentical(b1, b2, "after the fresh briefcase materializes all schema changes", { a: "b1", b: "fresh b2" });
      expectCacheTablesIdentical(b1, b2, "after the fresh briefcase materializes all schema changes", { a: "b1", b: "fresh b2" });
      expectPhysicalSchemaIdentical(b1, b2, "after the fresh briefcase materializes all schema changes");
      expectNoForeignKeyViolations(b2, "fresh briefcase after materializing all schema changes");
    } finally {
      b2?.close();
      b1?.close();
    }
  });

  it("data survives properties spilling to the overflow table", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "sync-data-3" });
    const writerToken = "sync data 3 writer token";
    const readerToken = "sync data 3 reader token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "sync data 3", accessToken: writerToken });
    let b1: BriefcaseDb | undefined;
    let b2: BriefcaseDb | undefined;

    try {
      b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken: writerToken, cacheName: "syncData3b1" });
      b2 = await openTestBriefcase({ iTwinId, iModelId, accessToken: readerToken, cacheName: "syncData3b2" });
      await enableSchemaSync(b1, containerProps);

      const schemaV1: TinySchema = {
        name: "SchemaSyncDataOverflow",
        alias: "ssdo",
        ver: "01.00.00",
        refs: [bisCoreRef],
        classes: [{
          type: "entity",
          name: "DataElement",
          baseClass: "bis:GeometricElement2d",
          props: [{ kind: "primitive", name: "stableText", type: "string" }],
        }],
      };
      await importTinySchema(b1, schemaV1);
      await b1.pushChanges({ accessToken: writerToken, description: "initial overflow schema" });
      await b2.pullChanges({ accessToken: readerToken });

      const place = await insertDrawingModelAndCategory(b1, "SyncDataOverflow");
      const elementIds = [
        await insertGeometricElement2d(b1, { ...place, classFullName: "SchemaSyncDataOverflow:DataElement", props: { stableText: "overflow first" } }),
        await insertGeometricElement2d(b1, { ...place, classFullName: "SchemaSyncDataOverflow:DataElement", props: { stableText: "overflow second" } }),
        await insertGeometricElement2d(b1, { ...place, classFullName: "SchemaSyncDataOverflow:DataElement", props: { stableText: "overflow third" } }),
      ];
      await b1.pushChanges({ accessToken: writerToken, description: "insert overflow data" });
      await b2.pullChanges({ accessToken: readerToken });

      const beforeB1 = await takeElementCensus(b1, ["SchemaSyncDataOverflow:DataElement"]);
      const beforeB2 = await takeElementCensus(b2, ["SchemaSyncDataOverflow:DataElement"]);
      const schemaV2: TinySchema = {
        ...schemaV1,
        ver: "01.00.01",
        classes: [{ ...schemaV1.classes![0], props: [...schemaV1.classes![0].props!, ...makeStringProperties(40, "overflowProp")] }],
      };
      await importTinySchema(b1, schemaV2);
      const overflowOnB1 = readOverflowElementIds(b1, geometricElement2dOverflowTable);
      assert.sameMembers(overflowOnB1.filter((id) => elementIds.includes(id)), elementIds, `the importer wrote no overflow rows for its existing elements`);
      await b1.pushChanges({ accessToken: writerToken, description: "spill properties to overflow" });

      await b2.pullChanges({ accessToken: readerToken });
      const afterB1 = await takeElementCensus(b1, ["SchemaSyncDataOverflow:DataElement"]);
      const afterB2 = await takeElementCensus(b2, ["SchemaSyncDataOverflow:DataElement"]);
      const overflowOnB2 = readOverflowElementIds(b2, geometricElement2dOverflowTable);

      expectCensusPreserved(beforeB1, afterB1, "on the overflow importer");
      expectCensusPreserved(beforeB2, afterB2, "on the overflow pulling briefcase");
      assert.sameMembers(overflowOnB2.filter((id) => elementIds.includes(id)), elementIds, `the pulling briefcase wrote no overflow rows for its existing elements`);
      for (const [index, elementId] of elementIds.entries())
        assert.equal(readElementProp(b2, elementId, "stableText"), ["overflow first", "overflow second", "overflow third"][index]);
    } finally {
      b2?.close();
      b1?.close();
    }
  });

  // A second spill must update an overflow table that already contains rows, and the puller rebuilds it only after applying the schema changeset.
  it("data survives a second spill round on the briefcase that only pulls #extended", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "sync-data-8" });
    const writerToken = "sync data 8 writer token";
    const readerToken = "sync data 8 reader token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "sync data 8", accessToken: writerToken });
    let b1: BriefcaseDb | undefined;
    let b2: BriefcaseDb | undefined;

    try {
      b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken: writerToken, cacheName: "syncData8b1" });
      b2 = await openTestBriefcase({ iTwinId, iModelId, accessToken: readerToken, cacheName: "syncData8b2" });
      await enableSchemaSync(b1, containerProps);

      const schemaV1: TinySchema = {
        name: "SchemaSyncDataOverflowTwice",
        alias: "ssdtw",
        ver: "01.00.00",
        refs: [bisCoreRef],
        classes: [{
          type: "entity",
          name: "DataElement",
          baseClass: "bis:GeometricElement2d",
          props: [{ kind: "primitive", name: "stableText", type: "string" }],
        }],
      };
      await importTinySchema(b1, schemaV1);
      await b1.pushChanges({ accessToken: writerToken, description: "initial second spill schema" });
      await b2.pullChanges({ accessToken: readerToken });

      const place = await insertDrawingModelAndCategory(b1, "SyncDataOverflowTwice");
      const elementIds = [
        await insertGeometricElement2d(b1, { ...place, classFullName: "SchemaSyncDataOverflowTwice:DataElement", props: { stableText: "twice first" } }),
        await insertGeometricElement2d(b1, { ...place, classFullName: "SchemaSyncDataOverflowTwice:DataElement", props: { stableText: "twice second" } }),
      ];
      await b1.pushChanges({ accessToken: writerToken, description: "insert second spill data" });
      await b2.pullChanges({ accessToken: readerToken });

      const schemaV2: TinySchema = {
        ...schemaV1,
        ver: "01.00.01",
        classes: [{ ...schemaV1.classes![0], props: [...schemaV1.classes![0].props!, ...makeStringProperties(40, "firstSpillProp")] }],
      };
      const beforeB1FirstSpill = await takeElementCensus(b1, ["SchemaSyncDataOverflowTwice:DataElement"]);
      const beforeB2FirstSpill = await takeElementCensus(b2, ["SchemaSyncDataOverflowTwice:DataElement"]);
      await importTinySchema(b1, schemaV2);
      const afterB1FirstSpill = await takeElementCensus(b1, ["SchemaSyncDataOverflowTwice:DataElement"]);
      expectCensusPreserved(beforeB1FirstSpill, afterB1FirstSpill, "on the first spill importer");
      assert.sameMembers(readOverflowElementIds(b1, geometricElement2dOverflowTable).filter((id) => elementIds.includes(id)), elementIds);
      await b1.pushChanges({ accessToken: writerToken, description: "first spill for second spill test" });
      await b2.pullChanges({ accessToken: readerToken });
      const afterB1FirstSpillPush = await takeElementCensus(b1, ["SchemaSyncDataOverflowTwice:DataElement"]);
      const afterB2FirstSpill = await takeElementCensus(b2, ["SchemaSyncDataOverflowTwice:DataElement"]);
      expectCensusPreserved(beforeB1FirstSpill, afterB1FirstSpillPush, "after the first spill changeset");
      expectCensusPreserved(beforeB2FirstSpill, afterB2FirstSpill, "on the first spill pull");
      assert.sameMembers(readOverflowElementIds(b2, geometricElement2dOverflowTable).filter((id) => elementIds.includes(id)), elementIds);

      const schemaV3: TinySchema = {
        ...schemaV2,
        ver: "01.00.02",
        classes: [{ ...schemaV2.classes![0], props: [...schemaV2.classes![0].props!, ...makeStringProperties(40, "secondSpillProp")] }],
      };
      const beforeB1SecondSpill = await takeElementCensus(b1, ["SchemaSyncDataOverflowTwice:DataElement"]);
      const beforeB2SecondSpill = await takeElementCensus(b2, ["SchemaSyncDataOverflowTwice:DataElement"]);
      await importTinySchema(b1, schemaV3);
      const afterB1SecondSpill = await takeElementCensus(b1, ["SchemaSyncDataOverflowTwice:DataElement"]);
      expectCensusPreserved(beforeB1SecondSpill, afterB1SecondSpill, "on the second spill importer");
      assert.sameMembers(readOverflowElementIds(b1, geometricElement2dOverflowTable).filter((id) => elementIds.includes(id)), elementIds);
      await b1.pushChanges({ accessToken: writerToken, description: "second spill for second spill test" });
      await b2.pullChanges({ accessToken: readerToken });
      const afterB1SecondSpillPush = await takeElementCensus(b1, ["SchemaSyncDataOverflowTwice:DataElement"]);
      const afterB2SecondSpill = await takeElementCensus(b2, ["SchemaSyncDataOverflowTwice:DataElement"]);
      expectCensusPreserved(beforeB1SecondSpill, afterB1SecondSpillPush, "after the second spill changeset");
      expectCensusPreserved(beforeB2SecondSpill, afterB2SecondSpill, "on the second spill pull");
      assert.sameMembers(readOverflowElementIds(b1, geometricElement2dOverflowTable).filter((id) => elementIds.includes(id)), elementIds);
      assert.sameMembers(readOverflowElementIds(b2, geometricElement2dOverflowTable).filter((id) => elementIds.includes(id)), elementIds);
      expectMetadataTablesIdentical(b1, b2, "after the second spill pull", { a: "b1", b: "b2" });
      expectCacheTablesIdentical(b1, b2, "after the second spill pull", { a: "b1", b: "b2" });
      expectNoForeignKeyViolations(b2, "after the second spill pull");
    } finally {
      b2?.close();
      b1?.close();
    }
  });

  it("data survives a schema change that adds a class and a relationship", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "sync-data-4" });
    const accessToken = "sync data 4 token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "sync data 4", accessToken });
    let b1: BriefcaseDb | undefined;

    try {
      b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncData4b1" });
      await enableSchemaSync(b1, containerProps);

      const schemaV1: TinySchema = {
        name: "SchemaSyncDataRelationship",
        alias: "ssdr",
        ver: "01.00.00",
        refs: [bisCoreRef],
        classes: [{
          type: "entity",
          name: "DataElement",
          baseClass: "bis:GeometricElement2d",
          props: [{ kind: "primitive", name: "stableText", type: "string" }],
        }],
      };
      await importTinySchema(b1, schemaV1);
      await b1.pushChanges({ accessToken, description: "initial relationship schema" });

      const place = await insertDrawingModelAndCategory(b1, "SyncDataRelationship");
      const elementId = await insertGeometricElement2d(b1, {
        ...place,
        classFullName: "SchemaSyncDataRelationship:DataElement",
        props: { stableText: "relationship data" },
      });
      await b1.pushChanges({ accessToken, description: "insert relationship data" });
      const before = await takeElementCensus(b1, ["SchemaSyncDataRelationship:DataElement"]);

      const schemaV2: TinySchema = {
        ...schemaV1,
        ver: "01.00.01",
        classes: [{
          ...schemaV1.classes![0],
          props: [
            ...schemaV1.classes![0].props!,
            { kind: "navigation", name: "relatedElement", relationship: "DataElementRelatesToElement", direction: "Forward" },
          ],
        }, {
          type: "entity",
          name: "RelatedElement",
          baseClass: "bis:GeometricElement2d",
          props: [{ kind: "primitive", name: "description", type: "string" }],
        }],
        rawXml: [`<ECRelationshipClass typeName="DataElementRelatesToElement" strength="referencing" strengthDirection="forward" modifier="Sealed">
    <Source multiplicity="(0..*)" roleLabel="source" polymorphic="true">
        <Class class="DataElement"/>
    </Source>
    <Target multiplicity="(0..1)" roleLabel="target" polymorphic="true">
        <Class class="RelatedElement"/>
    </Target>
</ECRelationshipClass>`],
      };
      await importTinySchema(b1, schemaV2);
      const after = await takeElementCensus(b1, ["SchemaSyncDataRelationship:DataElement"]);

      expectCensusPreserved(before, after, "after adding a class and relationship");
      assert.include(queryPropNames(b1, "SchemaSyncDataRelationship:DataElement"), "relatedElement");
      assert.equal(readElementProp(b1, elementId, "stableText"), "relationship data");
      assert.isUndefined(readElementProp(b1, elementId, "relatedElement"));
      await b1.pushChanges({ accessToken, description: "add class and relationship" });
    } finally {
      b1?.close();
    }
  });

  // Link tables add a physical table and foreign keys instead of a navigation column, so populated endpoints exercise a different rebuild path.
  it("data survives a link-table relationship added to populated classes #extended", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "sync-data-9" });
    const writerToken = "sync data 9 writer token";
    const readerToken = "sync data 9 reader token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "sync data 9", accessToken: writerToken });
    let b1: BriefcaseDb | undefined;
    let b2: BriefcaseDb | undefined;

    try {
      b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken: writerToken, cacheName: "syncData9b1" });
      b2 = await openTestBriefcase({ iTwinId, iModelId, accessToken: readerToken, cacheName: "syncData9b2" });
      await enableSchemaSync(b1, containerProps);

      const schemaV1: TinySchema = {
        name: "SchemaSyncDataLinkTable",
        alias: "ssdl",
        ver: "01.00.00",
        refs: [bisCoreRef],
        classes: [{
          type: "entity",
          name: "DataElement",
          baseClass: "bis:GeometricElement2d",
          props: [{ kind: "primitive", name: "stableText", type: "string" }],
        }, {
          type: "entity",
          name: "RelatedElement",
          baseClass: "bis:GeometricElement2d",
          props: [{ kind: "primitive", name: "description", type: "string" }],
        }],
      };
      await importTinySchema(b1, schemaV1);
      await b1.pushChanges({ accessToken: writerToken, description: "initial link table schema" });
      await b2.pullChanges({ accessToken: readerToken });

      const place = await insertDrawingModelAndCategory(b1, "SyncDataLinkTable");
      const sourceId = await insertGeometricElement2d(b1, {
        ...place,
        classFullName: "SchemaSyncDataLinkTable:DataElement",
        props: { stableText: "link source" },
      });
      const targetId = await insertGeometricElement2d(b1, {
        ...place,
        classFullName: "SchemaSyncDataLinkTable:RelatedElement",
        props: { description: "link target" },
      });
      await b1.pushChanges({ accessToken: writerToken, description: "insert link endpoints" });
      await b2.pullChanges({ accessToken: readerToken });

      const beforeB1 = await takeElementCensus(b1, ["SchemaSyncDataLinkTable:DataElement", "SchemaSyncDataLinkTable:RelatedElement"]);
      const beforeB2 = await takeElementCensus(b2, ["SchemaSyncDataLinkTable:DataElement", "SchemaSyncDataLinkTable:RelatedElement"]);
      const schemaV2: TinySchema = {
        ...schemaV1,
        ver: "01.00.01",
        rawXml: [`<ECRelationshipClass typeName="DataElementLinksToRelated" strength="referencing" strengthDirection="forward" modifier="Sealed">
    <BaseClass>bis:ElementRefersToElements</BaseClass>
    <Source multiplicity="(0..*)" roleLabel="source" polymorphic="true">
        <Class class="DataElement"/>
    </Source>
    <Target multiplicity="(0..*)" roleLabel="target" polymorphic="true">
        <Class class="RelatedElement"/>
    </Target>
</ECRelationshipClass>`],
      };
      await importTinySchema(b1, schemaV2);
      const afterB1 = await takeElementCensus(b1, ["SchemaSyncDataLinkTable:DataElement", "SchemaSyncDataLinkTable:RelatedElement"]);
      expectCensusPreserved(beforeB1, afterB1, "on the link-table importer");
      await b1.pushChanges({ accessToken: writerToken, description: "add link-table relationship" });
      await b2.pullChanges({ accessToken: readerToken });
      const afterB2 = await takeElementCensus(b2, ["SchemaSyncDataLinkTable:DataElement", "SchemaSyncDataLinkTable:RelatedElement"]);
      expectCensusPreserved(beforeB2, afterB2, "on the link-table pulling briefcase");
      expectMetadataTablesIdentical(b1, b2, "after adding the link-table relationship", { a: "b1", b: "b2" });
      expectCacheTablesIdentical(b1, b2, "after adding the link-table relationship", { a: "b1", b: "b2" });
      expectPhysicalSchemaIdentical(b1, b2, "after adding the link-table relationship");
      expectNoForeignKeyViolations(b1, "link-table importer after schema change");
      expectNoForeignKeyViolations(b2, "link-table puller after schema change");

      const relationshipId = withEditTxn(b1, (txn) => txn.insertRelationship({
        classFullName: "SchemaSyncDataLinkTable:DataElementLinksToRelated",
        sourceId,
        targetId,
      }));
      await b1.pushChanges({ accessToken: writerToken, description: "insert link-table relationship" });
      await b2.pullChanges({ accessToken: readerToken });
      for (const briefcase of [b1, b2]) {
        const relationship = briefcase.relationships.getInstanceProps("SchemaSyncDataLinkTable:DataElementLinksToRelated", relationshipId);
        assert.equal(relationship.sourceId, sourceId);
        assert.equal(relationship.targetId, targetId);
      }
      expectPhysicalSchemaIdentical(b1, b2, "after inserting the link-table relationship");
      expectNoForeignKeyViolations(b1, "link-table importer after relationship insert");
      expectNoForeignKeyViolations(b2, "link-table puller after relationship insert");
    } finally {
      b2?.close();
      b1?.close();
    }
  });

  it("data survives a mixin added to a populated class #extended", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "sync-data-5" });
    const accessToken = "sync data 5 token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "sync data 5", accessToken });
    let b1: BriefcaseDb | undefined;

    try {
      b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncData5b1" });
      await enableSchemaSync(b1, containerProps);

      const schemaV1: TinySchema = {
        name: "SchemaSyncDataMixin",
        alias: "ssdm",
        ver: "01.00.00",
        refs: [bisCoreRef],
        classes: [{
          type: "entity",
          name: "DataElement",
          baseClass: "bis:GeometricElement2d",
          props: [{ kind: "primitive", name: "stableText", type: "string" }],
        }],
      };
      await importTinySchema(b1, schemaV1);
      await b1.pushChanges({ accessToken, description: "initial mixin schema" });

      const place = await insertDrawingModelAndCategory(b1, "SyncDataMixin");
      const elementId = await insertGeometricElement2d(b1, {
        ...place,
        classFullName: "SchemaSyncDataMixin:DataElement",
        props: { stableText: "mixin data" },
      });
      await b1.pushChanges({ accessToken, description: "insert mixin data" });
      const before = await takeElementCensus(b1, ["SchemaSyncDataMixin:DataElement"]);

      const schemaV2: TinySchema = {
        ...schemaV1,
        ver: "01.00.01",
        refs: [bisCoreRef, { name: "CoreCustomAttributes", ver: "01.00.03", alias: "CoreCA" }],
        classes: [{
          type: "mixin",
          name: "DataMixin",
          appliesTo: "ssdm:DataElement",
          props: [{ kind: "primitive", name: "mixinText", type: "string" }],
        }, {
          ...schemaV1.classes![0],
          mixins: ["DataMixin"],
        }],
      };
      assert.include(tinySchemaToXml(schemaV2), "<BaseClass>DataMixin</BaseClass>");
      await importTinySchema(b1, schemaV2);
      const after = await takeElementCensus(b1, ["SchemaSyncDataMixin:DataElement"]);

      expectCensusPreserved(before, after, "after adding a mixin");
      assert.equal(readElementProp(b1, elementId, "stableText"), "mixin data");
      assert.isUndefined(readElementProp(b1, elementId, "mixinText"));
      await b1.pushChanges({ accessToken, description: "add mixin" });
    } finally {
      b1?.close();
    }
  });

  // A second mixin changes the declaration order in ec_ClassHasBaseClasses, so the existing mixin's ordinal and the populated class mapping must remain stable on both briefcases.
  it("data survives a second mixin added to a class that already has one #extended", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "sync-data-10" });
    const writerToken = "sync data 10 writer token";
    const readerToken = "sync data 10 reader token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "sync data 10", accessToken: writerToken });
    let b1: BriefcaseDb | undefined;
    let b2: BriefcaseDb | undefined;

    try {
      b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken: writerToken, cacheName: "syncData10b1" });
      b2 = await openTestBriefcase({ iTwinId, iModelId, accessToken: readerToken, cacheName: "syncData10b2" });
      await enableSchemaSync(b1, containerProps);

      const schemaV1: TinySchema = {
        name: "SchemaSyncDataTwoMixins",
        alias: "ssdtm",
        ver: "01.00.00",
        refs: [bisCoreRef, { name: "CoreCustomAttributes", ver: "01.00.03", alias: "CoreCA" }],
        classes: [{
          type: "mixin",
          name: "FirstMixin",
          appliesTo: "ssdtm:DataElement",
          props: [{ kind: "primitive", name: "firstMixinText", type: "string" }],
        }, {
          type: "entity",
          name: "DataElement",
          baseClass: "bis:GeometricElement2d",
          mixins: ["FirstMixin"],
          props: [{ kind: "primitive", name: "stableText", type: "string" }],
        }],
      };
      await importTinySchema(b1, schemaV1);
      await b1.pushChanges({ accessToken: writerToken, description: "initial two mixin schema" });
      await b2.pullChanges({ accessToken: readerToken });

      const place = await insertDrawingModelAndCategory(b1, "SyncDataTwoMixins");
      const elementId = await insertGeometricElement2d(b1, {
        ...place,
        classFullName: "SchemaSyncDataTwoMixins:DataElement",
        props: { stableText: "two mixins data", firstMixinText: "first mixin data" },
      });
      await b1.pushChanges({ accessToken: writerToken, description: "insert two mixin data" });
      await b2.pullChanges({ accessToken: readerToken });
      const beforeB1 = await takeElementCensus(b1, ["SchemaSyncDataTwoMixins:DataElement"]);
      const beforeB2 = await takeElementCensus(b2, ["SchemaSyncDataTwoMixins:DataElement"]);

      const schemaV2: TinySchema = {
        ...schemaV1,
        ver: "01.00.01",
        classes: [{
          ...schemaV1.classes![0],
        }, {
          type: "mixin",
          name: "SecondMixin",
          appliesTo: "ssdtm:DataElement",
          props: [{ kind: "primitive", name: "secondMixinText", type: "string" }],
        }, {
          ...schemaV1.classes![1],
          mixins: ["FirstMixin", "SecondMixin"],
        }],
      };
      await importTinySchema(b1, schemaV2);
      const afterB1 = await takeElementCensus(b1, ["SchemaSyncDataTwoMixins:DataElement"]);
      expectCensusPreserved(beforeB1, afterB1, "on the second-mixin importer");
      await b1.pushChanges({ accessToken: writerToken, description: "add second mixin" });
      await b2.pullChanges({ accessToken: readerToken });
      const afterB2 = await takeElementCensus(b2, ["SchemaSyncDataTwoMixins:DataElement"]);
      expectCensusPreserved(beforeB2, afterB2, "on the second-mixin pulling briefcase");
      expectCensusPreserved(afterB1, afterB2, "between the two second-mixin briefcases");
      assert.equal(readElementProp(b1, elementId, "stableText"), "two mixins data");
      assert.equal(readElementProp(b2, elementId, "firstMixinText"), "first mixin data");
      assert.isUndefined(readElementProp(b1, elementId, "secondMixinText"));
      assert.isUndefined(readElementProp(b2, elementId, "secondMixinText"));
      expectMetadataTablesIdentical(b1, b2, "after adding the second mixin", { a: "b1", b: "b2" });
      expectCacheTablesIdentical(b1, b2, "after adding the second mixin", { a: "b1", b: "b2" });
      expectPhysicalSchemaIdentical(b1, b2, "after adding the second mixin");
    } finally {
      b2?.close();
      b1?.close();
    }
  });

  // A shared column carries no type, so a primitive type change moves no data and the update path takes it. Existing values are
  // reinterpreted under the new type on read: a numeric string comes back as its number, anything else comes back as zero.
  it("takes a property type change through the update path and reinterprets existing values #extended", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "sync-data-11" });
    const accessToken = "sync data 11 token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "sync data 11", accessToken });
    let b1: BriefcaseDb | undefined;

    try {
      b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncData11b1" });
      await enableSchemaSync(b1, containerProps);
      const schemaV1: TinySchema = {
        name: "SchemaSyncDataTypeChange",
        alias: "ssdtc",
        ver: "01.00.00",
        // A property type change is a major EC change, so it needs the read version raised, and on
        // an iModel only a dynamic schema may do that. Set on the first version, not just the one
        // that changes the type.
        dynamic: true,
        refs: [bisCoreRef],
        classes: [{
          type: "entity",
          name: "DataElement",
          baseClass: "bis:GeometricElement2d",
          props: [
            { kind: "primitive", name: "stableText", type: "string" },
            { kind: "primitive", name: "changingValue", type: "string" },
          ],
        }],
      };
      await importTinySchema(b1, schemaV1);
      await b1.pushChanges({ accessToken, description: "initial type change schema" });
      const place = await insertDrawingModelAndCategory(b1, "SyncDataTypeChange");
      const elementId = await insertGeometricElement2d(b1, {
        ...place,
        classFullName: "SchemaSyncDataTypeChange:DataElement",
        props: { stableText: "keep this", changingValue: "42" },
      });
      const wordElementId = await insertGeometricElement2d(b1, {
        ...place,
        classFullName: "SchemaSyncDataTypeChange:DataElement",
        props: { stableText: "keep this too", changingValue: "not a number" },
      });
      await b1.pushChanges({ accessToken, description: "insert type change data" });

      const schemaV2: TinySchema = {
        ...schemaV1,
        ver: "02.00.00",
        classes: [{ ...schemaV1.classes![0], props: [
          { kind: "primitive", name: "stableText", type: "string" },
          { kind: "primitive", name: "changingValue", type: "int" },
        ] }],
      };
      await importTinySchema(b1, schemaV2);
      await b1.pushChanges({ accessToken, description: "change property type" });

      assert.deepEqual(queryPropNames(b1, "SchemaSyncDataTypeChange:DataElement"), ["stableText", "changingValue"]);
      assert.equal(readElementProp(b1, elementId, "stableText"), "keep this");
      assert.strictEqual(readElementProp(b1, elementId, "changingValue"), 42);
      assert.equal(readElementProp(b1, wordElementId, "stableText"), "keep this too");
      assert.strictEqual(readElementProp(b1, wordElementId, "changingValue"), 0,
        "a value the new type cannot represent reads as zero rather than failing or staying put");
    } finally {
      b1?.close();
    }
  });

  // The update path accepts this widening because the old concrete class remains supported; the existing link-table instance must still read after the constraint metadata changes.
  it("accepts a relationship constraint widening and preserves its existing instances #extended", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "sync-data-12" });
    const accessToken = "sync data 12 token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "sync data 12", accessToken });
    let b1: BriefcaseDb | undefined;

    try {
      b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncData12b1" });
      await enableSchemaSync(b1, containerProps);
      const relationshipXml = `<ECRelationshipClass typeName="SourceTargetsTarget" strength="referencing" strengthDirection="forward" modifier="Sealed">
    <BaseClass>bis:ElementRefersToElements</BaseClass>
    <Source multiplicity="(0..*)" roleLabel="source" polymorphic="true" abstractConstraint="bis:GeometricElement2d">
        <Class class="SourceElement"/>
    </Source>
    <Target multiplicity="(0..*)" roleLabel="target" polymorphic="true" abstractConstraint="bis:GeometricElement2d">
        <Class class="TargetElement"/>
    </Target>
</ECRelationshipClass>`;
      const schemaV1: TinySchema = {
        name: "SchemaSyncDataConstraint",
        alias: "ssdc",
        ver: "01.00.00",
        refs: [bisCoreRef],
        classes: [{
          type: "entity",
          name: "SourceElement",
          baseClass: "bis:GeometricElement2d",
          props: [{ kind: "primitive", name: "sourceText", type: "string" }],
        }, {
          type: "entity",
          name: "TargetElement",
          baseClass: "bis:GeometricElement2d",
          props: [{ kind: "primitive", name: "targetText", type: "string" }],
        }, {
          type: "entity",
          name: "OtherTarget",
          baseClass: "bis:GeometricElement2d",
          props: [{ kind: "primitive", name: "otherText", type: "string" }],
        }],
        rawXml: [relationshipXml],
      };
      await importTinySchema(b1, schemaV1);
      await b1.pushChanges({ accessToken, description: "initial relationship constraint schema" });
      const place = await insertDrawingModelAndCategory(b1, "SyncDataConstraint");
      const sourceId = await insertGeometricElement2d(b1, {
        ...place,
        classFullName: "SchemaSyncDataConstraint:SourceElement",
        props: { sourceText: "constraint source" },
      });
      const targetId = await insertGeometricElement2d(b1, {
        ...place,
        classFullName: "SchemaSyncDataConstraint:TargetElement",
        props: { targetText: "constraint target" },
      });
      const relationshipId = withEditTxn(b1, (txn) => txn.insertRelationship({
        classFullName: "SchemaSyncDataConstraint:SourceTargetsTarget",
        sourceId,
        targetId,
      }));
      await b1.pushChanges({ accessToken, description: "insert relationship constraint data" });
      const before = await takeElementCensus(b1, ["SchemaSyncDataConstraint:SourceElement", "SchemaSyncDataConstraint:TargetElement"]);
      const beforeRelationship = b1.relationships.getInstanceProps("SchemaSyncDataConstraint:SourceTargetsTarget", relationshipId);

      const schemaV2: TinySchema = {
        ...schemaV1,
        ver: "01.00.01",
        rawXml: [relationshipXml.replace("<Class class=\"TargetElement\"/>", "<Class class=\"TargetElement\"/>\n        <Class class=\"OtherTarget\"/>")],
      };
      await importTinySchema(b1, schemaV2);
      const after = await takeElementCensus(b1, ["SchemaSyncDataConstraint:SourceElement", "SchemaSyncDataConstraint:TargetElement"]);
      expectCensusPreserved(before, after, "after accepting the relationship constraint change");
      const afterRelationship = b1.relationships.getInstanceProps("SchemaSyncDataConstraint:SourceTargetsTarget", relationshipId);
      assert.equal(afterRelationship.sourceId, beforeRelationship.sourceId);
      assert.equal(afterRelationship.targetId, beforeRelationship.targetId);
      await b1.pushChanges({ accessToken, description: "widen relationship constraint" });
      expectNoForeignKeyViolations(b1, "after accepting the relationship constraint change");
    } finally {
      b1?.close();
    }
  });

});
