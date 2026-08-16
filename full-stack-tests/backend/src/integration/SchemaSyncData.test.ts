/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*---------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Suite } from "mocha";
import { BriefcaseDb, IModelDb, IModelHost } from "@itwin/core-backend";
import { HubMock } from "@itwin/core-backend/lib/cjs/internal/HubMock";
import { DbResult } from "@itwin/core-bentley";
import {
  createTestIModel, enableSchemaSync, expectCensusPreserved, expectMetadataTablesIdentical, importTinySchema, initializeContainer,
  insertDrawingModelAndCategory, insertGeometricElement2d, openTestBriefcase, queryPropNames, readElementProp, takeElementCensus,
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

});
