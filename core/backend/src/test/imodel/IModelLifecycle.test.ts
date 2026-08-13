/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import * as semver from "semver";
import * as sinon from "sinon";
import { DbResult, Guid, GuidString, Id64, IModelStatus, Logger, OpenMode } from "@itwin/core-bentley";
import { BriefcaseIdValue, ChangesetIdWithIndex, Code, EcefLocation, FilePropertyProps, GeometricElementProps, IModel, IModelError, SchemaState, SubCategoryAppearance, TypeDefinitionElementProps } from "@itwin/core-common";
import { ECVersion } from "@itwin/ecschema-metadata";
import { V2CheckpointAccessProps } from "../../BackendHubAccess";
import { V2CheckpointManager } from "../../CheckpointManager";
import { EditTxn, withEditTxn } from "../../EditTxn";
import { GenericGraphicalType2d, IModelDb, IModelHost, IModelJsFs, PhysicalModel, PhysicalObject, SnapshotDb, SpatialCategory, StandaloneDb, Subject } from "../../core-backend";
import { BriefcaseDb, SnapshotDbOpenArgs } from "../../IModelDb";
import { HubMock } from "../../internal/HubMock";
import { _cache, _hubAccess, _instanceKeyCache, _nativeDb } from "../../internal/Symbols";
import { IModelTestUtils } from "../IModelTestUtils";
import { TestUtils } from "../TestUtils";
import { performance } from "perf_hooks";
import { createIModelFromSeed, expectIModelError, getIModelError, importTestBim } from "./IModelTestFixtures";


describe("iModel lifecycle", () => {
  let originalEnv: NodeJS.ProcessEnv;

  before(async () => {
    originalEnv = { ...process.env };
    await TestUtils.startBackend();
    IModelTestUtils.registerTestBimSchema();
  });

  after(() => {
    process.env = originalEnv;
  });

  afterEach(() => {
    sinon.restore();
  });

  function hasClassView(db: IModelDb, name: string): boolean {
    try {
      return db.withSqliteStatement(`SELECT ECInstanceId FROM [${name}]`, (): boolean => true, false);
    } catch {
      return false;
    }
  }

  it("should be able to create a snapshot IModel", async () => {
    const args = {
      rootSubject: { name: "TestSubject", description: "test iTwin" },
      client: "ABC Engineering",
      globalOrigin: { x: 10, y: 10 },
      projectExtents: { low: { x: -300, y: -300, z: -20 }, high: { x: 500, y: 500, z: 400 } },
      guid: Guid.createValue(),
    };

    const iModel = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("IModel", "TestSnapshot.bim"), args);
    assert.equal(iModel.iModelId, args.guid);
    assert.equal(iModel.rootSubject.name, args.rootSubject.name);
    assert.equal(iModel.rootSubject.description, args.rootSubject.description);
    assert.equal(iModel.projectExtents.low.x, args.projectExtents.low.x);
    assert.equal(iModel.projectExtents.low.y, args.projectExtents.low.y);
    assert.equal(iModel.projectExtents.low.z, args.projectExtents.low.z);
    assert.equal(iModel.globalOrigin.x, args.globalOrigin.x);
    assert.equal(iModel.globalOrigin.y, args.globalOrigin.y);
    assert.equal(iModel.globalOrigin.z, 0);

    const client = iModel.queryFilePropertyString({ name: "Client", namespace: "dgn_Db" });
    assert.equal(client, args.client, "query Client property");

    const dbguid = iModel.queryFilePropertyBlob({ name: "DbGuid", namespace: "be_Db" });
    assert.equal(dbguid!.byteLength, 16, "query guid property");

    const myPropsStr: FilePropertyProps = { name: "MyProp", namespace: "test1", id: 1, subId: 1 };
    const myStrVal = "this is a test";
    const myPropsBlob: FilePropertyProps = { name: "MyBlob", namespace: "test1", id: 10 };
    const testRange = new Uint8Array(500);
    testRange.fill(11);
    withEditTxn(iModel, (txn) => {
      txn.saveFileProperty(myPropsStr, myStrVal);
      const readFromDb = iModel.queryFilePropertyString(myPropsStr);
      assert.equal(readFromDb, myStrVal, "query string after save");

      txn.saveFileProperty(myPropsBlob, undefined, testRange);
      const blobFromDb = iModel.queryFilePropertyBlob(myPropsBlob);
      assert.deepEqual(blobFromDb, testRange, "query blob after save");

      let next = iModel.queryNextAvailableFileProperty(myPropsBlob);
      assert.equal(11, next, "queryNextAvailableFileProperty blob");

      next = iModel.queryNextAvailableFileProperty(myPropsStr);
      assert.equal(2, next, "queryNextAvailableFileProperty str");
      txn.deleteFileProperty(myPropsStr);
      assert.isUndefined(iModel.queryFilePropertyString(myPropsStr), "property was deleted");
      next = iModel.queryNextAvailableFileProperty(myPropsStr);
      assert.equal(0, next, "queryNextAvailableFileProperty, should return 0 when none present");
    });

    const testLocal = "TestLocal";
    const testValue = "this is a test";
    const nativeDb = iModel[_nativeDb];
    assert.isUndefined(nativeDb.queryLocalValue(testLocal));
    nativeDb.saveLocalValue(testLocal, testValue);
    assert.equal(nativeDb.queryLocalValue(testLocal), testValue);

    iModel.close();
  });
  it("should be able to open checkpoints for RPC", async () => {
    const changeset: ChangesetIdWithIndex = { id: "fakeChangeSetId", index: 10 };
    const iTwinId = "fakeIModelId";
    const iModelId = "fakeIModelId";
    const cloudContainer = { accessToken: "sas" };
    const fakeSnapshotDb: any =
    {
      cloudContainer,
      isReadonly: () => true,
      isOpen: () => true,
      getIModelId: () => iModelId,
      getITwinId: () => iTwinId,
      getCurrentChangeset: () => changeset,
      hasUnsavedChanges: () => false,
      setIModelDb: () => { },
      closeFile: () => { },
      clearECDbCache: () => { },
    };

    const errorLogStub = sinon.stub(Logger, "logError").callsFake(() => { });
    const infoLogStub = sinon.stub(Logger, "logInfo").callsFake(() => { });

    // Mock iModelHub
    const mockCheckpointV2: V2CheckpointAccessProps = {
      accountName: "testAccount",
      containerId: "imodelblocks-123",
      sasToken: "testSAS",
      dbName: "testDb",
      storageType: "azure?sas=1",
    };

    sinon.stub(IModelHost, _hubAccess).get(() => HubMock);
    sinon.stub(V2CheckpointManager, "attach").callsFake(async () => {
      return { dbName: "fakeDb", container: { accessToken: "sas" } as any };
    });
    const queryStub = sinon.stub(IModelHost[_hubAccess], "queryV2Checkpoint").callsFake(async () => mockCheckpointV2);

    const openDgnDbStub = sinon.stub(SnapshotDb, "openDgnDb").returns(fakeSnapshotDb);
    sinon.stub(IModelDb.prototype, "initializeIModelDb" as any);
    sinon.stub(IModelDb.prototype, "loadIModelSettings" as any);

    const accessToken = "token";
    const checkpoint = await SnapshotDb.openCheckpointFromRpc({ accessToken, iTwinId, iModelId, changeset });
    expect(openDgnDbStub.calledOnce).to.be.true;
    expect(openDgnDbStub.firstCall.firstArg.path).to.equal("fakeDb");

    const props = checkpoint.getRpcProps();
    assert.equal(props.iModelId, iModelId);
    assert.equal(props.iTwinId, iTwinId);
    assert.equal(props.changeset?.id, changeset.id);
    assert.equal(errorLogStub.callCount, 1);
    assert.include(errorLogStub.args[0][1], "attached with timestamp that expires before");

    errorLogStub.resetHistory();
    expect(cloudContainer.accessToken).equal("sas");
    await checkpoint.refreshContainerForRpc(accessToken);
    expect(cloudContainer.accessToken).equal("testSAS");

    assert.equal(errorLogStub.callCount, 1);
    assert.include(errorLogStub.args[0][1], "attached with timestamp that expires before");
    assert.equal(infoLogStub.callCount, 2);
    assert.include(infoLogStub.args[0][1], "attempting to refresh");
    assert.include(infoLogStub.args[1][1], "refreshed checkpoint");

    errorLogStub.resetHistory();
    queryStub.callsFake(async () => {
      throw new Error("no checkpoint");
    });
    await expect(checkpoint.refreshContainerForRpc(accessToken)).to.eventually.be.rejectedWith("no checkpoint");

    checkpoint.close();
  });
  it("should throw for missing/invalid checkpoint in hub", async () => {
    process.env.CHECKPOINT_CACHE_DIR = "/foo/";
    sinon.stub(IModelHost, _hubAccess).get(() => HubMock);
    sinon.stub(IModelHost[_hubAccess], "queryV2Checkpoint").callsFake(async () => undefined);

    const accessToken = "token";
    const error = await getIModelError(SnapshotDb.openCheckpointFromRpc({ accessToken, iTwinId: Guid.createValue(), iModelId: Guid.createValue(), changeset: IModelTestUtils.generateChangeSetId() }));
    expectIModelError(IModelStatus.NotFound, error);
  });
  it("attempting to re-attach a non-checkpoint snapshot should be a no-op", async () => {
    process.env.CHECKPOINT_CACHE_DIR = "/foo/";
    const accessToken = "token";
    const imodel = await importTestBim(createIModelFromSeed("reattachNonCheckpoint.bim", "test.bim"));
    try {
      await imodel.refreshContainerForRpc(accessToken);
    } finally {
      imodel.close();
    }
  });
  it("Check busyTimeout option", () => {
    const standaloneFile = IModelTestUtils.prepareOutputFile("IModel", "StandaloneReadWrite.bim");
    const tryOpen = (fileName: string, options?: SnapshotDbOpenArgs) => {
      const start = performance.now();
      let didThrow = false;
      try {
        StandaloneDb.openFile(fileName, OpenMode.ReadWrite, options);
      } catch (e: any) {
        assert.strictEqual(e.errorNumber, DbResult.BE_SQLITE_BUSY, "Expect error 'Db is busy'");
        didThrow = true;
      }
      assert.isTrue(didThrow);
      return performance.now() - start;
    };
    const seconds = (s: number) => s * 1000;

    const db = StandaloneDb.createEmpty(standaloneFile, { rootSubject: { name: "Standalone" } });
    const txn = new EditTxn(db, "busy timeout test");
    txn.start();
    // lock db so another connection cannot write to it.
    txn.saveFileProperty({ name: "test", namespace: "test" }, "");

    assert.isAtMost(tryOpen(standaloneFile, { busyTimeout: seconds(0) }), seconds(1), "open should fail with busy error instantly");
    assert.isAtLeast(tryOpen(standaloneFile, { busyTimeout: seconds(1) }), seconds(1), "open should fail with atleast 1 sec delay due to retry");
    assert.isAtLeast(tryOpen(standaloneFile, { busyTimeout: seconds(2) }), seconds(2), "open should fail with atleast 2 sec delay due to retry");
    assert.isAtLeast(tryOpen(standaloneFile, { busyTimeout: seconds(3) }), seconds(3), "open should fail with atleast 3 sec delay due to retry");

    txn.end("abandon");
    db.close();
  });
  it("Cache cleared on abandonChanges", () => {
    const standaloneFile = IModelTestUtils.prepareOutputFile("IModel", "StandaloneReadWrite.bim");
    const db = StandaloneDb.createEmpty(standaloneFile, { rootSubject: { name: "Standalone" } });
    const txn = new EditTxn(db, "cache cleared on abandonChanges");
    txn.start();

    const code = Code.createEmpty();
    code.value = "foo";
    const props: TypeDefinitionElementProps = {
      classFullName: GenericGraphicalType2d.classFullName,
      model: IModel.dictionaryId,
      code,
    };
    const id = txn.insertElement(props);
    const element1 = db.elements.getElementProps(id);
    txn.end("abandon");

    code.value = "bar";
    const props2: TypeDefinitionElementProps = {
      classFullName: GenericGraphicalType2d.classFullName,
      model: IModel.dictionaryId,
      code,
    };
    const retryTxn = new EditTxn(db, "cache cleared on abandonChanges retry");
    retryTxn.start();
    const id2 = retryTxn.insertElement(props2);
    expect(id2).to.equal(id);
    const element2 = db.elements.getElementProps(id2);
    expect(element2).to.not.equal(element1);

    // Exercise the ECSqlStatement cache directly - nothing in the normal insert/read path above uses it anymore.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    db.withPreparedStatement("SELECT ECInstanceId FROM BisCore:Element LIMIT 1", () => { });

    // Make sure that the statement caches are not cleared
    expect((db as any)._sqliteStatementCache.size).to.be.greaterThan(0);
    expect((db as any)._statementCache.size).to.be.greaterThan(0);

    retryTxn.end("abandon");
    db.close();
  });
  it("Only instance caches should be cleared with clearCaches instanceCachesOnly parameter", () => {
    const standaloneFile = IModelTestUtils.prepareOutputFile("IModel", "StandaloneReadWrite.bim");
    const db = StandaloneDb.createEmpty(standaloneFile, { rootSubject: { name: "Standalone" } });
    const txn = new EditTxn(db, "clearCaches instanceCachesOnly");
    txn.start();

    const code = Code.createEmpty();
    code.value = "foo";
    const props: TypeDefinitionElementProps = {
      classFullName: GenericGraphicalType2d.classFullName,
      model: IModel.dictionaryId,
      code,
    };
    const id = txn.insertElement(props);
    db.elements.getElementProps(id);
    db.models.getModelProps(IModel.dictionaryId);
    // Exercise the ECSqlStatement cache directly - nothing in the normal insert/read path above uses it anymore.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    db.withPreparedStatement("SELECT ECInstanceId FROM BisCore:Element LIMIT 1", () => { });

    expect(db.elements[_cache].size).to.be.greaterThan(0);
    expect(db.models[_cache].size).to.be.greaterThan(0);
    expect(db.elements[_instanceKeyCache].size).to.be.greaterThan(0);
    expect(db.models[_instanceKeyCache].size).to.be.greaterThan(0);

    db.clearCaches({ instanceCachesOnly: true });

    expect(db.elements[_cache].size).to.equal(0);
    expect(db.models[_cache].size).to.equal(0);
    expect(db.elements[_instanceKeyCache].size).to.equal(0);
    expect(db.models[_instanceKeyCache].size).to.equal(0);

    // Make sure that the statement caches are not cleared
    expect((db as any)._sqliteStatementCache.size).to.be.greaterThan(0);
    expect((db as any)._statementCache.size).to.be.greaterThan(0);

    txn.end("abandon");
    db.close();
  });
  it("inserting a second element with an empty code must not evict the first from the element props cache", () => {
    const standaloneFile = IModelTestUtils.prepareOutputFile("IModel", "EmptyCodeCacheCollision.bim");
    const db = StandaloneDb.createEmpty(standaloneFile, { rootSubject: { name: "EmptyCodeCacheCollision" } });

    withEditTxn(db, (txn) => {
      const categoryId = SpatialCategory.insert(txn, IModel.dictionaryId, "TestCategory", new SubCategoryAppearance());
      const modelId = PhysicalModel.insert(txn, IModel.rootSubjectId, "TestModel");

      const emptyCodeProps: GeometricElementProps = {
        classFullName: PhysicalObject.classFullName,
        model: modelId,
        category: categoryId,
        code: Code.createEmpty(),
      };

      // Insert the first element
      const id1 = txn.insertElement({ ...emptyCodeProps });
      db.elements.getElementProps(id1); // populate the element props cache
      const cacheSizeAfterFirstInsertAndRead = db.elements[_cache].size;
      expect(cacheSizeAfterFirstInsertAndRead).to.be.greaterThan(0, "cache should be populated after getElementProps");

      // Insert a second element with the same empty code
      const id2 = txn.insertElement({ ...emptyCodeProps });

      // The first element must still be in the cache.
      const cached1 = db.elements[_cache].get({ id: id1 });
      expect(cached1, "first element should still be in cache after inserting second element with the same empty code").to.not.be.undefined;
      expect(cached1!.elProps.id).to.equal(id1);

      expect(Id64.isValidId64(id1)).to.be.true;
      expect(Id64.isValidId64(id2)).to.be.true;
      expect(id1).to.not.equal(id2);
    });

    db.close();
  });
  it("Standalone iModel properties", () => {
    const standaloneRootSubjectName = "Standalone";
    const standaloneFile1 = IModelTestUtils.prepareOutputFile("IModel", "Standalone1.bim");
    const ecefLocation = new EcefLocation({ origin: [1, 2, 3], orientation: { yaw: 0, pitch: 0, roll: 0 } });
    const geographicCoordinateSystem = {
      horizontalCRS: { id: "10TM115-27" },
    };
    let standaloneDb1 = StandaloneDb.createEmpty(standaloneFile1, { rootSubject: { name: standaloneRootSubjectName }, ecefLocation, geographicCoordinateSystem });
    assert.isTrue(standaloneDb1.isStandaloneDb());
    assert.isTrue(standaloneDb1.isStandalone);
    assert.isFalse(standaloneDb1.isReadonly, "Expect standalone iModels to be read-write during create");
    assert.equal(standaloneDb1.getBriefcaseId(), BriefcaseIdValue.Unassigned);
    assert.equal(standaloneDb1.pathName, standaloneFile1);
    assert.equal(standaloneDb1, StandaloneDb.tryFindByKey(standaloneDb1.key), "Should be in the list of open StandaloneDbs");
    assert.equal(standaloneDb1.elements.getRootSubject().code.value, standaloneRootSubjectName);
    assert.isTrue(standaloneDb1.isOpen);
    assert.isTrue(Guid.isV4Guid(standaloneDb1.iModelId));
    assert.equal(standaloneDb1.iTwinId, Guid.empty);
    assert.strictEqual("", standaloneDb1.changeset.id);
    assert.strictEqual(0, standaloneDb1.changeset.index);
    assert.deepEqual(standaloneDb1.ecefLocation?.origin, ecefLocation.origin, "standalone ecefLocation should be set");
    assert.strictEqual(standaloneDb1.geographicCoordinateSystem?.horizontalCRS?.id, "10TM115-27", "standalone coordinate system should be set");
    assert.equal(standaloneDb1.openMode, OpenMode.ReadWrite);
    standaloneDb1.close();
    assert.isFalse(standaloneDb1.isOpen);
    standaloneDb1.close(); // calling `close()` a second time is a no-op
    assert.isUndefined(StandaloneDb.tryFindByKey(standaloneDb1.key));
    standaloneDb1 = StandaloneDb.openFile(standaloneFile1);
    assert.equal(standaloneDb1, StandaloneDb.tryFindByKey(standaloneDb1.key));
    assert.isFalse(standaloneDb1.isReadonly, "By default, StandaloneDbs are opened read/write");
    standaloneDb1.close();
    assert.isUndefined(StandaloneDb.tryFindByKey(standaloneDb1.key));
  });
  it("Snapshot iModel properties", async () => {
    const snapshotRootSubjectName = "Snapshot";
    const snapshotFile1 = IModelTestUtils.prepareOutputFile("IModel", "Snapshot1.bim");
    const snapshotFile2 = IModelTestUtils.prepareOutputFile("IModel", "Snapshot2.bim");
    const snapshotFile3 = IModelTestUtils.prepareOutputFile("IModel", "Snapshot3.bim");
    const imodel = await importTestBim(createIModelFromSeed("test_for_snapshot.bim", "test.bim"));
    const ecefLocation = new EcefLocation({ origin: [1, 2, 3], orientation: { yaw: 0, pitch: 0, roll: 0 } });
    const geographicCoordinateSystem = {
      horizontalCRS: { id: "10TM115-27" },
    };
    let snapshotDb1 = SnapshotDb.createEmpty(snapshotFile1, { rootSubject: { name: snapshotRootSubjectName }, createClassViews: true, ecefLocation, geographicCoordinateSystem });
    let snapshotDb2 = SnapshotDb.createFrom(snapshotDb1, snapshotFile2);
    let snapshotDb3 = SnapshotDb.createFrom(imodel, snapshotFile3, { createClassViews: true });
    assert.isTrue(snapshotDb1.isSnapshotDb());
    assert.isTrue(snapshotDb2.isSnapshotDb());
    assert.isTrue(snapshotDb3.isSnapshotDb());
    assert.isTrue(snapshotDb1.isSnapshot);
    assert.isTrue(snapshotDb2.isSnapshot);
    assert.isTrue(snapshotDb3.isSnapshot);
    assert.isFalse(snapshotDb1.isReadonly, "Expect snapshots to be read-write during create");
    assert.isFalse(snapshotDb2.isReadonly, "Expect snapshots to be read-write during create");
    assert.isFalse(snapshotDb3.isReadonly, "Expect snapshots to be read-write during create");
    assert.equal(snapshotDb1.getBriefcaseId(), BriefcaseIdValue.Unassigned);
    assert.equal(snapshotDb2.getBriefcaseId(), BriefcaseIdValue.Unassigned);
    assert.equal(snapshotDb3.getBriefcaseId(), BriefcaseIdValue.Unassigned);
    assert.equal(imodel.getBriefcaseId(), BriefcaseIdValue.Unassigned);
    assert.equal(snapshotDb1.pathName, snapshotFile1);
    assert.equal(snapshotDb2.pathName, snapshotFile2);
    assert.equal(snapshotDb3.pathName, snapshotFile3);
    assert.equal(snapshotDb1, SnapshotDb.tryFindByKey(snapshotDb1.key));
    assert.equal(snapshotDb2, SnapshotDb.tryFindByKey(snapshotDb2.key));
    assert.equal(snapshotDb3, SnapshotDb.tryFindByKey(snapshotDb3.key));
    const iModelGuid1: GuidString = snapshotDb1.iModelId;
    const iModelGuid2: GuidString = snapshotDb2.iModelId;
    const iModelGuid3: GuidString = snapshotDb3.iModelId;
    assert.notEqual(iModelGuid1, iModelGuid2, "Expect different iModel GUIDs for each snapshot");
    assert.notEqual(iModelGuid2, iModelGuid3, "Expect different iModel GUIDs for each snapshot");
    const rootSubjectName1 = snapshotDb1.elements.getRootSubject().code.value;
    const rootSubjectName2 = snapshotDb2.elements.getRootSubject().code.value;
    const rootSubjectName3 = snapshotDb3.elements.getRootSubject().code.value;
    const imodelRootSubjectName = imodel.elements.getRootSubject().code.value;
    assert.equal(rootSubjectName1, snapshotRootSubjectName);
    assert.equal(rootSubjectName1, rootSubjectName2, "Expect a snapshot to maintain the root Subject name from its seed");
    assert.equal(rootSubjectName3, imodelRootSubjectName, "Expect a snapshot to maintain the root Subject name from its seed");
    assert.isTrue(snapshotDb1.isOpen);
    assert.isTrue(snapshotDb2.isOpen);
    assert.isTrue(snapshotDb3.isOpen);
    assert.deepEqual(snapshotDb1.ecefLocation?.origin, ecefLocation.origin, "snapshot ecefLocation should be set");
    assert.strictEqual(snapshotDb1.geographicCoordinateSystem?.horizontalCRS?.id, "10TM115-27", "snapshot coordinate system should be set");
    snapshotDb1.close();
    snapshotDb2.close();
    snapshotDb3.close();
    assert.isFalse(snapshotDb1.isOpen);
    assert.isFalse(snapshotDb2.isOpen);
    assert.isFalse(snapshotDb3.isOpen);
    snapshotDb1.close(); // calling `close()` a second time is a no-op
    snapshotDb2.close(); // calling `close()` a second time is a no-op
    snapshotDb3.close(); // calling `close()` a second time is a no-op
    assert.isUndefined(SnapshotDb.tryFindByKey(snapshotDb1.key));
    assert.isUndefined(SnapshotDb.tryFindByKey(snapshotDb2.key));
    assert.isUndefined(SnapshotDb.tryFindByKey(snapshotDb3.key));
    snapshotDb1 = SnapshotDb.openFile(snapshotFile1);
    snapshotDb2 = SnapshotDb.openFile(snapshotFile2);
    snapshotDb3 = SnapshotDb.openFile(snapshotFile3);
    assert.equal(snapshotDb1, SnapshotDb.tryFindByKey(snapshotDb1.key));
    assert.equal(snapshotDb2, SnapshotDb.tryFindByKey(snapshotDb2.key));
    assert.equal(snapshotDb3, SnapshotDb.tryFindByKey(snapshotDb3.key));
    assert.equal(snapshotDb3, SnapshotDb.findByKey(snapshotDb3.key));
    assert.equal(snapshotDb3, IModelDb.findByKey(snapshotDb3.key));
    assert.throws(() => BriefcaseDb.findByKey(snapshotDb1.key)); // lookup of key for SnapshotDb via BriefcaseDb should throw
    assert.throws(() => StandaloneDb.findByKey(snapshotDb1.key)); // likewise for StandaloneDb
    assert.isTrue(snapshotDb1.isReadonly, "Expect snapshots to be read-only after open");
    assert.isTrue(snapshotDb2.isReadonly, "Expect snapshots to be read-only after open");
    assert.isTrue(snapshotDb3.isReadonly, "Expect snapshots to be read-only after open");
    assert.isTrue(hasClassView(snapshotDb1, "bis.Element"));
    assert.isTrue(hasClassView(snapshotDb1, "bis.ElementAspect"));
    assert.isTrue(hasClassView(snapshotDb1, "bis.Model"));
    assert.isTrue(hasClassView(snapshotDb1, "bis.ElementRefersToElements"));
    assert.isFalse(hasClassView(snapshotDb2, "bis.Element"));
    assert.isTrue(hasClassView(snapshotDb3, "bis.Element"));

    imodel.close();
    snapshotDb1.close();
    snapshotDb2.close();
    snapshotDb3.close();

    assert.isUndefined(SnapshotDb.tryFindByKey(snapshotDb1.key));
    assert.isUndefined(SnapshotDb.tryFindByKey(snapshotDb2.key));
    assert.isUndefined(SnapshotDb.tryFindByKey(snapshotDb3.key));
  });
  it("upgrade the domain schema in a StandaloneDb", async () => {
    const testFileName = IModelTestUtils.prepareOutputFile("UpgradeIModel", "testImodel.bim");
    const seedFileName = IModelTestUtils.resolveAssetFile("testImodel.bim");
    IModelJsFs.copySync(seedFileName, testFileName);

    let iModel = StandaloneDb.openFile(testFileName, OpenMode.ReadWrite);
    const beforeVersion = iModel.querySchemaVersion("BisCore");
    assert.isTrue(semver.satisfies(beforeVersion!, "= 1.0.0"));
    iModel.close();

    const schemaState: SchemaState = StandaloneDb.validateSchemas(testFileName, true);
    assert.strictEqual(schemaState, SchemaState.UpgradeRecommended);

    StandaloneDb.upgradeStandaloneSchemas(testFileName);

    iModel = StandaloneDb.openFile(testFileName, OpenMode.ReadWrite);
    const afterVersion = iModel.querySchemaVersion("BisCore");
    assert.isTrue(semver.satisfies(afterVersion!, ">= 1.0.10"));
    iModel.close();
  });
  it("throws NotFound when attempting to access element props after closing the iModel", () => {
    const imodelPath = IModelTestUtils.prepareOutputFile("IModel", "accessAfterClose.bim");
    const imodel = SnapshotDb.createEmpty(imodelPath, { rootSubject: { name: "accessAfterClose" } });

    const elem = imodel.elements.getElement<Subject>(IModel.rootSubjectId);
    expect(elem.id).to.equal(IModel.rootSubjectId);

    imodel.close();

    expect(() => imodel.elements.getElement<Subject>(IModel.rootSubjectId)).to.throw(IModelError, "Element=0x1", "Not Found");
  });
  it("should provide meaningful error when querying a closed iModel", () => {
    const testImodel = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("IModel", "QueryingClosedImodel.bim"), { rootSubject: { name: "QueryClosedTest" } });
    assert.isTrue(testImodel.isOpen);

    // Close the iModel for the tests
    testImodel.close();
    assert.isFalse(testImodel.isOpen);

    const closedDbError = "db not open";
    expect(() => testImodel.withPreparedSqliteStatement("SELECT 1", () => { })).to.throw(closedDbError);
    expect(() => testImodel.withPreparedSqliteStatement("SELECT 1", () => { })).to.throw(closedDbError);
    expect(() => testImodel.prepareSqliteStatement("SELECT 1")).to.throw(closedDbError);
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    expect(() => testImodel.prepareStatement("SELECT 1")).to.throw(closedDbError);
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    expect(() => testImodel.withPreparedStatement("SELECT ECInstanceId FROM BisCore:Element LIMIT 1", () => { })).to.throw(closedDbError);
    expect(() => testImodel.elements.queryChildren(IModel.rootSubjectId)).to.throw(closedDbError);
    expect(() => testImodel.elements.getAspects("0x1", "WrongSchema:WrongClass")).to.throw(closedDbError);
    expect(() => testImodel.createQueryReader("SELECT 1")).to.throw(closedDbError);
  });
});

describe("IModelDb.requireMinimumSchemaVersion", () => {
  let imodel: SnapshotDb;

  before(async () => {
    await TestUtils.startBackend();
    imodel = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("IModel", "MinSchemaVer.bim"), { rootSubject: { name: "MinSchemaVer" } });
  });

  after(() => {
    imodel.close();
  });

  it("throws if the schema does not exist", () => {
    expect(
      () => imodel.requireMinimumSchemaVersion("FakeSchema", new ECVersion(1, 0, 0), "Scrobbles")
    ).to.throw("Scrobbles requires FakeSchema v01.00.00 or newer");
  });

  it("throws IFF the schema version is older than the minimum", () => {
    function test(minVer: ECVersion, expectError: boolean): void {
      expect(imodel.meetsMinimumSchemaVersion("BisCore", minVer)).to.equal(!expectError);
      const require = () => imodel.requireMinimumSchemaVersion("BisCore", minVer, "Scrobbles");
      if (expectError) {
        expect(require).to.throw(`Scrobbles requires BisCore v${minVer.toString()} or newer`);
      } else {
        require();
      }
    }

    const bisVer = imodel.querySchemaVersionNumbers("BisCore")!;
    expect(bisVer.read).to.equal(1);
    expect(bisVer.write).to.equal(0);
    expect(bisVer.minor).to.least(24);

    test(bisVer, false);
    test(new ECVersion(bisVer.read, bisVer.write, bisVer.minor - 1), false);
    test(new ECVersion(0, 0, 1), false);

    test(new ECVersion(bisVer.read, bisVer.write, bisVer.minor + 1), true);
    test(new ECVersion(bisVer.read, bisVer.write, bisVer.minor + 1), true);
    test(new ECVersion(bisVer.read + 1, bisVer.write + 1, bisVer.minor), true);
  });
});