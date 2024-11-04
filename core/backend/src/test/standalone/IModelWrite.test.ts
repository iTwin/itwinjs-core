/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AccessToken, DbResult, GuidString, Id64, Id64String } from "@itwin/core-bentley";
import {
  ChangesetIdWithIndex, Code, ColorDef,
  GeometricElement2dProps, GeometryStreamProps, IModel, LockState, QueryRowFormat, RequestNewBriefcaseProps, SchemaState, SubCategoryAppearance,
} from "@itwin/core-common";
import { Arc3d, IModelJson, Point2d, Point3d } from "@itwin/core-geometry";
import * as chai from "chai";
import { assert, expect } from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as fs from "fs";
import * as semver from "semver";
import * as sinon from "sinon";
import { HubWrappers, KnownTestLocations } from "../";
import { DrawingCategory } from "../../Category";
import { ECSqlStatement } from "../../ECSqlStatement";
import { HubMock } from "../../HubMock";
import {
  _nativeDb,
  BriefcaseDb,
  BriefcaseManager,
  ChannelControl,
  CodeService, DefinitionModel, DictionaryModel, DocumentListModel, Drawing, DrawingGraphic, OpenBriefcaseArgs, SpatialCategory, Subject,
} from "../../core-backend";
import { IModelTestUtils, TestUserType } from "../IModelTestUtils";
import { ServerBasedLocks } from "../../internal/ServerBasedLocks";

chai.use(chaiAsPromised);

export async function createNewModelAndCategory(rwIModel: BriefcaseDb, parent?: Id64String) {
  // Create a new physical model.
  const [, modelId] = await IModelTestUtils.createAndInsertPhysicalPartitionAndModelAsync(rwIModel, IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel"), true, parent);

  // Find or create a SpatialCategory.
  const dictionary: DictionaryModel = rwIModel.models.getModel<DictionaryModel>(IModel.dictionaryId);
  const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");
  const category = SpatialCategory.create(rwIModel, IModel.dictionaryId, newCategoryCode.value);
  const spatialCategoryId = rwIModel.elements.insertElement(category.toJSON());
  category.setDefaultAppearance(new SubCategoryAppearance({ color: 0xff0000 }));
  // const spatialCategoryId: Id64String = SpatialCategory.insert(rwIModel, IModel.dictionaryId, newCategoryCode.value!, new SubCategoryAppearance({ color: 0xff0000 }));

  return { modelId, spatialCategoryId };
}

describe("IModelWriteTest", () => {
  let managerAccessToken: AccessToken;
  let superAccessToken: AccessToken;
  let iTwinId: GuidString;

  before(() => {
    HubMock.startup("IModelWriteTest", KnownTestLocations.outputDir);
    iTwinId = HubMock.iTwinId;
  });
  after(() => HubMock.shutdown());

  it("Check busyTimeout option", async () => {
    const iModelProps = {
      iModelName: "ReadWriteTest",
      iTwinId,
    };

    const iModelId = await HubMock.createNewIModel(iModelProps);
    const briefcaseProps = await BriefcaseManager.downloadBriefcase({ accessToken: "test token", iTwinId, iModelId });

    const tryOpen = async (args: OpenBriefcaseArgs) => {
      const start = performance.now();
      let didThrow = false;
      try {
        await BriefcaseDb.open(args);

      } catch (e: any) {
        assert.strictEqual(e.errorNumber, DbResult.BE_SQLITE_BUSY, "Expect error 'Db is busy'");
        didThrow = true;
      }
      assert.isTrue(didThrow);
      return performance.now() - start;
    };
    const seconds = (s: number) => s * 1000;

    const db = await BriefcaseDb.open({ fileName: briefcaseProps.fileName });
    db.saveChanges();
    // lock db so another connection cannot write to it.
    db.saveFileProperty({ name: "test", namespace: "test" }, "");

    assert.isAtMost(await tryOpen({ fileName: briefcaseProps.fileName, busyTimeout: seconds(0) }), seconds(1), "open should fail with busy error instantly");
    assert.isAtLeast(await tryOpen({ fileName: briefcaseProps.fileName, busyTimeout: seconds(1) }), seconds(1), "open should fail with atleast 1 sec delay due to retry");
    assert.isAtLeast(await tryOpen({ fileName: briefcaseProps.fileName, busyTimeout: seconds(2) }), seconds(2), "open should fail with atleast 2 sec delay due to retry");
    assert.isAtLeast(await tryOpen({ fileName: briefcaseProps.fileName, busyTimeout: seconds(3) }), seconds(3), "open should fail with atleast 3 sec delay due to retry");

    db.abandonChanges();
    db.close();
  });

  it("WatchForChanges", async () => {
    const iModelProps = {
      iModelName: "ReadWriteTest",
      iTwinId,
    };

    const iModelId = await HubMock.createNewIModel(iModelProps);
    const briefcaseProps = await BriefcaseManager.downloadBriefcase({ accessToken: "test token", iTwinId, iModelId });

    let nClosed = 0;
    const fsWatcher = {
      callback: () => { },
      close: () => ++nClosed,
    };
    const watchStub: any = (_filename: fs.PathLike, _opts: fs.WatchOptions, fn: () => void) => {
      fsWatcher.callback = fn;
      return fsWatcher;
    };
    sinon.stub(fs, "watch").callsFake(watchStub);

    const bc = await BriefcaseDb.open({ fileName: briefcaseProps.fileName });
    bc.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    const roBC = await BriefcaseDb.open({ fileName: briefcaseProps.fileName, watchForChanges: true });

    const code1 = IModelTestUtils.getUniqueModelCode(bc, "newPhysicalModel1");
    await IModelTestUtils.createAndInsertPhysicalPartitionAndModelAsync(bc, code1, true);
    bc.saveChanges();

    // immediately after save changes the current txnId in the writeable briefcase changes, but it isn't reflected
    // in the readonly briefcase until the file watcher fires.
    expect(bc[_nativeDb].getCurrentTxnId()).not.equal(roBC[_nativeDb].getCurrentTxnId());

    // trigger watcher via stub
    fsWatcher.callback();

    // now they should match because restartDefaultTxn in the readonly briefcase reads the changes from the writeable connection
    expect(bc[_nativeDb].getCurrentTxnId()).equal(roBC[_nativeDb].getCurrentTxnId());

    roBC.close();
    expect(nClosed).equal(1);

    bc.close();
    sinon.restore();
  });

  function expectEqualChangesets(a: ChangesetIdWithIndex, b: ChangesetIdWithIndex): void {
    expect(a.id).to.equal(b.id);
    expect(a.index).to.equal(b.index);
  }

  it("WatchForChanges - push", async () => {
    const adminAccessToken = await HubWrappers.getAccessToken(TestUserType.SuperManager);
    const iModelProps = {
      iModelName: "ReadWriteTest",
      iTwinId,
    };

    const iModelId = await HubMock.createNewIModel(iModelProps);
    const briefcaseProps = await BriefcaseManager.downloadBriefcase({ accessToken: adminAccessToken, iTwinId, iModelId });

    let nClosed = 0;
    const fsWatcher = {
      callback: () => { },
      close: () => ++nClosed,
    };
    const watchStub: any = (_filename: fs.PathLike, _opts: fs.WatchOptions, fn: () => void) => {
      fsWatcher.callback = fn;
      return fsWatcher;
    };
    sinon.stub(fs, "watch").callsFake(watchStub);

    const bc = await BriefcaseDb.open({ fileName: briefcaseProps.fileName });
    bc.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    const roBC = await BriefcaseDb.open({ fileName: briefcaseProps.fileName, watchForChanges: true });

    const code1 = IModelTestUtils.getUniqueModelCode(bc, "newPhysicalModel1");
    await IModelTestUtils.createAndInsertPhysicalPartitionAndModelAsync(bc, code1, true);
    bc.saveChanges();

    // immediately after save changes the current txnId in the writeable briefcase changes, but it isn't reflected
    // in the readonly briefcase until the file watcher fires.
    expect(bc[_nativeDb].getCurrentTxnId()).not.equal(roBC[_nativeDb].getCurrentTxnId());

    // trigger watcher via stub
    fsWatcher.callback();

    // now they should match because restartDefaultTxn in the readonly briefcase reads the changes from the writeable connection
    expect(bc[_nativeDb].getCurrentTxnId()).equal(roBC[_nativeDb].getCurrentTxnId());

    // Push the changes to the hub

    const prePushChangeset = bc.changeset;
    let eventRaised = false;
    roBC.onChangesetChanged.addOnce((prevCS) => {
      expectEqualChangesets(prevCS, prePushChangeset);
      eventRaised = true;
    });

    await bc.pushChanges({ accessToken: adminAccessToken, description: "test" });
    const postPushChangeset = bc.changeset;
    assert(!!postPushChangeset);
    expect(prePushChangeset !== postPushChangeset, "changes should be pushed");

    // trigger watcher via stub
    fsWatcher.callback();

    expectEqualChangesets(roBC.changeset, postPushChangeset);
    expect(roBC[_nativeDb].getCurrentTxnId(), "txn should be updated").equal(bc[_nativeDb].getCurrentTxnId());
    expect(eventRaised).to.be.true;

    roBC.close();
    expect(nClosed).equal(1);

    bc.close();
    sinon.restore();
  });

  it("WatchForChanges - pull", async () => {
    const adminAccessToken = await HubWrappers.getAccessToken(TestUserType.SuperManager);

    const pathname = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
    const hubName = "CompatibilityTest";
    const iModelId = await HubWrappers.pushIModel(managerAccessToken, iTwinId, pathname, hubName, true);

    // Download two copies of the briefcase - manager and super
    const args: RequestNewBriefcaseProps = { iTwinId, iModelId };
    const initialDb = await BriefcaseManager.downloadBriefcase({ accessToken: adminAccessToken, ...args });
    const briefcaseProps = await BriefcaseManager.downloadBriefcase({ accessToken: adminAccessToken, ...args });

    // Push some changes - prep for pull workflow.
    const bc1 = await BriefcaseDb.open({ fileName: initialDb.fileName });
    bc1.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    const code2 = IModelTestUtils.getUniqueModelCode(bc1, "newPhysicalModel2");
    await IModelTestUtils.createAndInsertPhysicalPartitionAndModelAsync(bc1, code2, true);
    const prePushChangeset = bc1.changeset;
    bc1.saveChanges();
    await bc1.pushChanges({ accessToken: adminAccessToken, description: "test" });
    const postPushChangeset = bc1.changeset;
    assert(!!prePushChangeset);
    expect(prePushChangeset !== postPushChangeset, "changes should be pushed");

    bc1.close();

    // Writer that pulls + watcher.
    let nClosed = 0;
    const fsWatcher = {
      callback: () => { },
      close: () => ++nClosed,
    };
    const watchStub: any = (_filename: fs.PathLike, _opts: fs.WatchOptions, fn: () => void) => {
      fsWatcher.callback = fn;
      return fsWatcher;
    };
    sinon.stub(fs, "watch").callsFake(watchStub);

    const bc = await BriefcaseDb.open({ fileName: briefcaseProps.fileName });
    bc.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    const roBC = await BriefcaseDb.open({ fileName: briefcaseProps.fileName, watchForChanges: true });

    const prePullChangeset = bc.changeset;
    let eventRaised = false;
    roBC.onChangesetChanged.addOnce((prevCS) => {
      expectEqualChangesets(prevCS, prePushChangeset);
      eventRaised = true;
    });

    await bc.pullChanges();

    const postPullChangeset = bc.changeset;
    assert(!!postPullChangeset);
    expect(prePullChangeset !== postPullChangeset, "changes should be pulled");

    // trigger watcher via stub
    fsWatcher.callback();

    expectEqualChangesets(roBC.changeset, postPullChangeset);
    expect(roBC[_nativeDb].getCurrentTxnId(), "txn should be updated").equal(bc[_nativeDb].getCurrentTxnId());
    expect(eventRaised).to.be.true;

    roBC.close();
    expect(nClosed).equal(1);

    bc.close();
    sinon.restore();
  });

  it("should handle undo/redo", async () => {
    const adminAccessToken = await HubWrappers.getAccessToken(TestUserType.SuperManager);
    // Delete any existing iModels with the same name as the read-write test iModel
    const iModelName = "CodesUndoRedoPushTest";

    // Create a new empty iModel on the Hub & obtain a briefcase
    const rwIModelId = await HubMock.createNewIModel({ accessToken: adminAccessToken, iTwinId, iModelName, description: "TestSubject" });
    assert.isNotEmpty(rwIModelId);
    const rwIModel = await HubWrappers.downloadAndOpenBriefcase({ accessToken: adminAccessToken, iTwinId, iModelId: rwIModelId });
    rwIModel.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    // create and insert a new model with code1
    const code1 = IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel1");
    await IModelTestUtils.createAndInsertPhysicalPartitionAndModelAsync(rwIModel, code1, true);
    assert.isTrue(rwIModel.elements.getElement(code1) !== undefined); // throws if element is not found

    // create a local txn with that change
    rwIModel.saveChanges("inserted newPhysicalModel");

    // Reverse that local txn
    rwIModel.txns.reverseSingleTxn();

    try {
      //  The model that I just created with code1 should no longer be there.
      const theNewModel = rwIModel.elements.getElement(code1); // throws if element is not found
      assert.isTrue(theNewModel === undefined); // really should not be here.
      assert.fail(); // should not be here.
    } catch {
      // this is what I expect
    }

    // Create and insert a model with code2
    const code2 = IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel2");
    await IModelTestUtils.createAndInsertPhysicalPartitionAndModelAsync(rwIModel, code2, true);
    rwIModel.saveChanges("inserted generic objects");

    // The iModel should have a model with code1 and not code2
    assert.isTrue(rwIModel.elements.getElement(code2) !== undefined); // throws if element is not found

    // Push the changes to the hub
    const prePushChangeset = rwIModel.changeset;
    await rwIModel.pushChanges({ accessToken: adminAccessToken, description: "test" });
    const postPushChangeset = rwIModel.changeset;
    assert(!!postPushChangeset);
    expect(prePushChangeset !== postPushChangeset);

    rwIModel.close();
  });

  it("should be able to upgrade a briefcase with an older schema", async () => {
    /**
     * Test validates that -
     * - User "manager" upgrades the BisCore schema in the briefcase from version 1.0.0 to 1.0.10+
     * - User "super" can get the upgrade "manager" made
     */

    /* Setup test - Push an iModel with an old BisCore schema up to the Hub */
    const pathname = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
    const hubName = "CompatibilityTest";
    const iModelId = await HubWrappers.pushIModel(managerAccessToken, iTwinId, pathname, hubName, true);

    // Download two copies of the briefcase - manager and super
    const args: RequestNewBriefcaseProps = { iTwinId, iModelId };
    const managerBriefcaseProps = await BriefcaseManager.downloadBriefcase({ accessToken: managerAccessToken, ...args });
    const superBriefcaseProps = await BriefcaseManager.downloadBriefcase({ accessToken: superAccessToken, ...args });

    /* User "manager" upgrades the briefcase */

    // Validate the original state of the BisCore schema in the briefcase
    let iModel = await BriefcaseDb.open({ fileName: managerBriefcaseProps.fileName });
    const beforeVersion = iModel.querySchemaVersion("BisCore");
    assert.isTrue(semver.satisfies(beforeVersion!, "= 1.0.0"));
    assert.isFalse(iModel[_nativeDb].hasPendingTxns());
    iModel.close();

    // Validate that the BisCore schema is recognized as a recommended upgrade
    let schemaState = BriefcaseDb.validateSchemas(managerBriefcaseProps.fileName, true);
    assert.strictEqual(schemaState, SchemaState.UpgradeRecommended);

    // Upgrade the schemas
    await BriefcaseDb.upgradeSchemas(managerBriefcaseProps);

    // Validate state after upgrade
    iModel = await BriefcaseDb.open({ fileName: managerBriefcaseProps.fileName });
    const afterVersion = iModel.querySchemaVersion("BisCore");
    assert.isTrue(semver.satisfies(afterVersion!, ">= 1.0.10"));
    assert.isFalse(iModel[_nativeDb].hasPendingTxns());
    assert.isFalse(iModel.holdsSchemaLock);
    assert.isFalse(iModel[_nativeDb].hasUnsavedChanges());
    iModel.close();

    /* User "super" can get the upgrade "manager" made */

    // Validate that the BisCore schema is recognized as a recommended upgrade
    schemaState = BriefcaseDb.validateSchemas(superBriefcaseProps.fileName, true);
    assert.strictEqual(schemaState, SchemaState.UpgradeRecommended);

    // Open briefcase and pull change sets to upgrade
    const superIModel = await BriefcaseDb.open({ fileName: superBriefcaseProps.fileName });
    (superBriefcaseProps.changeset as any) = await superIModel.pullChanges({ accessToken: superAccessToken });
    const superVersion = superIModel.querySchemaVersion("BisCore");
    assert.isTrue(semver.satisfies(superVersion!, ">= 1.0.10"));
    assert.isFalse(superIModel[_nativeDb].hasUnsavedChanges()); // Validate no changes were made
    assert.isFalse(superIModel[_nativeDb].hasPendingTxns()); // Validate no changes were made
    superIModel.close();

    // Validate that there are no upgrades required
    schemaState = BriefcaseDb.validateSchemas(superBriefcaseProps.fileName, true);
    assert.strictEqual(schemaState, SchemaState.UpToDate);

    // Upgrade the schemas - ensure this is a no-op
    await BriefcaseDb.upgradeSchemas(superBriefcaseProps);
    await HubMock.deleteIModel({ accessToken: managerAccessToken, iTwinId, iModelId });
  });

  it("changeset size and ec schema version change", async () => {
    const adminToken = "super manager token";
    const iModelName = "changeset_size";
    const rwIModelId = await HubMock.createNewIModel({ iTwinId, iModelName, description: "TestSubject", accessToken: adminToken });
    assert.isNotEmpty(rwIModelId);
    const rwIModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken });
    assert.equal(rwIModel[_nativeDb].enableChangesetSizeStats(true), DbResult.BE_SQLITE_OK);
    const schema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="ts" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
        <ECEntityClass typeName="Test2dElement">
            <BaseClass>bis:GraphicalElement2d</BaseClass>
            <ECProperty propertyName="s" typeName="string"/>
        </ECEntityClass>
    </ECSchema>`;
    await rwIModel.importSchemaStrings([schema]);
    rwIModel.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    rwIModel.saveChanges("user 1: schema changeset");
    if (true || "push changes") {
      // Push the changes to the hub
      const prePushChangeSetId = rwIModel.changeset.id;
      await rwIModel.pushChanges({ description: "push schema changeset", accessToken: adminToken });
      const postPushChangeSetId = rwIModel.changeset.id;
      assert(!!postPushChangeSetId);
      expect(prePushChangeSetId !== postPushChangeSetId);
      const changesets = await HubMock.queryChangesets({ iModelId: rwIModelId, accessToken: superAccessToken });
      assert.equal(changesets.length, 1);
    }
    await rwIModel.locks.acquireLocks({ shared: IModel.dictionaryId });
    const codeProps = Code.createEmpty();
    codeProps.value = "DrawingModel";
    let totalEl = 0;
    const [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(rwIModel, codeProps, true);
    let drawingCategoryId = DrawingCategory.queryCategoryIdByName(rwIModel, IModel.dictionaryId, "MyDrawingCategory");
    if (undefined === drawingCategoryId)
      drawingCategoryId = DrawingCategory.insert(rwIModel, IModel.dictionaryId, "MyDrawingCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

    const insertElements = (imodel: BriefcaseDb, className: string = "Test2dElement", noOfElements: number = 10, userProp: (n: number) => object) => {
      for (let m = 0; m < noOfElements; ++m) {
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
        const prop = userProp(++totalEl);
        // Create props
        const geomElement = {
          classFullName: `TestDomain:${className}`,
          model: drawingModelId,
          category: drawingCategoryId,
          code: Code.createEmpty(),
          geom: geometryStream,
          ...prop,
        };
        const id = imodel.elements.insertElement(geomElement);
        assert.isTrue(Id64.isValidId64(id), "insert worked");
      }
    };
    const str = new Array(1024).join("x");
    insertElements(rwIModel, "Test2dElement", 1024, () => {
      return { s: str };
    });
    assert.equal(1357661, rwIModel[_nativeDb].getChangesetSize());

    rwIModel.saveChanges("user 1: data");
    assert.equal(0, rwIModel[_nativeDb].getChangesetSize());
    await rwIModel.pushChanges({ description: "schema changeset", accessToken: adminToken });
    rwIModel.close();
  });

  it("should set a fake verifyCode for codeService that throws error for operations that affect code, if failed to open codeService ", async () => {
    const iModelProps = {
      iModelName: "codeServiceTest",
      iTwinId,
    };
    const iModelId = await HubMock.createNewIModel(iModelProps);
    const briefcaseProps = await BriefcaseManager.downloadBriefcase({ accessToken: "codeServiceTest", iTwinId, iModelId });
    const originalCreateForIModel = CodeService.createForIModel;
    // can be any errors except 'NoCodeIndex'
    CodeService.createForIModel = async () => {
      throw new CodeService.Error("MissingCode", 0x10000 + 1, " ");
    };
    const briefcaseDb = await BriefcaseDb.open({ fileName: briefcaseProps.fileName });
    briefcaseDb.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    let firstNonRootElement = { id: undefined, codeValue: "test" };
    briefcaseDb.withPreparedStatement("SELECT * from Bis.Element LIMIT 1 OFFSET 1", (stmt: ECSqlStatement) => {
      if (stmt.step() === DbResult.BE_SQLITE_ROW) {
        firstNonRootElement = stmt.getRow();
      }
    });
    // make change to the briefcaseDb that does not affect code, e.g., save file property
    // expect no error from verifyCode
    expect(() => briefcaseDb.saveFileProperty({ name: "codeServiceProp", namespace: "codeService", id: 1, subId: 1 }, "codeService test")).to.not.throw();
    // make change to the briefcaseDb that affects code that will invoke verifyCode, e.g., update an element with a non-null code
    // expect error from verifyCode
    let newProps = { id: firstNonRootElement.id, code: { ...Code.createEmpty(), value: firstNonRootElement.codeValue }, classFullName: undefined, model: undefined };
    await briefcaseDb.locks.acquireLocks({ exclusive: firstNonRootElement.id });
    expect(() => briefcaseDb.elements.updateElement(newProps)).to.throw(CodeService.Error);
    // make change to the briefcaseDb that will invoke verifyCode with a null(empty) code, e.g., update an element with a null(empty) code
    // expect no error from verifyCode
    newProps = { id: firstNonRootElement.id, code: Code.createEmpty(), classFullName: undefined, model: undefined };
    expect(() => briefcaseDb.elements.updateElement(newProps)).to.not.throw();
    briefcaseDb.close();
    // throw "NoCodeIndex", this error should get ignored because it means the iModel isn't enforcing codes. updating an element with an empty code and a non empty code should work without issue.
    CodeService.createForIModel = async () => {
      throw new CodeService.Error("NoCodeIndex", 0x10000 + 1, " ");
    };
    const briefcaseDb2 = await BriefcaseDb.open({ fileName: briefcaseProps.fileName });
    briefcaseDb2.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    await briefcaseDb2.locks.acquireLocks({ exclusive: firstNonRootElement.id });
    // expect no error from verifyCode for empty code
    expect(() => briefcaseDb2.elements.updateElement(newProps)).to.not.throw();
    newProps = { id: firstNonRootElement.id, code: { ...Code.createEmpty(), value: firstNonRootElement.codeValue }, classFullName: undefined, model: undefined };
    // make change to the briefcaseDb that affects code that will invoke verifyCode, e.g., update an element with a non-null code
    // expect no error from verifyCode
    expect(() => briefcaseDb2.elements.updateElement(newProps)).to.not.throw();
    // clean up
    CodeService.createForIModel = originalCreateForIModel;
    briefcaseDb2.close();
  });

  it("clear cache on schema changes", async () => {
    const adminToken = await HubWrappers.getAccessToken(TestUserType.SuperManager);
    const userToken = await HubWrappers.getAccessToken(TestUserType.Super);
    // Delete any existing iModels with the same name as the OptimisticConcurrencyTest iModel
    const iModelName = "SchemaChanges";

    // Create a new empty iModel on the Hub & obtain a briefcase
    const rwIModelId = await HubMock.createNewIModel({ iTwinId, iModelName, description: "TestSubject" });
    assert.isNotEmpty(rwIModelId);
    const rwIModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: adminToken });

    const rwIModel2 = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId: rwIModelId, accessToken: userToken });

    // enable change tracking
    assert.equal(rwIModel[_nativeDb].enableChangesetSizeStats(true), DbResult.BE_SQLITE_OK);
    assert.equal(rwIModel2[_nativeDb].enableChangesetSizeStats(true), DbResult.BE_SQLITE_OK);

    const schema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="ts" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
        <ECEntityClass typeName="Test2dElement">
            <BaseClass>bis:GraphicalElement2d</BaseClass>
            <ECProperty propertyName="s" typeName="string"/>
        </ECEntityClass>
    </ECSchema>`;
    await rwIModel.importSchemaStrings([schema]);
    rwIModel.channels.addAllowedChannel(ChannelControl.sharedChannelName);
    rwIModel2.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    rwIModel.saveChanges("user 1: schema changeset");
    if (true || "push changes") {
      // Push the changes to the hub
      const prePushChangeSetId = rwIModel.changeset.id;
      await rwIModel.pushChanges({ description: "schema changeset", accessToken: adminToken });
      const postPushChangeSetId = rwIModel.changeset.id;
      assert(!!postPushChangeSetId);
      expect(prePushChangeSetId !== postPushChangeSetId);
      const changesets = await HubMock.queryChangesets({ iModelId: rwIModelId, accessToken: superAccessToken });
      assert.equal(changesets.length, 1);
    }
    const codeProps = Code.createEmpty();
    codeProps.value = "DrawingModel";
    let totalEl = 0;
    await rwIModel.locks.acquireLocks({ shared: IModel.dictionaryId });
    const [, drawingModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(rwIModel, codeProps, true);
    let drawingCategoryId = DrawingCategory.queryCategoryIdByName(rwIModel, IModel.dictionaryId, "MyDrawingCategory");
    if (undefined === drawingCategoryId)
      drawingCategoryId = DrawingCategory.insert(rwIModel, IModel.dictionaryId, "MyDrawingCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

    const insertElements = (imodel: BriefcaseDb, className: string = "Test2dElement", noOfElements: number = 10, userProp: (n: number) => object) => {
      for (let m = 0; m < noOfElements; ++m) {
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
        const prop = userProp(++totalEl);
        // Create props
        const geomElement = {
          classFullName: `TestDomain:${className}`,
          model: drawingModelId,
          category: drawingCategoryId,
          code: Code.createEmpty(),
          geom: geometryStream,
          ...prop,
        };
        const id = imodel.elements.insertElement(geomElement);
        assert.isTrue(Id64.isValidId64(id), "insert worked");
      }
    };

    insertElements(rwIModel, "Test2dElement", 10, (n: number) => {
      return { s: `s-${n}` };
    });

    assert.equal(3902, rwIModel[_nativeDb].getChangesetSize());
    rwIModel.saveChanges("user 1: data changeset");

    if (true || "push changes") {
      // Push the changes to the hub
      const prePushChangeSetId = rwIModel.changeset.id;
      await rwIModel.pushChanges({ description: "10 instances of test2dElement", accessToken: adminToken });
      const postPushChangeSetId = rwIModel.changeset.id;
      assert(!!postPushChangeSetId);
      expect(prePushChangeSetId !== postPushChangeSetId);
      const changesets = await HubMock.queryChangesets({ iModelId: rwIModelId, accessToken: superAccessToken });
      assert.equal(changesets.length, 2);
    }
    let rows: any[] = [];
    rwIModel.withPreparedStatement("SELECT * FROM TestDomain.Test2dElement", (stmt: ECSqlStatement) => {
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        rows.push(stmt.getRow());
      }
    });
    assert.equal(rows.length, 10);
    assert.equal(rows.map((r) => r.s).filter((v) => v).length, 10);
    rows = [];
    for await (const queryRow of rwIModel.createQueryReader("SELECT * FROM TestDomain.Test2dElement", undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      rows.push(queryRow.toRow());
    }
    assert.equal(rows.length, 10);
    assert.equal(rows.map((r) => r.s).filter((v) => v).length, 10);
    if (true || "user pull/merge") {
      // pull and merge changes
      await rwIModel2.pullChanges({ accessToken: userToken });
      rows = [];
      rwIModel2.withPreparedStatement("SELECT * FROM TestDomain.Test2dElement", (stmt: ECSqlStatement) => {
        while (stmt.step() === DbResult.BE_SQLITE_ROW) {
          rows.push(stmt.getRow());
        }
      });
      assert.equal(rows.length, 10);
      assert.equal(rows.map((r) => r.s).filter((v) => v).length, 10);
      rows = [];
      for await (const queryRow of rwIModel2.createQueryReader("SELECT * FROM TestDomain.Test2dElement", undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
        rows.push(queryRow.toRow());
      }
      assert.equal(rows.length, 10);
      assert.equal(rows.map((r) => r.s).filter((v) => v).length, 10);
      // create some element and push those changes
      await rwIModel2.locks.acquireLocks({ shared: drawingModelId });
      insertElements(rwIModel2, "Test2dElement", 10, (n: number) => {
        return { s: `s-${n}` };
      });
      assert.equal(13, rwIModel[_nativeDb].getChangesetSize());
      rwIModel2.saveChanges("user 2: data changeset");

      if (true || "push changes") {
        // Push the changes to the hub
        const prePushChangeSetId = rwIModel2.changeset.id;
        await rwIModel2.pushChanges({ accessToken: userToken, description: "10 instances of test2dElement" });
        const postPushChangeSetId = rwIModel2.changeset.id;
        assert(!!postPushChangeSetId);
        expect(prePushChangeSetId !== postPushChangeSetId);
        const changesets = await HubMock.queryChangesets({ iModelId: rwIModelId, accessToken: userToken });
        assert.equal(changesets.length, 3);
      }
    }
    await rwIModel.pullChanges({ accessToken: adminToken });
    // second schema import ==============================================================
    const schemaV2 = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="ts" version="01.01" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
        <ECEntityClass typeName="Test2dElement">
            <BaseClass>bis:GraphicalElement2d</BaseClass>
            <ECProperty propertyName="s" typeName="string"/>
            <ECProperty propertyName="v" typeName="string"/>
        </ECEntityClass>
        <ECEntityClass typeName="Test2dElement2nd">
            <BaseClass>bis:GraphicalElement2d</BaseClass>
            <ECProperty propertyName="t" typeName="string"/>
            <ECProperty propertyName="r" typeName="string"/>
        </ECEntityClass>
    </ECSchema>`;
    await rwIModel.importSchemaStrings([schemaV2]);
    assert.equal(0, rwIModel[_nativeDb].getChangesetSize());
    rwIModel.saveChanges("user 1: schema changeset2");
    if (true || "push changes") {
      // Push the changes to the hub
      const prePushChangeSetId = rwIModel.changeset.id;
      await rwIModel.pushChanges({ accessToken: adminToken, description: "schema changeset" });
      const postPushChangeSetId = rwIModel.changeset.id;
      assert(!!postPushChangeSetId);
      expect(prePushChangeSetId !== postPushChangeSetId);
      const changesets = await HubMock.queryChangesets({ iModelId: rwIModelId, accessToken: superAccessToken });
      assert.equal(changesets.length, 4);
    }
    // create some element and push those changes
    await rwIModel.locks.acquireLocks({ shared: drawingModelId });
    insertElements(rwIModel, "Test2dElement", 10, (n: number) => {
      return {
        s: `s-${n}`, v: `v-${n}`,
      };
    });

    // create some element and push those changes
    insertElements(rwIModel, "Test2dElement2nd", 10, (n: number) => {
      return {
        t: `t-${n}`, r: `r-${n}`,
      };
    });
    assert.equal(6279, rwIModel[_nativeDb].getChangesetSize());
    rwIModel.saveChanges("user 1: data changeset");

    if (true || "push changes") {
      // Push the changes to the hub
      const prePushChangeSetId = rwIModel.changeset.id;
      await rwIModel.pushChanges({ accessToken: adminToken, description: "10 instances of test2dElement" });
      const postPushChangeSetId = rwIModel.changeset.id;
      assert(!!postPushChangeSetId);
      expect(prePushChangeSetId !== postPushChangeSetId);
      const changesets = await HubMock.queryChangesets({ iModelId: rwIModelId, accessToken: superAccessToken });
      assert.equal(changesets.length, 5);
    }
    rows = [];
    rwIModel.withPreparedStatement("SELECT * FROM TestDomain.Test2dElement", (stmt: ECSqlStatement) => {
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        rows.push(stmt.getRow());
      }
    });
    assert.equal(rows.length, 30);
    assert.equal(rows.map((r) => r.s).filter((v) => v).length, 30);
    assert.equal(rows.map((r) => r.v).filter((v) => v).length, 10);
    rows = [];
    for await (const queryRow of rwIModel.createQueryReader("SELECT * FROM TestDomain.Test2dElement", undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      rows.push(queryRow.toRow());
    }
    assert.equal(rows.length, 30);
    assert.equal(rows.map((r) => r.s).filter((v) => v).length, 30);
    assert.equal(rows.map((r) => r.v).filter((v) => v).length, 10);

    rows = [];
    rwIModel.withPreparedStatement("SELECT * FROM TestDomain.Test2dElement2nd", (stmt: ECSqlStatement) => {
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        rows.push(stmt.getRow());
      }
    });
    assert.equal(rows.length, 10);
    assert.equal(rows.map((r) => r.t).filter((v) => v).length, 10);
    assert.equal(rows.map((r) => r.r).filter((v) => v).length, 10);
    rows = [];
    for await (const queryRow of rwIModel.createQueryReader("SELECT * FROM TestDomain.Test2dElement2nd", undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      rows.push(queryRow.toRow());
    }
    assert.equal(rows.length, 10);
    assert.equal(rows.map((r) => r.t).filter((v) => v).length, 10);
    assert.equal(rows.map((r) => r.r).filter((v) => v).length, 10);

    if (true || "user pull/merge") {
      // pull and merge changes
      await rwIModel2.pullChanges({ accessToken: userToken });
      rows = [];
      // Following fail without the fix in briefcase manager where we clear statement cache on schema changeset apply
      rwIModel2.withPreparedStatement("SELECT * FROM TestDomain.Test2dElement", (stmt: ECSqlStatement) => {
        while (stmt.step() === DbResult.BE_SQLITE_ROW) {
          rows.push(stmt.getRow());
        }
      });
      assert.equal(rows.length, 30);
      assert.equal(rows.map((r) => r.s).filter((v) => v).length, 30);
      assert.equal(rows.map((r) => r.v).filter((v) => v).length, 10);
      rows = [];
      // Following fail without native side fix where we clear concurrent query cache on schema changeset apply
      for await (const queryRow of rwIModel2.createQueryReader("SELECT * FROM TestDomain.Test2dElement", undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
        rows.push(queryRow.toRow());
      }
      assert.equal(rows.length, 30);
      assert.equal(rows.map((r) => r.s).filter((v) => v).length, 30);
      assert.equal(rows.map((r) => r.v).filter((v) => v).length, 10);
      for (const row of rows) {
        const el: any = rwIModel2.elements.getElementProps(row.id);
        assert.isDefined(el);
        if (row.s) {
          assert.equal(row.s, el.s);
        } else {
          assert.isUndefined(el.s);
        }
        if (row.v) {
          assert.equal(row.v, el.v);
        } else {
          assert.isUndefined(el.v);
        }
      }
      rows = [];
      rwIModel2.withPreparedStatement("SELECT * FROM TestDomain.Test2dElement2nd", (stmt: ECSqlStatement) => {
        while (stmt.step() === DbResult.BE_SQLITE_ROW) {
          rows.push(stmt.getRow());
        }
      });
      assert.equal(rows.length, 10);
      assert.equal(rows.map((r) => r.t).filter((v) => v).length, 10);
      assert.equal(rows.map((r) => r.r).filter((v) => v).length, 10);
      for (const row of rows) {
        const el: any = rwIModel2.elements.getElementProps(row.id);
        assert.isDefined(el);
        if (row.s) {
          assert.equal(row.s, el.s);
        } else {
          assert.isUndefined(el.s);
        }
        if (row.v) {
          assert.equal(row.v, el.v);
        } else {
          assert.isUndefined(el.v);
        }
      }
      rows = [];
      for await (const queryRow of rwIModel2.createQueryReader("SELECT * FROM TestDomain.Test2dElement2nd", undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
        rows.push(queryRow.toRow());
      }
      assert.equal(rows.length, 10);
      assert.equal(rows.map((r) => r.t).filter((v) => v).length, 10);
      assert.equal(rows.map((r) => r.r).filter((v) => v).length, 10);
      for (const row of rows) {
        const el: any = rwIModel2.elements.getElementProps(row.id);
        assert.isDefined(el);
        if (row.t) {
          assert.equal(row.t, el.t);
        } else {
          assert.isUndefined(el.t);
        }
        if (row.r) {
          assert.equal(row.r, el.r);
        } else {
          assert.isUndefined(el.r);
        }
      }
    }
    rwIModel.close();
    rwIModel2.close();
  });

  it("parent lock should suffice when inserting into deeply nested sub-model", async () => {
    const version0 = IModelTestUtils.resolveAssetFile("test.bim");
    const iModelId = await HubMock.createNewIModel({ iTwinId, iModelName: "subModelCoveredByParentLockTest", version0 });
    let iModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId });
    iModel.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    /*
    Job Subject
      +- DefinitionPartition  --  [DefinitionModel]
  */

    await iModel.locks.acquireLocks({ shared: IModel.repositoryModelId });
    const jobSubjectId = IModelTestUtils.createJobSubjectElement(iModel, "JobSubject").insert();
    const definitionModelId = DefinitionModel.insert(iModel, jobSubjectId, "Definition");

    iModel.saveChanges();
    const locks = iModel.locks;
    expect(locks.isServerBased).true;
    await iModel.pushChanges({ description: "create model" });
    expect(iModel.locks).equal(locks); // pushing should not change your locks

    /*
    Job Subject                                           <--- Lock this
      +- DefinitionPartition  --  [DefinitionModel]
                                      SpatialCategory     <=== insert this
                                      DrawingCategory             "
  */
    assert.isFalse(iModel.locks.holdsExclusiveLock(jobSubjectId));
    assert.isFalse(iModel.locks.holdsExclusiveLock(definitionModelId));
    assert.isFalse(iModel.locks.holdsSharedLock(definitionModelId));
    await iModel.locks.acquireLocks({ exclusive: jobSubjectId });
    iModel.locks.checkExclusiveLock(jobSubjectId, "", "");
    iModel.locks.checkSharedLock(jobSubjectId, "", "");
    iModel.locks.checkSharedLock(definitionModelId, "", "");
    iModel.locks.checkExclusiveLock(definitionModelId, "", "");

    const spatialCategoryId = SpatialCategory.insert(iModel, definitionModelId, "SpatialCategory", new SubCategoryAppearance()); // throws if we get locking error
    const drawingCategoryId = DrawingCategory.insert(iModel, definitionModelId, "DrawingCategory", new SubCategoryAppearance());

    assert.isTrue(iModel.elements.getElement(spatialCategoryId).model === definitionModelId);
    assert.isTrue(iModel.elements.getElement(drawingCategoryId).model === definitionModelId);

    iModel.saveChanges();
    await iModel.pushChanges({ description: "insert category" });

    /*
    Create some more nesting.

    Job Subject                                           <--- Lock this
      +- DefinitionPartition  --  [DefinitionModel]
        |                             SpatialCategory
        +- Child Subject                                                            <== Insert
            +- DocumentList         --    [DocumentListModel]                           "
                                            Drawing             -- [DrawingModel]       "
  */
    assert.isFalse(iModel.locks.holdsExclusiveLock(jobSubjectId));
    assert.isFalse(iModel.locks.holdsExclusiveLock(definitionModelId));
    assert.isFalse(iModel.locks.holdsSharedLock(definitionModelId));
    await iModel.locks.acquireLocks({ exclusive: jobSubjectId });
    iModel.locks.checkExclusiveLock(jobSubjectId, "", "");
    iModel.locks.checkSharedLock(IModel.repositoryModelId, "", "");

    const childSubjectId = Subject.insert(iModel, jobSubjectId, "Child Subject");

    const documentListModelId = DocumentListModel.insert(iModel, childSubjectId, "Document"); // creates DocumentList and DocumentListModel
    assert.isTrue(Id64.isValidId64(documentListModelId));
    const drawingModelId = Drawing.insert(iModel, documentListModelId, "Drawing"); // creates Drawing and DrawingModel

    assert.isTrue(iModel.elements.getElement(childSubjectId).parent?.id === jobSubjectId);
    assert.isTrue(iModel.elements.getElement(childSubjectId).model === IModel.repositoryModelId);
    assert.isTrue(iModel.elements.getElement(documentListModelId).parent?.id === childSubjectId);
    assert.isTrue(iModel.elements.getElement(documentListModelId).model === IModel.repositoryModelId);
    assert.isTrue(iModel.elements.getElement(drawingModelId).model === documentListModelId);

    iModel.saveChanges();
    await iModel.pushChanges({ description: "insert doc list with nested drawing model" });

    /*
    Verify that even a deeply nested insertion is covered by the exclusive lock on the top-level parent.

    Job Subject                                           <--- Lock this
      +- DefinitionPartition  --  DefinitionModel
        |                             SpatialCategory
        +- Child Subject
            +- DocumentList         --    [DocumentListModel]
                                            Drawing             -- [DrawingModel]
                                                                      DrawingGraphic   <== Insert this
  */
    assert.isFalse(iModel.locks.holdsExclusiveLock(jobSubjectId));
    assert.isFalse(iModel.locks.holdsExclusiveLock(definitionModelId));
    assert.isFalse(iModel.locks.holdsSharedLock(definitionModelId));
    assert.isFalse(iModel.locks.holdsSharedLock(documentListModelId));
    assert.isFalse(iModel.locks.holdsSharedLock(drawingModelId));
    await iModel.locks.acquireLocks({ exclusive: jobSubjectId });
    iModel.locks.checkExclusiveLock(jobSubjectId, "", "");
    iModel.locks.checkSharedLock(IModel.repositoryModelId, "", "");
    iModel.locks.checkSharedLock(documentListModelId, "", "");
    iModel.locks.checkSharedLock(drawingModelId, "", "");

    const drawingGraphicProps1: GeometricElement2dProps = {
      classFullName: DrawingGraphic.classFullName,
      model: drawingModelId,
      category: drawingCategoryId,
      code: Code.createEmpty(),
      userLabel: "DrawingGraphic1",
      geom: IModelTestUtils.createRectangle(Point2d.create(1, 1)),
      placement: { origin: Point2d.create(2, 2), angle: 0 },
    };
    const drawingGraphicId1 = iModel.elements.insertElement(drawingGraphicProps1);

    assert.isTrue(iModel.elements.getElement(drawingGraphicId1).model === drawingModelId);
    iModel.saveChanges();
    expect(iModel.locks.holdsExclusiveLock(drawingModelId)).true;

    const fileName = iModel[_nativeDb].getFilePath();
    iModel.close(); // close rw
    iModel = await BriefcaseDb.open({ fileName, readonly: true }); // reopen readonly
    expect(iModel.locks.isServerBased).false; // readonly sessions should not have server based locks

    // verify we can push changes from a readonly briefcase
    await iModel.pushChanges({ description: "insert graphic into nested sub-model" });

    // try it again to verify we can get the ServerBasedLocks again
    await iModel.pushChanges({ description: "should do nothing" });
    iModel.close();

    // reopen readwrite to verify we released all locks from readonly briefcase
    iModel = await BriefcaseDb.open({ fileName });
    expect(iModel.locks.isServerBased).true;
    const serverLocks = iModel.locks as ServerBasedLocks;
    expect(serverLocks.holdsExclusiveLock(drawingModelId)).false;
    expect(serverLocks.getLockCount(LockState.Shared)).equal(0);
    expect(serverLocks.getLockCount(LockState.Exclusive)).equal(0);
    iModel.close();

  });

});
