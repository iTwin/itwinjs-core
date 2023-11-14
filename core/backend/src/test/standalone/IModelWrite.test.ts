/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AccessToken, DbResult, GuidString, Id64, Id64String } from "@itwin/core-bentley";
import {
  Code, ColorDef, ElementAspectProps, GeometricElement2dProps, GeometryStreamProps, IModel, QueryRowFormat, RequestNewBriefcaseProps, SchemaState, SubCategoryAppearance,
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
  BriefcaseDb, BriefcaseManager,
  DefinitionModel, DictionaryModel, DocumentListModel, Drawing, DrawingGraphic, SpatialCategory, Subject,
} from "../../core-backend";
import { IModelTestUtils, TestUserType } from "../IModelTestUtils";
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
    const roBC = await BriefcaseDb.open({ fileName: briefcaseProps.fileName, watchForChanges: true });

    const code1 = IModelTestUtils.getUniqueModelCode(bc, "newPhysicalModel1");
    await IModelTestUtils.createAndInsertPhysicalPartitionAndModelAsync(bc, code1, true);
    bc.saveChanges();

    // immediately after save changes the current txnId in the writeable briefcase changes, but it isn't reflected
    // in the readonly briefcase until the file watcher fires.
    expect(bc.nativeDb.getCurrentTxnId()).not.equal(roBC.nativeDb.getCurrentTxnId());

    // trigger watcher via stub
    fsWatcher.callback();

    // now they should match because restartDefaultTxn in the readonly briefcase reads the changes from the writeable connection
    expect(bc.nativeDb.getCurrentTxnId()).equal(roBC.nativeDb.getCurrentTxnId());

    roBC.close();
    expect(nClosed).equal(1);

    bc.close();
    sinon.restore();
  });

  it("aspect insert, update & delete requires exclusive lock", async () => {
    const accessToken1 = await HubWrappers.getAccessToken(TestUserType.SuperManager);
    const accessToken2 = await HubWrappers.getAccessToken(TestUserType.Regular);
    const accessToken3 = await HubWrappers.getAccessToken(TestUserType.Super);

    // Delete any existing iModels with the same name as the read-write test iModel
    const iModelName = "TestIModel";

    // Create a new empty iModel on the Hub & obtain a briefcase
    const rwIModelId = await HubMock.createNewIModel({ accessToken: accessToken1, iTwinId, iModelName, description: "TestSubject", noLocks: undefined });
    assert.isNotEmpty(rwIModelId);

    const b1 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: accessToken1, iTwinId, iModelId: rwIModelId });
    const b2 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: accessToken2, iTwinId, iModelId: rwIModelId });
    const b3 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: accessToken3, iTwinId, iModelId: rwIModelId });

    await b1.locks.acquireLocks({ shared: IModel.repositoryModelId });
    await b2.locks.acquireLocks({ shared: IModel.repositoryModelId });

    // create and insert a new model with code1
    const [, modelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(
      b1,
      IModelTestUtils.getUniqueModelCode(b1, "newPhysicalModel"),
      true);

    const dictionary: DictionaryModel = b1.models.getModel<DictionaryModel>(IModel.dictionaryId);
    const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");

    await b1.locks.acquireLocks({ shared: dictionary.id });
    const spatialCategoryId = SpatialCategory.insert(
      dictionary.iModel,
      dictionary.id,
      newCategoryCode.value,
      new SubCategoryAppearance({ color: 0xff0000 }),
    );
    const el1 = b1.elements.insertElement(IModelTestUtils.createPhysicalObject(b1, modelId, spatialCategoryId).toJSON());
    b1.saveChanges();
    await b1.pushChanges({ accessToken: accessToken1, description: `inserted element ${el1}` });

    await b2.pullChanges();
    let aspectId: Id64String;
    const insertAspectIntoB2 = () => {
      aspectId = b2.elements.insertAspect({
        classFullName: "BisCore:ExternalSourceAspect",
        element: {
          relClassName: "BisCore:ElementOwnsExternalSourceAspects",
          id: el1,
        },
        kind: "",
        identifier: "test identifier",
      } as ElementAspectProps);
    };

    /* attempt to insert aspect without a lock */
    assert.throws(insertAspectIntoB2, "Error inserting ElementAspect [exclusive lock not held on element for insert aspect (id=0x20000000004)], class: BisCore:ExternalSourceAspect");

    /* acquire lock and try again */
    await b2.locks.acquireLocks({ exclusive: el1 });
    insertAspectIntoB2();

    /* b1 cannot acquire lock on el1 as its already taken by b2 */
    await expect(b1.locks.acquireLocks({ exclusive: el1 })).to.be.rejectedWith("exclusive lock is already held");

    /* push changes on b2 to release lock on el1 */
    b2.saveChanges();
    await b2.pushChanges({ accessToken: accessToken2, description: `add aspect to element ${el1}` });

    await b1.pullChanges();

    const updateAspectIntoB1 = () => {
      b1.elements.updateAspect({
        id: aspectId,
        classFullName: "BisCore:ExternalSourceAspect",
        element: {
          relClassName: "BisCore:ElementOwnsExternalSourceAspects",
          id: el1,
        },
        kind: "",
        identifier: "test identifier (modified)",
      } as ElementAspectProps);
    };

    /* attempt to update aspect without a lock */
    assert.throws(updateAspectIntoB1, "Error updating ElementAspect [exclusive lock not held on element for update aspect (id=0x20000000004)], id: 0x30000000001");

    /* acquire lock and try again */
    await b1.locks.acquireLocks({ exclusive: el1 });
    updateAspectIntoB1();

    /* delete the element */
    b1.elements.deleteElement(el1);
    b1.saveChanges();

    await b1.pushChanges({ accessToken: accessToken1, description: `deleted element ${el1}` });

    /* we should be able to apply all changesets */
    await b3.pullChanges();

    b1.close();
    b2.close();
    b3.close();
  });

  it("should handle undo/redo", async () => {
    const adminAccessToken = await HubWrappers.getAccessToken(TestUserType.SuperManager);
    // Delete any existing iModels with the same name as the read-write test iModel
    const iModelName = "CodesUndoRedoPushTest";

    // Create a new empty iModel on the Hub & obtain a briefcase
    const rwIModelId = await HubMock.createNewIModel({ accessToken: adminAccessToken, iTwinId, iModelName, description: "TestSubject" });
    assert.isNotEmpty(rwIModelId);
    const rwIModel = await HubWrappers.downloadAndOpenBriefcase({ accessToken: adminAccessToken, iTwinId, iModelId: rwIModelId });

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
    } catch (_err) {
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
    assert.isFalse(iModel.nativeDb.hasPendingTxns());
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
    assert.isFalse(iModel.nativeDb.hasPendingTxns());
    assert.isFalse(iModel.holdsSchemaLock);
    assert.isFalse(iModel.nativeDb.hasUnsavedChanges());
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
    assert.isFalse(superIModel.nativeDb.hasUnsavedChanges()); // Validate no changes were made
    assert.isFalse(superIModel.nativeDb.hasPendingTxns()); // Validate no changes were made
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
    assert.equal(rwIModel.nativeDb.enableChangesetSizeStats(true), DbResult.BE_SQLITE_OK);
    const schema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="ts" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
        <ECEntityClass typeName="Test2dElement">
            <BaseClass>bis:GraphicalElement2d</BaseClass>
            <ECProperty propertyName="s" typeName="string"/>
        </ECEntityClass>
    </ECSchema>`;
    await rwIModel.importSchemaStrings([schema]);
    rwIModel.saveChanges("user 1: schema changeset");
    if ("push changes") {
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
    assert.equal(1357661, rwIModel.nativeDb.getChangesetSize());

    rwIModel.saveChanges("user 1: data");
    assert.equal(0, rwIModel.nativeDb.getChangesetSize());
    await rwIModel.pushChanges({ description: "schema changeset", accessToken: adminToken });
    rwIModel.close();
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
    assert.equal(rwIModel.nativeDb.enableChangesetSizeStats(true), DbResult.BE_SQLITE_OK);
    assert.equal(rwIModel2.nativeDb.enableChangesetSizeStats(true), DbResult.BE_SQLITE_OK);

    const schema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestDomain" alias="ts" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
        <ECEntityClass typeName="Test2dElement">
            <BaseClass>bis:GraphicalElement2d</BaseClass>
            <ECProperty propertyName="s" typeName="string"/>
        </ECEntityClass>
    </ECSchema>`;
    await rwIModel.importSchemaStrings([schema]);

    rwIModel.saveChanges("user 1: schema changeset");
    if ("push changes") {
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

    assert.equal(3902, rwIModel.nativeDb.getChangesetSize());
    rwIModel.saveChanges("user 1: data changeset");

    if ("push changes") {
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
    if ("user pull/merge") {
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
      assert.equal(13, rwIModel.nativeDb.getChangesetSize());
      rwIModel2.saveChanges("user 2: data changeset");

      if ("push changes") {
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
    assert.equal(0, rwIModel.nativeDb.getChangesetSize());
    rwIModel.saveChanges("user 1: schema changeset2");
    if ("push changes") {
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
    assert.equal(6279, rwIModel.nativeDb.getChangesetSize());
    rwIModel.saveChanges("user 1: data changeset");

    if ("push changes") {
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

    if ("user pull/merge") {
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
    const iModel = await HubWrappers.downloadAndOpenBriefcase({ iTwinId, iModelId });

    /*
    Job Subject
      +- DefinitionPartition  --  [DefinitionModel]
  */

    await iModel.locks.acquireLocks({ shared: IModel.repositoryModelId });
    const jobSubjectId = IModelTestUtils.createJobSubjectElement(iModel, "JobSubject").insert();
    const definitionModelId = DefinitionModel.insert(iModel, jobSubjectId, "Definition");

    iModel.saveChanges();
    await iModel.pushChanges({ description: "create model" });

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
    await iModel.pushChanges({ description: "insert graphic into nested sub-model" });

    iModel.close();
  });

});
