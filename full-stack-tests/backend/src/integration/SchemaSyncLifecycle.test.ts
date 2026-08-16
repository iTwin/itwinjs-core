/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { statSync } from "fs";
import { assert } from "chai";
import { Suite } from "mocha";
import { BriefcaseDb, IModelDb, IModelHost, SchemaSync } from "@itwin/core-backend";
import { HubMock } from "@itwin/core-backend/lib/cjs/internal/HubMock";
import { DbResult } from "@itwin/core-bentley";
import {
  assertThrowsAsync, createTestIModel, enableSchemaSync, expectCensusPreserved, expectMetadataTablesIdentical, expectPhysicalSchemaIdentical,
  importTinySchema, initializeContainer, insertDrawingModelAndCategory, insertGeometricElement2d, openTestBriefcase, queryPropNames,
  readElementProp, reopenTestBriefcase, takeElementCensus, TinyClass, TinySchema, tinySchemaToXml,
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

  it("enabling schema sync from a briefcase that is behind the tip is refused #extended", async () => {
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
});
