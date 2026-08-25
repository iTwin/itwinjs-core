/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { statSync } from "fs";
import { assert } from "chai";
import * as sinon from "sinon";
import { Suite } from "mocha";
import { BriefcaseDb, CloudSqlite, IModelDb, IModelHost, SchemaSync, SnapshotDb } from "@itwin/core-backend";
import { HubMock } from "@itwin/core-backend/lib/cjs/internal/HubMock";
import { IModelTestUtils, KnownTestLocations, withEditTxn } from "@itwin/core-backend/lib/cjs/test";
import { DbResult } from "@itwin/core-bentley";
import {
  assertThrowsAsync, assertThrowsAsyncContaining, countSyncDbItemRows, createTestIModel, enableSchemaSync, expectCensusPreserved,
  expectMetadataTablesIdentical, expectNoForeignKeyViolations, expectPhysicalSchemaIdentical, extendedIt, importTinySchema, initializeContainer,
  insertDrawingModelAndCategory, insertGeometricElement2d, openTestBriefcase, queryPropNames, querySchemaSyncDataVer, readElementProp,
  readSyncDbDataVer, reopenTestBriefcase, takeElementCensus, TinyClass, TinyProp, TinySchema, tinySchemaToXml,
} from "./SchemaSyncTestUtils";
import "./StartupShutdown"; // calls startup/shutdown IModelHost before/after all tests
import { AzuriteTest } from "./AzuriteTest";

describe("Schema synchronization lifecycle", function (this: Suite) {
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

  const queryDataVersion = (db: IModelDb): string => {
    return db.withPreparedSqliteStatement("PRAGMA data_version", (statement) => {
      assert.equal(statement.step(), DbResult.BE_SQLITE_ROW);
      return String(statement.getValue(0).value);
    });
  };

  const lifecycleSchema: TinySchema = {
    name: "SchemaSyncLifecycle",
    alias: "ssl",
    ver: "01.00.00",
    dynamic: true,
    refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
    classes: [{
      type: "entity",
      name: "KeptClass",
      baseClass: "bis:GeometricElement2d",
      props: [{ kind: "primitive", name: "keptValue", type: "string" }],
    }, {
      type: "entity",
      name: "EmptyClass",
      baseClass: "bis:GeometricElement2d",
      props: [{ kind: "primitive", name: "value", type: "string" }],
    }],
  };

  /** The names of a class' base classes, straight out of the metadata. */
  const queryBaseClassNames = (db: IModelDb, className: string): string[] => {
    const names: string[] = [];
    db.withPreparedSqliteStatement(
      "SELECT b.Name FROM ec_ClassHasBaseClasses h JOIN ec_Class c ON c.Id=h.ClassId JOIN ec_Class b ON b.Id=h.BaseClassId WHERE c.Name=?",
      (statement) => {
        statement.bindString(1, className);
        while (statement.step() === DbResult.BE_SQLITE_ROW)
          names.push(statement.getValue(0).getString());
      });
    return names;
  };

  const countMetadataEnumerationRows = (db: IModelDb, enumerationName: string): number => {
    return db.withPreparedSqliteStatement("SELECT count(*) FROM ec_Enumeration WHERE Name=?", (statement) => {
      statement.bindString(1, enumerationName);
      assert.equal(statement.step(), DbResult.BE_SQLITE_ROW);
      return statement.getValue(0).getInteger();
    });
  };

  /** How many rows ec_Class holds for a name, so a deletion can be seen in the metadata itself. */
  const countMetadataClassRows = (db: IModelDb, className: string): number => {
    return db.withPreparedSqliteStatement("SELECT count(*) FROM ec_Class WHERE Name=?", (statement) => {
      statement.bindString(1, className);
      assert.equal(statement.step(), DbResult.BE_SQLITE_ROW);
      return statement.getValue(0).getInteger();
    });
  };

  const countMetadataItemRows = (db: IModelDb, tableName: string, itemName: string): number => {
    return db.withPreparedSqliteStatement(`SELECT count(*) FROM [${tableName}] WHERE Name=?`, (statement) => {
      statement.bindString(1, itemName);
      assert.equal(statement.step(), DbResult.BE_SQLITE_ROW);
      return statement.getValue(0).getInteger();
    });
  };

  it("deleting a class the update path refuses even when it holds no instances", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "sync-life-1" });
    const accessToken = "sync life deletion token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "sync life deletion", accessToken });
    const b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife1b1" });
    const b2 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife1b2" });
    let b3: BriefcaseDb | undefined;

    try {
      await enableSchemaSync(b1, containerProps);
      await importTinySchema(b1, lifecycleSchema);
      await b1.pushChanges({ accessToken, description: "initial lifecycle schema" });
      await b2.pullChanges({ accessToken });

      const place = await insertDrawingModelAndCategory(b1, "SyncLife1");
      const keptElementId = await insertGeometricElement2d(b1, {
        ...place,
        classFullName: "SchemaSyncLifecycle:KeptClass",
        userLabel: "kept",
      });
      await b1.pushChanges({ accessToken, description: "initial lifecycle data" });
      await b2.pullChanges({ accessToken });

      assert.equal(countMetadataClassRows(b1, "EmptyClass"), 1);

      const schemaWithoutEmptyClass: TinySchema = {
        ...lifecycleSchema,
        ver: "02.00.00",
        classes: [lifecycleSchema.classes![0]],
      };
      // A class is data bearing by design, so removing one counts as a data deletion whether or not
      // any rows exist. The update path refuses it and the caller has to take the upgrade path.
      let caughtError: unknown;
      try {
        await importTinySchema(b1, schemaWithoutEmptyClass);
      } catch (error) {
        caughtError = error;
      }
      assert.isDefined(caughtError, "deleting a metadata-only class should report the upgrade requirement");
      assert.isTrue(SchemaSync.requiresUpgrade(caughtError));
      assert.equal((caughtError as { errorNumber?: number }).errorNumber, DbResult.BE_SQLITE_ERROR_DataDeletionRequired);
      await b1.upgradeSchemaStrings([tinySchemaToXml(schemaWithoutEmptyClass)], { accessToken, description: "remove empty class" });
      assert.deepEqual(queryPropNames(b1, "SchemaSyncLifecycle:KeptClass"), ["keptValue"], "the surviving class lost its property");
      assert.deepEqual(queryPropNames(b1, "SchemaSyncLifecycle:EmptyClass"), []);
      await b2.pullChanges({ accessToken });
      b3 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife1b3" });

      for (const briefcase of [b1, b2, b3]) {
        assert.deepEqual(queryPropNames(briefcase, "SchemaSyncLifecycle:EmptyClass"), []);
        await assertThrowsAsync(async () => briefcase.createQueryReader("SELECT ECInstanceId FROM ONLY SchemaSyncLifecycle:EmptyClass").toArray());
        assert.equal(readElementProp(briefcase, keptElementId, "userLabel"), "kept");
      }

      expectMetadataTablesIdentical(b1, b2, "after metadata-only class deletion", { a: "b1", b: "b2" });
      expectMetadataTablesIdentical(b1, b3, "after metadata-only class deletion", { a: "b1", b: "b3" });
      expectPhysicalSchemaIdentical(b1, b2, "after metadata-only class deletion");
      expectPhysicalSchemaIdentical(b1, b3, "after metadata-only class deletion");
      // The class shares BisCore's table, so there is no table of its own to drop. What has to be
      // gone everywhere is its row in ec_Class.
      for (const briefcase of [b1, b2, b3])
        assert.equal(countMetadataClassRows(briefcase, "EmptyClass"), 0, "the deleted class is still in ec_Class");
    } finally {
      b1.close();
      b2.close();
      b3?.close();
    }
  });

  // Deleting a property takes the property-mapping branch rather than the class branch, and holding no data does not spare it the upgrade path.
  extendedIt("deleting an empty property the update path refuses", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "sync-life-11" });
    const accessToken = "sync life dedicated property token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "sync life dedicated property", accessToken });
    const b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife11b1" });
    const b2 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife11b2" });
    let b3: BriefcaseDb | undefined;

    try {
      await enableSchemaSync(b1, containerProps);
      const schemaV1: TinySchema = {
        name: "SchemaSyncDedicatedProperty",
        alias: "ssdp",
        ver: "01.00.00",
        dynamic: true,
        refs: [
          { name: "BisCore", ver: "01.00.00", alias: "bis" },
        ],
        classes: [{
          type: "entity",
          name: "DedicatedClass",
          baseClass: "bis:GeometricElement2d",
          props: [{ kind: "primitive", name: "dedicatedValue", type: "string" }],
        }],
      };
      await importTinySchema(b1, schemaV1);
      await b1.pushChanges({ accessToken, description: "initial dedicated property schema" });
      await b2.pullChanges({ accessToken });

      const schemaV2: TinySchema = {
        ...schemaV1,
        ver: "02.00.00",
        classes: [{ ...schemaV1.classes![0], props: [] }],
      };
      let caughtError: unknown;
      try {
        await importTinySchema(b1, schemaV2);
      } catch (error) {
        caughtError = error;
      }
      assert.isDefined(caughtError, "deleting the empty property should report the upgrade requirement");
      assert.isTrue(SchemaSync.requiresUpgrade(caughtError));
      assert.equal((caughtError as { errorNumber?: number }).errorNumber, DbResult.BE_SQLITE_ERROR_DataDeletionRequired);

      await b1.upgradeSchemaStrings([tinySchemaToXml(schemaV2)], { accessToken, description: "remove empty property" });
      await b2.pullChanges({ accessToken });
      b3 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife11b3" });
      for (const briefcase of [b1, b2, b3])
        assert.deepEqual(queryPropNames(briefcase, "SchemaSyncDedicatedProperty:DedicatedClass"), []);
      expectMetadataTablesIdentical(b1, b2, "after empty property deletion", { a: "b1", b: "b2" });
      expectMetadataTablesIdentical(b1, b3, "after empty property deletion", { a: "b1", b: "b3" });
      expectPhysicalSchemaIdentical(b1, b2, "after empty property deletion");
      expectPhysicalSchemaIdentical(b1, b3, "after empty property deletion");
    } finally {
      b1.close();
      b2.close();
      b3?.close();
    }
  });

  it("a metadata-only deletion reaches every briefcase through the update path", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "sync-life-6" });
    const accessToken = "sync life mixin token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "sync life mixin", accessToken });
    const b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife6b1" });
    const b2 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife6b2" });
    let b3: BriefcaseDb | undefined;

    try {
      await enableSchemaSync(b1, containerProps);

      // The mixin carries no properties and the enumeration is used by nothing, so neither maps to a
      // column and neither holds a row. Removing them takes out metadata and no data.
      const unusedEnumeration = [
        `    <ECEnumeration typeName="UnusedState" backingTypeName="int" isStrict="true">`,
        `        <ECEnumerator name="Open" value="0" displayLabel="Open"/>`,
        `        <ECEnumerator name="Closed" value="1" displayLabel="Closed"/>`,
        `    </ECEnumeration>`,
      ].join("\n");
      const withMixin: TinySchema = {
        name: "SchemaSyncMetadataOnly",
        alias: "ssmo",
        ver: "01.00.00",
        dynamic: true,
        refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
        rawXml: [unusedEnumeration],
        classes: [{
          type: "mixin",
          name: "IMarker",
          appliesTo: "bis:GeometricElement2d",
          props: [],
        }, {
          type: "entity",
          name: "MarkedClass",
          baseClass: "bis:GeometricElement2d",
          mixins: ["IMarker"],
          props: [{ kind: "primitive", name: "markedValue", type: "string" }],
        }],
      };
      await importTinySchema(b1, withMixin);
      await b1.pushChanges({ accessToken, description: "schema with an empty mixin" });
      await b2.pullChanges({ accessToken });

      const place = await insertDrawingModelAndCategory(b1, "SyncLifeMixin");
      const markedElementId = await insertGeometricElement2d(b1, {
        ...place,
        classFullName: "SchemaSyncMetadataOnly:MarkedClass",
        props: { markedValue: "marked" },
      });
      await b1.pushChanges({ accessToken, description: "marked data" });
      await b2.pullChanges({ accessToken });

      const before = await takeElementCensus(b1, ["SchemaSyncMetadataOnly:MarkedClass"]);
      assert.equal(countMetadataClassRows(b1, "IMarker"), 1);

      const markedClassWithoutMixin: TinyClass = {
        type: "entity",
        name: "MarkedClass",
        baseClass: "bis:GeometricElement2d",
        props: [{ kind: "primitive", name: "markedValue", type: "string" }],
      };
      // Take the mixin off the class and drop the unused enumeration. Both go through the update path.
      await importTinySchema(b1, { ...withMixin, ver: "02.00.00", rawXml: [], classes: [withMixin.classes![0], markedClassWithoutMixin] });
      await b1.pushChanges({ accessToken, description: "drop the mixin and the enumeration" });
      await b2.pullChanges({ accessToken });
      b3 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife6b3" });

      for (const briefcase of [b1, b2, b3]) {
        assert.isEmpty(queryBaseClassNames(briefcase, "MarkedClass").filter((name) => name === "IMarker"), "the class still carries the mixin");
        assert.equal(countMetadataEnumerationRows(briefcase, "UnusedState"), 0, "the enumeration is still in ec_Enumeration");
        assert.deepEqual(queryPropNames(briefcase, "SchemaSyncMetadataOnly:MarkedClass"), ["markedValue"]);
        assert.equal(readElementProp(briefcase, markedElementId, "markedValue"), "marked");
      }
      expectCensusPreserved(before, await takeElementCensus(b1, ["SchemaSyncMetadataOnly:MarkedClass"]), "after dropping the mixin");
      expectMetadataTablesIdentical(b1, b2, "after a metadata-only deletion", { a: "b1", b: "b2" });
      expectMetadataTablesIdentical(b1, b3, "after a metadata-only deletion", { a: "b1", b: "b3" });
      expectPhysicalSchemaIdentical(b1, b2, "after a metadata-only deletion");
      expectPhysicalSchemaIdentical(b1, b3, "after a metadata-only deletion");

      // Deleting the mixin class itself is refused, even though nothing implements it any more and it
      // has no table of its own. The check is on the class' map strategy, not on whether anything is
      // still mapped to it, so an abstract mixin reads as data bearing.
      let caughtError: unknown;
      try {
        await importTinySchema(b1, { ...withMixin, ver: "03.00.00", rawXml: [], classes: [markedClassWithoutMixin] });
      } catch (error) {
        caughtError = error;
      }
      assert.isDefined(caughtError, "deleting the unused mixin class was expected to be refused");
      assert.equal((caughtError as { errorNumber?: number }).errorNumber, DbResult.BE_SQLITE_ERROR_DataDeletionRequired);
      await b1.upgradeSchemaStrings([tinySchemaToXml({ ...withMixin, ver: "03.00.00", rawXml: [], classes: [markedClassWithoutMixin] })], { accessToken, description: "drop the mixin class" });
      assert.equal(countMetadataClassRows(b1, "IMarker"), 0, "the mixin class is still in ec_Class");
    } finally {
      b1.close();
      b2.close();
      b3?.close();
    }
  });

  // KindOfQuantity metadata retains NO ACTION references to units and formats, while the category is another metadata-only row; deleting both exercises those foreign keys across pullers.
  extendedIt("a KindOfQuantity and property category deletion reaches every briefcase", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "sync-life-12" });
    const accessToken = "sync life quantity metadata token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "sync life quantity metadata", accessToken });
    const b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife12b1" });
    const b2 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife12b2" });
    let b3: BriefcaseDb | undefined;

    try {
      await enableSchemaSync(b1, containerProps);
      const schemaWithMetadata: TinySchema = {
        name: "SchemaSyncQuantityMetadata",
        alias: "ssqm",
        ver: "01.00.00",
        dynamic: true,
        refs: [
          { name: "BisCore", ver: "01.00.00", alias: "bis" },
          { name: "Units", ver: "01.00.08", alias: "u" },
          { name: "Formats", ver: "01.00.00", alias: "f" },
        ],
        rawXml: [
          `<KindOfQuantity typeName="UnusedQuantity" persistenceUnit="u:M" presentationUnits="f:DefaultReal(2)[u:M]" relativeError="0.001"/>`,
          `<PropertyCategory typeName="UnusedCategory" displayLabel="Unused" priority="100"/>`,
        ],
        classes: [{
          type: "entity",
          name: "MarkedClass",
          baseClass: "bis:GeometricElement2d",
          props: [{ kind: "primitive", name: "markedValue", type: "string" }],
        }, {
          type: "struct",
          name: "UnusedStruct",
          rawXml: `<ECProperty propertyName="quantity" typeName="double" kindOfQuantity="UnusedQuantity" category="UnusedCategory"/>`,
        }],
      };
      await importTinySchema(b1, schemaWithMetadata);
      await b1.pushChanges({ accessToken, description: "schema with quantity metadata" });
      await b2.pullChanges({ accessToken });

      const place = await insertDrawingModelAndCategory(b1, "SyncLifeQuantityMetadata");
      const markedElementId = await insertGeometricElement2d(b1, {
        ...place,
        classFullName: "SchemaSyncQuantityMetadata:MarkedClass",
        props: { markedValue: "still present" },
      });
      await b1.pushChanges({ accessToken, description: "quantity metadata data" });
      await b2.pullChanges({ accessToken });
      const before = await takeElementCensus(b1, ["SchemaSyncQuantityMetadata:MarkedClass"]);
      assert.equal(countMetadataItemRows(b1, "ec_KindOfQuantity", "UnusedQuantity"), 1);
      assert.equal(countMetadataItemRows(b1, "ec_PropertyCategory", "UnusedCategory"), 1);

      const schemaWithoutMetadata: TinySchema = {
        ...schemaWithMetadata,
        ver: "02.00.00",
        rawXml: [],
        classes: [schemaWithMetadata.classes![0], { ...schemaWithMetadata.classes![1], rawXml: undefined }],
      };
      await importTinySchema(b1, schemaWithoutMetadata);
      await b1.pushChanges({ accessToken, description: "remove quantity metadata" });
      await b2.pullChanges({ accessToken });
      b3 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife12b3" });

      for (const briefcase of [b1, b2, b3]) {
        assert.equal(countMetadataItemRows(briefcase, "ec_KindOfQuantity", "UnusedQuantity"), 0, "the KindOfQuantity is still present");
        assert.equal(countMetadataItemRows(briefcase, "ec_PropertyCategory", "UnusedCategory"), 0, "the property category is still present");
        assert.equal(readElementProp(briefcase, markedElementId, "markedValue"), "still present");
      }
      expectCensusPreserved(before, await takeElementCensus(b1, ["SchemaSyncQuantityMetadata:MarkedClass"]), "after quantity metadata deletion");
      expectMetadataTablesIdentical(b1, b2, "after quantity metadata deletion", { a: "b1", b: "b2" });
      expectMetadataTablesIdentical(b1, b3, "after quantity metadata deletion", { a: "b1", b: "b3" });
      expectPhysicalSchemaIdentical(b1, b2, "after quantity metadata deletion");
      expectPhysicalSchemaIdentical(b1, b3, "after quantity metadata deletion");
    } finally {
      b1.close();
      b2.close();
      b3?.close();
    }
  });

  // A KindOfQuantity, ECEnumeration or PropertyCategory is referenced from ec_Property by a nullable
  // foreign key declared ON DELETE CASCADE, so SchemaWriter clears every reference before it deletes
  // the row - otherwise the cascade takes the whole ECProperty, its property map and its data.
  //
  // A briefcase applying the resulting changeset does not get that ordering. TxnManager's
  // ApplySchemaChangesInOrder deliberately applies effective deletes ahead of updates so that an
  // invert cannot violate a unique constraint, which puts the ec_KindOfQuantity delete before the
  // ec_Property update that clears the pointer. Foreign key actions are live for a schema changeset
  // that leaves ec_cache_ alone, so the cascade fires on the pulling briefcase and the update that
  // follows is a NotFound conflict, which the ec_ conflict rules skip. The property is gone on b2
  // and still there on b1.
  //
  // Nothing about this is specific to schema sync - the same changeset from an ordinary iModel does
  // the same thing - which is why the test drives it through the upgrade path, where SchemaWriter
  // runs against the briefcase directly and b1 is unambiguously correct.
  //
  // SKIPPED, not fixed: the agreed fix is an ECDb profile upgrade moving these three foreign keys
  // from ON DELETE CASCADE to ON DELETE SET NULL, so that merge and rebase - which differ in whether
  // foreign key actions run at all - both end up with a nulled cell instead of a deleted property.
  // Unskip that as part of that profile change; it is the acceptance test for it.
  // Story on the backlog tracking the issue: itwinjs-backlog#2333
  it.skip("a referenced KindOfQuantity deletion must not drop the property in another schema", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "sync-life-16" });
    const accessToken = "sync life referenced koq token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "sync life referenced koq", accessToken });
    const b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife16b1" });
    const b2 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife16b2" });

    try {
      await enableSchemaSync(b1, containerProps);

      // The KindOfQuantity lives here...
      const quantitySchema: TinySchema = {
        name: "SyncLifeQuantities",
        alias: "slq",
        ver: "01.00.00",
        dynamic: true,
        refs: [
          { name: "Units", ver: "01.00.08", alias: "u" },
          { name: "Formats", ver: "01.00.00", alias: "f" },
        ],
        rawXml: [
          `<KindOfQuantity typeName="SharedLength" persistenceUnit="u:M" presentationUnits="f:DefaultReal(2)[u:M]" relativeError="0.001"/>`,
        ],
      };
      // ...and the property that uses it lives in a schema that references it, so it is outside the
      // reference closure the importing briefcase adopts.
      const consumerSchema: TinySchema = {
        name: "SyncLifeQuantityConsumer",
        alias: "slqc",
        ver: "01.00.00",
        dynamic: true,
        refs: [
          { name: "BisCore", ver: "01.00.00", alias: "bis" },
          { name: "SyncLifeQuantities", ver: "01.00.00", alias: "slq" },
        ],
        classes: [{
          type: "entity",
          name: "MeasuredThing",
          baseClass: "bis:GeometricElement2d",
          rawXml: `        <ECProperty propertyName="length" typeName="double" kindOfQuantity="slq:SharedLength"/>`,
        }],
      };
      await importTinySchema(b1, quantitySchema);
      await importTinySchema(b1, consumerSchema);
      await b1.pushChanges({ accessToken, description: "quantity schema and its consumer" });
      await b2.pullChanges({ accessToken });

      const place = await insertDrawingModelAndCategory(b1, "SyncLifeReferencedKoq");
      const measuredId = await insertGeometricElement2d(b1, {
        ...place,
        classFullName: "SyncLifeQuantityConsumer:MeasuredThing",
        props: { length: 12.5 },
      });
      await b1.pushChanges({ accessToken, description: "a measured element" });
      await b2.pullChanges({ accessToken });
      assert.equal(readElementProp(b2, measuredId, "length"), 12.5, "the pulling briefcase should start with the property");

      // Deleted through the upgrade path, where SchemaWriter runs against the briefcase itself and
      // clears the reference before dropping the row, so b1 is correct by construction.
      const quantitySchemaWithoutKoq: TinySchema = { ...quantitySchema, ver: "02.00.00", rawXml: [] };
      await b1.upgradeSchemaStrings([tinySchemaToXml(quantitySchemaWithoutKoq)], { accessToken, description: "remove the shared KindOfQuantity" });
      assert.equal(countMetadataItemRows(b1, "ec_KindOfQuantity", "SharedLength"), 0, "the KindOfQuantity should be gone on the importer");
      assert.equal(readElementProp(b1, measuredId, "length"), 12.5, "the importer should keep the property and its value");

      // b2 applies that changeset, and this is where it goes wrong today.
      await b2.pullChanges({ accessToken });
      assert.equal(countMetadataItemRows(b2, "ec_KindOfQuantity", "SharedLength"), 0, "the KindOfQuantity should be gone on the puller");
      assert.deepEqual(queryPropNames(b2, "SyncLifeQuantityConsumer:MeasuredThing"), queryPropNames(b1, "SyncLifeQuantityConsumer:MeasuredThing"),
        "the pulling briefcase lost a property the changeset only meant to clear the KindOfQuantity of");
      assert.equal(readElementProp(b2, measuredId, "length"), 12.5, "the pulling briefcase lost the property value");
      expectMetadataTablesIdentical(b1, b2, "after deleting a KindOfQuantity referenced from another schema", { a: "b1", b: "b2" });
      expectNoForeignKeyViolations(b2, "after deleting a KindOfQuantity referenced from another schema");
    } finally {
      b1.close();
      b2.close();
    }
  });

  // The adopt half of a sync import commits before the container is uploaded, and the upload only
  // happens when the write lock is released - after importSchemas' own work is done. Everything in
  // that window has to leave the briefcase as it was. Losing the caller's data would be bad; keeping
  // half an import is worse, because pushing it publishes ec_ ids the sync db has no record of and
  // the sync db then hands the same ids to somebody else.
  //
  // Injecting the failure through SchemaSync.withLockedAccess rather than by killing the lease: the
  // real lease is clamped to a minimum of one hour native-side and cannot be shortened for a test.
  // What matters is the shape - the native import succeeded and committed, and then something after
  // it threw. Note this injection leaves the rows in the sync db, which is the harmless direction: a
  // briefcase that rolled back more than it had to converges on the next import, whereas a briefcase
  // that kept rows the sync db never recorded corrupts the timeline when it pushes.
  const failAfterTheImportCommits = (): void => {
    const realWithLockedAccess = SchemaSync.withLockedAccess;
    sinon.stub(SchemaSync, "withLockedAccess").callsFake(async (iModel, args, operation) => {
      await realWithLockedAccess(iModel, args, operation);
      throw new Error("simulated failure after the sync db import committed");
    });
  };

  it("a schema import that fails after committing keeps the local changes and drops the schema", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "sync-life-17" });
    const accessToken = "sync life rollback token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "sync life rollback", accessToken });
    const b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife17b1" });
    const b2 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife17b2" });

    try {
      await enableSchemaSync(b1, containerProps);
      await importTinySchema(b1, lifecycleSchema);
      await b1.pushChanges({ accessToken, description: "base schema" });

      const place = await insertDrawingModelAndCategory(b1, "SyncLifeRollback");
      const keptId = await insertGeometricElement2d(b1, {
        ...place,
        classFullName: "SchemaSyncLifecycle:KeptClass",
        props: { userLabel: "written before the failed import" },
      });
      await b1.pushChanges({ accessToken, description: "data before the failed import" });

      // Local work that is still pending when the import is attempted. It is committed by
      // importSchemas before the adopt runs, so the rollback must stop short of it.
      const pendingId = await insertGeometricElement2d(b1, {
        ...place,
        classFullName: "SchemaSyncLifecycle:KeptClass",
        props: { userLabel: "pending when the import failed" },
      });

      const rollbackSchema: TinySchema = {
        name: "SchemaSyncRollback",
        alias: "ssr",
        ver: "01.00.00",
        dynamic: true,
        refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
        classes: [{ type: "entity", name: "NeverArrives", baseClass: "bis:GeometricElement2d", props: [{ kind: "primitive", name: "value", type: "string" }] }],
      };

      failAfterTheImportCommits();
      await assertThrowsAsync(async () => importTinySchema(b1, rollbackSchema));
      sinon.restore();

      // Nothing of the failed import survives.
      assert.equal(countMetadataItemRows(b1, "ec_Schema", "SchemaSyncRollback"), 0, "the failed import left its schema behind");
      assert.equal(countMetadataItemRows(b1, "ec_Class", "NeverArrives"), 0, "the failed import left its class behind");

      // Both the pushed and the pending local work are untouched.
      assert.equal(readElementProp(b1, keptId, "userLabel"), "written before the failed import");
      assert.equal(readElementProp(b1, pendingId, "userLabel"), "pending when the import failed", "the rollback reached past the import into the caller's own work");

      // And what gets pushed carries only the data, so the timeline never learns about the schema.
      await b1.pushChanges({ accessToken, description: "data that outlived the failed import" });
      await b2.pullChanges({ accessToken });
      assert.equal(countMetadataItemRows(b2, "ec_Schema", "SchemaSyncRollback"), 0, "the failed import reached the timeline");
      assert.equal(readElementProp(b2, pendingId, "userLabel"), "pending when the import failed");
      expectMetadataTablesIdentical(b1, b2, "after a failed import was rolled back", { a: "b1", b: "b2" });
      expectNoForeignKeyViolations(b1, "after a failed import was rolled back");

      // The briefcase is still usable for the next import, and it agrees with the sync db afterwards.
      await importTinySchema(b1, rollbackSchema);
      assert.equal(countMetadataItemRows(b1, "ec_Schema", "SchemaSyncRollback"), 1, "the briefcase could not import again after the rollback");
      await b1.pushChanges({ accessToken, description: "the retried import" });
      await b2.pullChanges({ accessToken });
      expectMetadataTablesIdentical(b1, b2, "after retrying the import that had failed", { a: "b1", b: "b2" });
      expectPhysicalSchemaIdentical(b1, b2, "after retrying the import that had failed");
    } finally {
      sinon.restore();
      b1.close();
      b2.close();
    }
  });

  // The advanced variant: a schema import that already succeeded and has not been pushed yet, when a
  // second one fails. The first one's rows are in the sync db, so they have to stay; only the second
  // one's may go. This is what makes the rollback a cancelTo back to a remembered point rather than
  // "undo the schema txns".
  extendedIt("a failed import keeps an earlier unpushed import that already reached the sync db", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "sync-life-18" });
    const accessToken = "sync life rollback stacked token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "sync life rollback stacked", accessToken });
    const b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife18b1" });
    const b2 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife18b2" });

    try {
      await enableSchemaSync(b1, containerProps);

      const firstSchema: TinySchema = {
        name: "SchemaSyncStackedFirst",
        alias: "sssf",
        ver: "01.00.00",
        dynamic: true,
        refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
        classes: [{ type: "entity", name: "Survivor", baseClass: "bis:GeometricElement2d", props: [{ kind: "primitive", name: "value", type: "string" }] }],
      };
      const secondSchema: TinySchema = {
        name: "SchemaSyncStackedSecond",
        alias: "ssss",
        ver: "01.00.00",
        dynamic: true,
        refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
        classes: [{ type: "entity", name: "Casualty", baseClass: "bis:GeometricElement2d", props: [{ kind: "primitive", name: "value", type: "string" }] }],
      };

      // Succeeds and stays unpushed - its rows are in the sync db, so the briefcase must keep them.
      await importTinySchema(b1, firstSchema);
      assert.isTrue(b1.txns.hasLocalChanges, "the first import should be sitting unpushed");

      failAfterTheImportCommits();
      await assertThrowsAsync(async () => importTinySchema(b1, secondSchema));
      sinon.restore();

      assert.equal(countMetadataItemRows(b1, "ec_Schema", "SchemaSyncStackedFirst"), 1, "the rollback reached past the failed import into the earlier one");
      assert.equal(countMetadataItemRows(b1, "ec_Class", "Survivor"), 1, "the rollback took the earlier import's class");
      assert.equal(countMetadataItemRows(b1, "ec_Schema", "SchemaSyncStackedSecond"), 0, "the failed import left its schema behind");

      // The surviving import is still whole enough to use and to push.
      const place = await insertDrawingModelAndCategory(b1, "SyncLifeStacked");
      const survivorId = await insertGeometricElement2d(b1, {
        ...place,
        classFullName: "SchemaSyncStackedFirst:Survivor",
        props: { value: "the first import still works" },
      });
      await b1.pushChanges({ accessToken, description: "the surviving import and its data" });
      await b2.pullChanges({ accessToken });
      assert.equal(readElementProp(b2, survivorId, "value"), "the first import still works");
      assert.equal(countMetadataItemRows(b2, "ec_Schema", "SchemaSyncStackedSecond"), 0, "the failed import reached the timeline");
      expectMetadataTablesIdentical(b1, b2, "after a failed import on top of an unpushed one", { a: "b1", b: "b2" });
      expectPhysicalSchemaIdentical(b1, b2, "after a failed import on top of an unpushed one");
      expectNoForeignKeyViolations(b1, "after a failed import on top of an unpushed one");
    } finally {
      sinon.restore();
      b1.close();
      b2.close();
    }
  });

  // The other half of the rollback: the failure happens while the container write lock is still held, so
  // the sync db's rows were never uploaded. CloudSqlite.withWriteLock abandons the container's local
  // changes when the locked operation throws, which reverts the cache to the last uploaded state - the
  // ids this import took are handed out again to whoever asks next.
  const containerLockFailureMessage = "simulated failure before the container write lock was released";
  const failInsideTheContainerLock = (): void => {
    const realWithWriteLock = CloudSqlite.withWriteLock;
    sinon.stub(CloudSqlite, "withWriteLock").callsFake(async (args, operation) => {
      await realWithWriteLock(args, async () => {
        await operation();
        throw new Error(containerLockFailureMessage);
      });
    });
  };

  it("a schema import that fails before the container is uploaded takes the sync db back with it", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "sync-life-19" });
    const accessToken = "sync life container rollback token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "sync life container rollback", accessToken });
    const b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife19b1" });
    const b2 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife19b2" });

    try {
      await enableSchemaSync(b1, containerProps);
      await importTinySchema(b1, lifecycleSchema);
      await b1.pushChanges({ accessToken, description: "base schema" });

      const dataVerBeforeTheFailure = await readSyncDbDataVer(b1);
      const localDataVerBeforeTheFailure = querySchemaSyncDataVer(b1);

      const rollbackSchema: TinySchema = {
        name: "SchemaSyncContainerRollback",
        alias: "sscr",
        ver: "01.00.00",
        dynamic: true,
        refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
        classes: [{ type: "entity", name: "NeverUploaded", baseClass: "bis:GeometricElement2d", props: [{ kind: "primitive", name: "value", type: "string" }] }],
      };

      failInsideTheContainerLock();
      await assertThrowsAsync(async () => importTinySchema(b1, rollbackSchema), containerLockFailureMessage);
      sinon.restore();

      // The briefcase rolled its adopt back, as in the test above.
      assert.equal(countMetadataItemRows(b1, "ec_Schema", "SchemaSyncContainerRollback"), 0, "the failed import left its schema behind");
      assert.equal(querySchemaSyncDataVer(b1), localDataVerBeforeTheFailure, "the briefcase kept the data version stamp of the failed import");

      // And so did the container: the rows the import wrote into the sync db are gone with them.
      assert.equal(await countSyncDbItemRows(b1, "ec_Schema", "SchemaSyncContainerRollback"), 0, "the sync db kept the schema of the failed import");
      assert.equal(await countSyncDbItemRows(b1, "ec_Class", "NeverUploaded"), 0, "the sync db kept the class of the failed import");
      assert.equal(await readSyncDbDataVer(b1), dataVerBeforeTheFailure, "the sync db kept the data version of the failed import");

      // A second briefcase sees the same container, so the ids are free for whoever imports next.
      await b2.pullChanges({ accessToken });
      await importTinySchema(b2, rollbackSchema);
      await b2.pushChanges({ accessToken, description: "the import that got the ids instead" });
      await b1.pullChanges({ accessToken });
      assert.equal(countMetadataItemRows(b1, "ec_Schema", "SchemaSyncContainerRollback"), 1);
      expectMetadataTablesIdentical(b1, b2, "after another briefcase imported what the failed one rolled back", { a: "b1", b: "b2" });
      expectPhysicalSchemaIdentical(b1, b2, "after another briefcase imported what the failed one rolled back");
      expectNoForeignKeyViolations(b1, "after another briefcase imported what the failed one rolled back");
    } finally {
      sinon.restore();
      b1.close();
      b2.close();
    }
  });

  // An upgrade rebuilds the sync db from the briefcase, so the two have to land together: a sync db
  // holding an upgrade the timeline never got describes columns no briefcase has. The container is
  // uploaded first because it is the one that can still be taken back - if the push then fails, the
  // briefcase rolls back and the pre-upgrade state is mirrored up again.
  it("an upgrade whose push fails puts the sync db back where the timeline is", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "sync-life-20" });
    const accessToken = "sync life upgrade rollback token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "sync life upgrade rollback", accessToken });
    const b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife20b1" });
    const b2 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife20b2" });

    const structProps = (count: number): TinyProp[] =>
      Array.from({ length: count }, (_unused, i): TinyProp => ({ kind: "primitive", name: `p${i}`, type: "string" }));
    const transformSchema = (structPropCount: number, ver: string): TinySchema => ({
      name: "SchemaSyncUpgradeRollback",
      alias: "ssur",
      ver,
      dynamic: true,
      refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
      classes: [
        { type: "struct", name: "Wide", props: structProps(structPropCount) },
        {
          type: "entity", name: "Holder", baseClass: "bis:GeometricElement2d",
          props: [{ kind: "primitive", name: "label", type: "string" }, { kind: "struct", name: "s0", type: "Wide" }],
        },
      ],
    });

    try {
      await enableSchemaSync(b1, containerProps);
      await importTinySchema(b1, transformSchema(10, "01.00.00"));
      await b1.pushChanges({ accessToken, description: "the schema the upgrade widens" });

      const place = await insertDrawingModelAndCategory(b1, "SyncLifeUpgradeRollback");
      const holderId = await insertGeometricElement2d(b1, {
        ...place,
        classFullName: "SchemaSyncUpgradeRollback:Holder",
        props: { label: "written before the failed upgrade" },
      });
      await b1.pushChanges({ accessToken, description: "data before the failed upgrade" });

      const dataVerBeforeTheFailure = await readSyncDbDataVer(b1);
      const changesetBeforeTheFailure = b1.changeset.id;
      const widened = transformSchema(30, "01.00.01");

      // Widening the struct moves data between columns, so this only goes through the upgrade path.
      await assertThrowsAsyncContaining(
        async () => importTinySchema(b1, widened),
        "Use BriefcaseDb.upgradeSchemas");

      // Under the exclusive schema lock nothing can make the push fail but the transport, so that is
      // what gets injected.
      sinon.stub(b1, "pushChanges").rejects(new Error("simulated failure pushing the upgrade"));
      await assertThrowsAsync(async () => b1.upgradeSchemaStrings([tinySchemaToXml(widened)], { accessToken, description: "the upgrade that could not be pushed" }));
      sinon.restore();

      // The briefcase is back at the timeline, with nothing local to get in the way of a retry.
      assert.equal(countMetadataItemRows(b1, "ec_Property", "p20"), 0, "the briefcase kept the widened struct");
      assert.isFalse(b1.txns.hasLocalChanges, "the rolled back upgrade left local changes behind");
      assert.equal(b1.changeset.id, changesetBeforeTheFailure, "the failed upgrade reached the timeline");
      assert.equal(readElementProp(b1, holderId, "label"), "written before the failed upgrade");

      // And so is the sync db, which is the point: it had the upgrade in it when the push failed.
      assert.equal(await countSyncDbItemRows(b1, "ec_Property", "p20"), 0, "the sync db kept the widened struct");
      assert.notEqual(await readSyncDbDataVer(b1), dataVerBeforeTheFailure, "restoring the sync db should move its data version");

      // A second briefcase importing additively gets a sync db that matches what it holds. The failed
      // upgrade keeps its exclusive lock, same as a failed import does, so it has to be given up first.
      await b1.locks.releaseAllLocks();
      await b2.pullChanges({ accessToken });
      await importTinySchema(b2, {
        name: "SchemaSyncUpgradeBystander",
        alias: "ssub",
        ver: "01.00.00",
        dynamic: true,
        refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
        classes: [{ type: "entity", name: "Bystander", baseClass: "bis:GeometricElement2d", props: [{ kind: "primitive", name: "value", type: "string" }] }],
      });
      await b2.pushChanges({ accessToken, description: "an additive import after the failed upgrade" });
      await b1.pullChanges({ accessToken });
      expectMetadataTablesIdentical(b1, b2, "after an import following the rolled back upgrade", { a: "b1", b: "b2" });

      // The upgrade itself still works when retried.
      await b1.upgradeSchemaStrings([tinySchemaToXml(widened)], { accessToken, description: "the retried upgrade" });
      assert.equal(countMetadataItemRows(b1, "ec_Property", "p20"), 1, "the retried upgrade did not widen the struct");
      assert.equal(await countSyncDbItemRows(b1, "ec_Property", "p20"), 1, "the retried upgrade did not reach the sync db");
      await b2.pullChanges({ accessToken });
      assert.equal(readElementProp(b2, holderId, "label"), "written before the failed upgrade");
      expectMetadataTablesIdentical(b1, b2, "after retrying the upgrade", { a: "b1", b: "b2" });
      expectPhysicalSchemaIdentical(b1, b2, "after retrying the upgrade");
      expectNoForeignKeyViolations(b1, "after retrying the upgrade");
    } finally {
      sinon.restore();
      b1.close();
      b2.close();
    }
  });

  it("a class that still holds instances cannot be deleted through the update path", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "sync-life-2" });
    const accessToken = "sync life instance deletion token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "sync life instance deletion", accessToken });
    const b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife2b1" });

    try {
      await enableSchemaSync(b1, containerProps);
      await importTinySchema(b1, lifecycleSchema);
      await b1.pushChanges({ accessToken, description: "initial instance deletion schema" });

      const place = await insertDrawingModelAndCategory(b1, "SyncLife2");
      const keptElementId = await insertGeometricElement2d(b1, {
        ...place,
        classFullName: "SchemaSyncLifecycle:KeptClass",
        userLabel: "keep",
      });
      const deletedElementId = await insertGeometricElement2d(b1, {
        ...place,
        classFullName: "SchemaSyncLifecycle:EmptyClass",
        props: { value: "remove" },
      });
      await b1.pushChanges({ accessToken, description: "instance deletion data" });
      const keptCensusBeforeDeletion = await takeElementCensus(b1, ["SchemaSyncLifecycle:KeptClass"]);

      const schemaWithoutEmptyClass: TinySchema = {
        ...lifecycleSchema,
        ver: "02.00.00",
        classes: [lifecycleSchema.classes![0]],
      };
      let caughtError: unknown;
      try {
        await importTinySchema(b1, schemaWithoutEmptyClass);
      } catch (error) {
        caughtError = error;
      }
      assert.isDefined(caughtError, "importing a class with instances should fail");
      assert.isTrue(SchemaSync.requiresUpgrade(caughtError));
      assert.equal((caughtError as { errorNumber?: number }).errorNumber, DbResult.BE_SQLITE_ERROR_DataDeletionRequired);

      await b1.upgradeSchemaStrings([tinySchemaToXml(schemaWithoutEmptyClass)], { accessToken, description: "remove class with instances" });
      const keptCensusAfterDeletion = await takeElementCensus(b1, ["SchemaSyncLifecycle:KeptClass"]);
      expectCensusPreserved(keptCensusBeforeDeletion, keptCensusAfterDeletion, "after deleting the other class");
      assert.equal(readElementProp(b1, keptElementId, "userLabel"), "keep");
      assert.isUndefined(readElementProp(b1, deletedElementId, "value"));
      assert.deepEqual(queryPropNames(b1, "SchemaSyncLifecycle:EmptyClass"), []);
      assert.isFalse(b1.txns.hasLocalChanges, "upgradeSchemaStrings pushes the class deletion");
    } finally {
      b1.close();
    }
  });

  // Relationship instances live in a link table with foreign keys to both endpoint classes, so the retry must remove that table while preserving both endpoint censuses.
  extendedIt("a relationship with instances follows the full deletion retry pattern", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "sync-life-13" });
    const accessToken = "sync life relationship deletion token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "sync life relationship deletion", accessToken });
    const b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife13b1" });
    const b2 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife13b2" });

    try {
      await enableSchemaSync(b1, containerProps);
      const relationshipXml = `<ECRelationshipClass typeName="SourceLinksToTarget" strength="referencing" strengthDirection="forward" modifier="Sealed">
    <BaseClass>bis:ElementRefersToElements</BaseClass>
    <Source multiplicity="(0..*)" roleLabel="source" polymorphic="false">
        <Class class="SourceElement"/>
    </Source>
    <Target multiplicity="(0..*)" roleLabel="target" polymorphic="false">
        <Class class="TargetElement"/>
    </Target>
</ECRelationshipClass>`;
      const schemaV1: TinySchema = {
        name: "SchemaSyncRelationshipDeletion",
        alias: "ssrd",
        ver: "01.00.00",
        dynamic: true,
        refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
        classes: [{
          type: "entity",
          name: "SourceElement",
          baseClass: "bis:GeometricElement2d",
          props: [{ kind: "primitive", name: "sourceValue", type: "string" }],
        }, {
          type: "entity",
          name: "TargetElement",
          baseClass: "bis:GeometricElement2d",
          props: [{ kind: "primitive", name: "targetValue", type: "string" }],
        }],
        rawXml: [relationshipXml],
      };
      await importTinySchema(b1, schemaV1);
      await b1.pushChanges({ accessToken, description: "initial relationship deletion schema" });
      await b2.pullChanges({ accessToken });

      const place = await insertDrawingModelAndCategory(b1, "SyncLifeRelationshipDeletion");
      const sourceId = await insertGeometricElement2d(b1, {
        ...place,
        classFullName: "SchemaSyncRelationshipDeletion:SourceElement",
        props: { sourceValue: "source survives" },
      });
      const targetId = await insertGeometricElement2d(b1, {
        ...place,
        classFullName: "SchemaSyncRelationshipDeletion:TargetElement",
        props: { targetValue: "target survives" },
      });
      const relationshipId = withEditTxn(b1, (txn) => txn.insertRelationship({
        classFullName: "SchemaSyncRelationshipDeletion:SourceLinksToTarget",
        sourceId,
        targetId,
      }));
      assert.isNotEmpty(relationshipId);
      await b1.pushChanges({ accessToken, description: "relationship deletion data" });
      await b2.pullChanges({ accessToken });
      const beforeB1 = await takeElementCensus(b1, ["SchemaSyncRelationshipDeletion:SourceElement", "SchemaSyncRelationshipDeletion:TargetElement"]);
      const beforeB2 = await takeElementCensus(b2, ["SchemaSyncRelationshipDeletion:SourceElement", "SchemaSyncRelationshipDeletion:TargetElement"]);

      const schemaWithoutRelationship: TinySchema = { ...schemaV1, ver: "02.00.00", rawXml: [] };
      let caughtError: unknown;
      try {
        await importTinySchema(b1, schemaWithoutRelationship);
      } catch (error) {
        caughtError = error;
      }
      assert.isDefined(caughtError, "deleting a relationship with instances should report the upgrade requirement");
      assert.isTrue(SchemaSync.requiresUpgrade(caughtError));
      assert.equal((caughtError as { errorNumber?: number }).errorNumber, DbResult.BE_SQLITE_ERROR_DataDeletionRequired);

      await b1.upgradeSchemaStrings([tinySchemaToXml(schemaWithoutRelationship)], { accessToken, description: "remove relationship with instances" });
      await b2.pullChanges({ accessToken });
      const afterB1 = await takeElementCensus(b1, ["SchemaSyncRelationshipDeletion:SourceElement", "SchemaSyncRelationshipDeletion:TargetElement"]);
      const afterB2 = await takeElementCensus(b2, ["SchemaSyncRelationshipDeletion:SourceElement", "SchemaSyncRelationshipDeletion:TargetElement"]);
      expectCensusPreserved(beforeB1, afterB1, "on the relationship deletion importer");
      expectCensusPreserved(beforeB2, afterB2, "on the relationship deletion puller");
      assert.equal(readElementProp(b1, sourceId, "sourceValue"), "source survives");
      assert.equal(readElementProp(b2, targetId, "targetValue"), "target survives");
      await assertThrowsAsync(async () => b1.createQueryReader("SELECT ECInstanceId FROM ONLY SchemaSyncRelationshipDeletion:SourceLinksToTarget").toArray());
      expectMetadataTablesIdentical(b1, b2, "after relationship deletion", { a: "b1", b: "b2" });
      expectPhysicalSchemaIdentical(b1, b2, "after relationship deletion");
      expectNoForeignKeyViolations(b1, "relationship deletion importer");
      expectNoForeignKeyViolations(b2, "relationship deletion puller");
      assert.isFalse(b1.txns.hasLocalChanges);
    } finally {
      b1.close();
      b2.close();
    }
  });

  it("a readonly briefcase reports schema sync enabled and writes nothing", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "sync-life-3" });
    const accessToken = "sync life readonly token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "sync life readonly", accessToken });
    const b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife3b1" });
    let readonlyBriefcase: BriefcaseDb | undefined;

    try {
      await enableSchemaSync(b1, containerProps);
      const schema: TinySchema = {
        name: "SchemaSyncReadonly",
        alias: "ssr",
        ver: "01.00.00",
        dynamic: true,
        refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
        classes: [{
          type: "entity",
          name: "ReadonlyClass",
          baseClass: "bis:GeometricElement2d",
          props: [{ kind: "primitive", name: "value", type: "string" }],
        }],
      };
      await importTinySchema(b1, schema);
      await b1.pushChanges({ accessToken, description: "readonly schema" });
      const place = await insertDrawingModelAndCategory(b1, "SyncLife3");
      const elementId = await insertGeometricElement2d(b1, {
        ...place,
        classFullName: "SchemaSyncReadonly:ReadonlyClass",
        props: { value: "read only" },
      });
      await b1.pushChanges({ accessToken, description: "readonly data" });
      const fileName = b1.pathName;
      b1.close();
      const modificationTimeBefore = statSync(fileName).mtimeMs;

      readonlyBriefcase = await reopenTestBriefcase(fileName, { readonly: true });
      const dataVersionBefore = queryDataVersion(readonlyBriefcase);
      assert.isTrue(SchemaSync.isEnabled(readonlyBriefcase));
      assert.equal(SchemaSync.queryContainerProps(readonlyBriefcase)?.containerId, containerProps.containerId);
      assert.equal(readElementProp(readonlyBriefcase, elementId, "value"), "read only");
      const rows = await readonlyBriefcase.createQueryReader("SELECT ECInstanceId FROM SchemaSyncReadonly:ReadonlyClass").toArray();
      assert.lengthOf(rows, 1);

      const newerSchema: TinySchema = {
        ...schema,
        ver: "01.00.01",
        classes: [{ ...schema.classes![0], props: [...schema.classes![0].props!, { kind: "primitive", name: "newValue", type: "string" }] }],
      };
      await assertThrowsAsync(async () => importTinySchema(readonlyBriefcase!, newerSchema));
      assert.deepEqual(queryPropNames(readonlyBriefcase, "SchemaSyncReadonly:ReadonlyClass"), ["value"]);
      assert.equal(queryDataVersion(readonlyBriefcase), dataVersionBefore);
      assert.equal(statSync(fileName).mtimeMs, modificationTimeBefore);
    } finally {
      if (b1.isOpen)
        b1.close();
      readonlyBriefcase?.close();
    }
  });

  // Opening after two schema changes forces a readonly reader to join the overflow table without being able to materialize or repair it.
  extendedIt("a readonly briefcase reads an overflow class after several schema changes without writing", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "sync-life-14" });
    const accessToken = "sync life readonly overflow token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "sync life readonly overflow", accessToken });
    const b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife14b1" });
    let readonlyBriefcase: BriefcaseDb | undefined;

    try {
      await enableSchemaSync(b1, containerProps);
      const schemaV1: TinySchema = {
        name: "SchemaSyncReadonlyOverflow",
        alias: "ssro",
        ver: "01.00.00",
        dynamic: true,
        refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
        classes: [{
          type: "entity",
          name: "OverflowClass",
          baseClass: "bis:GeometricElement2d",
          props: [{ kind: "primitive", name: "stableValue", type: "string" }],
        }],
      };
      await importTinySchema(b1, schemaV1);
      await b1.pushChanges({ accessToken, description: "initial readonly overflow schema" });
      const place = await insertDrawingModelAndCategory(b1, "SyncLifeReadonlyOverflow");
      const elementId = await insertGeometricElement2d(b1, {
        ...place,
        classFullName: "SchemaSyncReadonlyOverflow:OverflowClass",
        props: { stableValue: "overflow reader" },
      });
      await b1.pushChanges({ accessToken, description: "readonly overflow data" });

      const overflowProperties = Array.from({ length: 40 }, (_, index) => ({
        kind: "primitive" as const,
        name: `overflow${index}`,
        type: "string" as const,
      }));
      const schemaV2: TinySchema = {
        ...schemaV1,
        ver: "01.00.01",
        classes: [{ ...schemaV1.classes![0], props: [...schemaV1.classes![0].props!, ...overflowProperties] }],
      };
      await importTinySchema(b1, schemaV2);
      await b1.pushChanges({ accessToken, description: "spill readonly overflow properties" });
      const schemaV3: TinySchema = {
        ...schemaV2,
        ver: "01.00.02",
        classes: [{ ...schemaV2.classes![0], props: [...schemaV2.classes![0].props!, { kind: "primitive", name: "afterSpill", type: "string" }] }],
      };
      await importTinySchema(b1, schemaV3);
      await b1.pushChanges({ accessToken, description: "add property after readonly overflow spill" });

      b1.close();
      readonlyBriefcase = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife14readonly", readonly: true });
      const readonlyFileName = readonlyBriefcase.pathName;
      const dataVersionBefore = queryDataVersion(readonlyBriefcase);
      const modificationTimeBefore = statSync(readonlyFileName).mtimeMs;
      assert.isTrue(SchemaSync.isEnabled(readonlyBriefcase));
      assert.equal(SchemaSync.queryContainerProps(readonlyBriefcase)?.containerId, containerProps.containerId);
      assert.include(queryPropNames(readonlyBriefcase, "SchemaSyncReadonlyOverflow:OverflowClass"), "overflow39");
      assert.include(queryPropNames(readonlyBriefcase, "SchemaSyncReadonlyOverflow:OverflowClass"), "afterSpill");
      assert.equal(readElementProp(readonlyBriefcase, elementId, "stableValue"), "overflow reader");
      assert.equal(readElementProp(readonlyBriefcase, elementId, "overflow39"), undefined);
      const rows = await readonlyBriefcase.createQueryReader("SELECT ECInstanceId FROM SchemaSyncReadonlyOverflow:OverflowClass").toArray();
      assert.lengthOf(rows, 1);

      const schemaV4: TinySchema = {
        ...schemaV3,
        ver: "01.00.03",
        classes: [{ ...schemaV3.classes![0], props: [...schemaV3.classes![0].props!, { kind: "primitive", name: "readonlyWrite", type: "string" }] }],
      };
      await assertThrowsAsync(async () => importTinySchema(readonlyBriefcase!, schemaV4));
      assert.equal(queryDataVersion(readonlyBriefcase), dataVersionBefore);
      assert.equal(statSync(readonlyFileName).mtimeMs, modificationTimeBefore);
    } finally {
      if (b1.isOpen)
        b1.close();
      readonlyBriefcase?.close();
    }
  });

  it("importing an older schema version leaves the newer one in place", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "sync-life-4" });
    const accessToken = "sync life older schema token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "sync life older schema", accessToken });
    const b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife4b1" });
    const b2 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife4b2" });

    try {
      await enableSchemaSync(b1, containerProps);
      const newerSchema: TinySchema = {
        name: "SchemaSyncVersions",
        alias: "ssv",
        ver: "01.00.01",
        dynamic: true,
        refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
        classes: [{
          type: "entity",
          name: "VersionedClass",
          baseClass: "bis:GeometricElement2d",
          props: [
            { kind: "primitive", name: "first", type: "string" },
            { kind: "primitive", name: "second", type: "string" },
          ],
        }],
      };
      await importTinySchema(b1, newerSchema);
      await b1.pushChanges({ accessToken, description: "newer schema version" });
      await b2.pullChanges({ accessToken });

      const olderSchema: TinySchema = {
        ...newerSchema,
        ver: "01.00.00",
        classes: [{ ...newerSchema.classes![0], props: [newerSchema.classes![0].props![0]] }],
      };
      // SchemaSyncDb is authoritative, so this successful import keeps the newer schema in place.
      await importTinySchema(b2, olderSchema);
      assert.deepEqual(queryPropNames(b2, "SchemaSyncVersions:VersionedClass"), ["first", "second"]);
    } finally {
      b1.close();
      b2.close();
    }
  });

  // The stale import now arrives from a second briefcase that already contains data under the newer schema, so both files must retain the newer property set and their elements.
  extendedIt("a stale schema import from a second briefcase loses no properties", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "sync-life-15" });
    const accessToken = "sync life stale schema token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "sync life stale schema", accessToken });
    const b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife15b1" });
    const b2 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife15b2" });

    try {
      await enableSchemaSync(b1, containerProps);
      const newerSchema: TinySchema = {
        name: "SchemaSyncStaleImport",
        alias: "sssi",
        ver: "01.00.01",
        dynamic: true,
        refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
        classes: [{
          type: "entity",
          name: "VersionedClass",
          baseClass: "bis:GeometricElement2d",
          props: [
            { kind: "primitive", name: "first", type: "string" },
            { kind: "primitive", name: "second", type: "string" },
          ],
        }],
      };
      await importTinySchema(b1, newerSchema);
      await b1.pushChanges({ accessToken, description: "newer stale-import schema" });
      await b2.pullChanges({ accessToken });

      const place = await insertDrawingModelAndCategory(b2, "SyncLifeStaleImport");
      const elementId = await insertGeometricElement2d(b2, {
        ...place,
        classFullName: "SchemaSyncStaleImport:VersionedClass",
        props: { first: "first survives", second: "second survives" },
      });
      await b2.pushChanges({ accessToken, description: "stale-import data" });
      await b1.pullChanges({ accessToken });
      const beforeB1 = await takeElementCensus(b1, ["SchemaSyncStaleImport:VersionedClass"]);
      const beforeB2 = await takeElementCensus(b2, ["SchemaSyncStaleImport:VersionedClass"]);

      const olderSchema: TinySchema = {
        ...newerSchema,
        ver: "01.00.00",
        classes: [{ ...newerSchema.classes![0], props: [newerSchema.classes![0].props![0]] }],
      };
      await importTinySchema(b2, olderSchema);
      // querySchemaVersion answers semver, not the padded ECXml form.
      assert.equal(b1.querySchemaVersion("SchemaSyncStaleImport"), "1.0.1");
      assert.equal(b2.querySchemaVersion("SchemaSyncStaleImport"), "1.0.1");
      assert.deepEqual(queryPropNames(b1, "SchemaSyncStaleImport:VersionedClass"), ["first", "second"]);
      assert.deepEqual(queryPropNames(b2, "SchemaSyncStaleImport:VersionedClass"), ["first", "second"]);
      assert.equal(readElementProp(b1, elementId, "second"), "second survives");
      assert.equal(readElementProp(b2, elementId, "second"), "second survives");
      expectCensusPreserved(beforeB1, await takeElementCensus(b1, ["SchemaSyncStaleImport:VersionedClass"]), "on the newer briefcase after stale import");
      expectCensusPreserved(beforeB2, await takeElementCensus(b2, ["SchemaSyncStaleImport:VersionedClass"]), "on the stale-import briefcase");
      assert.isFalse(b2.txns.hasLocalChanges, "the older import should not create a local schema change");
    } finally {
      b1.close();
      b2.close();
    }
  });

  it("publishes schema sync only after the initialized container is uploaded", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "sync-life-init-upload" });
    const accessToken = "sync life init upload token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "sync life init upload", accessToken });
    const b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLifeInitUploadB1" });
    const b2 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLifeInitUploadB2" });

    try {
      failInsideTheContainerLock();
      await assertThrowsAsync(async () => SchemaSync.initializeForIModel({ iModel: b1, containerProps }), containerLockFailureMessage);
      sinon.restore();

      assert.isFalse(SchemaSync.isEnabled(b1), "the failed container upload left schema sync enabled locally");
      assert.isFalse(b1.txns.hasLocalChanges, "the failed container upload left the initialization txn behind");
      await b2.pullChanges({ accessToken });
      assert.isFalse(SchemaSync.isEnabled(b2), "the initialization reached the timeline before the container upload");

      await SchemaSync.initializeForIModel({ iModel: b1, containerProps });
      await b2.pullChanges({ accessToken });
      assert.isTrue(SchemaSync.isEnabled(b2), "the initialization did not reach the timeline after a successful upload");
    } finally {
      sinon.restore();
      b1.close();
      b2.close();
    }
  });

  extendedIt("enabling schema sync from a briefcase that is behind the tip is refused", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "sync-life-5" });
    const accessToken = "sync life enable token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "sync life enable", accessToken });
    const b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife5b1" });
    const b2 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife5b2" });

    try {
      const schema: TinySchema = {
        name: "SchemaSyncEnable",
        alias: "sse",
        ver: "01.00.00",
        dynamic: true,
        refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
        classes: [{
          type: "entity",
          name: "EnableClass",
          baseClass: "bis:GeometricElement2d",
          props: [{ kind: "primitive", name: "value", type: "string" }],
        }],
      };
      await importTinySchema(b1, schema);
      await assertThrowsAsync(
        async () => SchemaSync.initializeForIModel({ iModel: b1, containerProps }),
        "Cannot enable SchemaSync while there are local changes",
      );

      await b1.pushChanges({ accessToken, description: "schema before enable" });
      await SchemaSync.initializeForIModel({ iModel: b1, containerProps });
      await assertThrowsAsync(
        async () => SchemaSync.initializeForIModel({ iModel: b2, containerProps }),
        "pull is required to obtain lock",
      );
    } finally {
      b1.close();
      b2.close();
    }
  });

  // This briefcase misses a committed data changeset before initialization, so the level check must report a pull requirement rather than the local-changes error used for schema edits.
  extendedIt("enabling schema sync after a data-only gap is refused", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "sync-life-16" });
    const accessToken = "sync life data gap token";
    const { iTwinId, iModelId } = await createTestIModel({ iModelName: "sync life data gap", accessToken });
    const b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife16b1" });
    const b2 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife16b2" });

    try {
      const place = await insertDrawingModelAndCategory(b1, "SyncLifeDataGap");
      assert.isDefined(place.drawingModelId);
      await b1.pushChanges({ accessToken, description: "data before schema sync enable" });
      await SchemaSync.initializeForIModel({ iModel: b1, containerProps });
      assert.isTrue(SchemaSync.isEnabled(b1));
      await assertThrowsAsync(
        async () => SchemaSync.initializeForIModel({ iModel: b2, containerProps }),
        "pull is required to obtain lock",
      );
    } finally {
      b1.close();
      b2.close();
    }
  });

  // A V1 checkpoint is a readonly copy of the schema-sync-enabled file; its metadata flags and overflow join must remain usable without any local write.
  extendedIt("a schema-sync-enabled checkpoint stays readable and write-free", async () => {
    const containerProps = await initializeContainer({ baseUri: AzuriteTest.baseUri, containerId: "sync-life-17" });
    const accessToken = "sync life checkpoint token";
    HubMock.startup("schema-sync-lifecycle-checkpoint", KnownTestLocations.outputDir, { createTipCheckpointOnPush: true });
    const iTwinId = HubMock.iTwinId;
    const iModelName = "sync life checkpoint";
    const version0 = IModelTestUtils.prepareOutputFile("schemaSync", `${iModelName}.bim`);
    SnapshotDb.createEmpty(version0, { rootSubject: { name: iModelName } }).close();
    const iModelId = await HubMock.createNewIModel({ iTwinId, version0, iModelName, accessToken });
    const b1 = await openTestBriefcase({ iTwinId, iModelId, accessToken, cacheName: "syncLife17b1" });
    let checkpoint: SnapshotDb | undefined;

    try {
      await enableSchemaSync(b1, containerProps);
      const overflowProperties = Array.from({ length: 40 }, (_, index) => ({
        kind: "primitive" as const,
        name: `overflow${index}`,
        type: "string" as const,
      }));
      const schema: TinySchema = {
        name: "SchemaSyncCheckpoint",
        alias: "sscp",
        ver: "01.00.00",
        dynamic: true,
        refs: [{ name: "BisCore", ver: "01.00.00", alias: "bis" }],
        classes: [{
          type: "entity",
          name: "OverflowClass",
          baseClass: "bis:GeometricElement2d",
          props: [{ kind: "primitive", name: "stableValue", type: "string" }, ...overflowProperties],
        }],
      };
      await importTinySchema(b1, schema);
      await b1.pushChanges({ accessToken, description: "checkpoint overflow schema" });
      const place = await insertDrawingModelAndCategory(b1, "SyncLifeCheckpoint");
      const elementId = await insertGeometricElement2d(b1, {
        ...place,
        classFullName: "SchemaSyncCheckpoint:OverflowClass",
        props: { stableValue: "checkpoint data", overflow39: "overflow data" },
      });
      await b1.pushChanges({ accessToken, description: "checkpoint overflow data" });
      const changeset = await HubMock.getLatestChangeset({ iModelId });
      checkpoint = await SnapshotDb.openCheckpoint({ iTwinId, iModelId, changeset });
      const checkpointFileName = checkpoint.pathName;
      const dataVersionBefore = queryDataVersion(checkpoint);
      const modificationTimeBefore = statSync(checkpointFileName).mtimeMs;

      assert.isTrue(checkpoint.isSnapshot);
      assert.isTrue(checkpoint.isReadonly);
      assert.isTrue(SchemaSync.isEnabled(checkpoint));
      assert.equal(SchemaSync.queryContainerProps(checkpoint)?.containerId, containerProps.containerId);
      assert.equal(readElementProp(checkpoint, elementId, "stableValue"), "checkpoint data");
      assert.equal(readElementProp(checkpoint, elementId, "overflow39"), "overflow data");
      const rows = await checkpoint.createQueryReader("SELECT ECInstanceId FROM SchemaSyncCheckpoint:OverflowClass").toArray();
      assert.lengthOf(rows, 1);
      await takeElementCensus(checkpoint, ["SchemaSyncCheckpoint:OverflowClass"]);
      assert.equal(queryDataVersion(checkpoint), dataVersionBefore);
      assert.equal(statSync(checkpointFileName).mtimeMs, modificationTimeBefore);
    } finally {
      checkpoint?.close();
      b1.close();
    }
  });
});
