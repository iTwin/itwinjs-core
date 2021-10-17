/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import * as semver from "semver";
import { AccessToken, DbResult, GuidString, Id64, Id64String } from "@itwin/core-bentley";
import {
  Code, ColorDef, GeometryStreamProps, IModel, QueryRowFormat, RequestNewBriefcaseProps, SchemaState, SubCategoryAppearance,
} from "@itwin/core-common";
import { Arc3d, IModelJson, Point3d } from "@itwin/core-geometry";
import { DrawingCategory } from "../../Category";
import {
  BriefcaseDb, BriefcaseManager, DictionaryModel, IModelHost, IModelJsFs, SpatialCategory, SqliteStatement, SqliteValue, SqliteValueType,
} from "../../core-backend";
import { ECSqlStatement } from "../../ECSqlStatement";
import { HubMock } from "../HubMock";
import { IModelTestUtils, TestUserType } from "../IModelTestUtils";
import { HubWrappers } from "..";

export async function createNewModelAndCategory(rwIModel: BriefcaseDb, parent?: Id64String) {
  // Create a new physical model.
  const [, modelId] = await IModelTestUtils.createAndInsertPhysicalPartitionAndModelAsync(rwIModel, IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel"), true, parent);

  // Find or create a SpatialCategory.
  const dictionary: DictionaryModel = rwIModel.models.getModel<DictionaryModel>(IModel.dictionaryId);
  const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");
  const category = SpatialCategory.create(rwIModel, IModel.dictionaryId, newCategoryCode.value);
  const spatialCategoryId = rwIModel.elements.insertElement(category);
  category.setDefaultAppearance(new SubCategoryAppearance({ color: 0xff0000 }));
  // const spatialCategoryId: Id64String = SpatialCategory.insert(rwIModel, IModel.dictionaryId, newCategoryCode.value!, new SubCategoryAppearance({ color: 0xff0000 }));

  return { modelId, spatialCategoryId };
}

describe("IModelWriteTest", () => {
  let managerAccessToken: AccessToken;
  let superAccessToken: AccessToken;
  let testITwinId: string;
  let readWriteTestIModelId: GuidString;

  let readWriteTestIModelName: string;

  before(async () => {
    // IModelTestUtils.setupDebugLogLevels();
    HubMock.startup("IModelWriteTest");

    testITwinId = HubMock.iTwinId;
    readWriteTestIModelName = IModelTestUtils.generateUniqueName("ReadWriteTest");
    readWriteTestIModelId = await HubWrappers.recreateIModel({ accessToken: managerAccessToken, iTwinId: testITwinId, iModelName: readWriteTestIModelName });

    // Purge briefcases that are close to reaching the acquire limit
    await HubWrappers.purgeAcquiredBriefcasesById(managerAccessToken, readWriteTestIModelId);
  });

  after(async () => {
    try {
      await HubWrappers.deleteIModel(managerAccessToken, "iModelJsIntegrationTest", readWriteTestIModelName);
      HubMock.shutdown();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(err);
    }
  });

  it("should handle undo/redo", async () => {
    const adminAccessToken = await HubWrappers.getAccessToken(TestUserType.SuperManager);
    // Delete any existing iModels with the same name as the read-write test iModel
    const iModelName = "CodesUndoRedoPushTest";
    const iModelId = await IModelHost.hubAccess.queryIModelByName({ accessToken: adminAccessToken, iTwinId: testITwinId, iModelName });
    if (iModelId)
      await IModelHost.hubAccess.deleteIModel({ accessToken: adminAccessToken, iTwinId: testITwinId, iModelId });

    // Create a new empty iModel on the Hub & obtain a briefcase
    const rwIModelId = await IModelHost.hubAccess.createNewIModel({ accessToken: adminAccessToken, iTwinId: testITwinId, iModelName, description: "TestSubject" });
    assert.isNotEmpty(rwIModelId);
    const rwIModel = await HubWrappers.downloadAndOpenBriefcase({ accessToken: adminAccessToken, iTwinId: testITwinId, iModelId: rwIModelId });

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
    // The iModel should have code1 marked as used and not code2
    // timer = new Timer("querying codes");
    // const codes = await IModelHubAccess.iModelClient.codes.get(adminRequestContext, rwIModelId);
    // timer.end();
    // assert.isTrue(codes.find((code) => (code.value === "newPhysicalModel2" && code.state === CodeState.Used)) !== undefined);
    // assert.isFalse(codes.find((code) => (code.value === "newPhysicalModel" && code.state === CodeState.Used)) !== undefined);
  });

  it("Run plain SQL against fixed version connection", async () => {
    const iModel = await HubWrappers.downloadAndOpenBriefcase({ accessToken: managerAccessToken, iTwinId: testITwinId, iModelId: readWriteTestIModelId });
    try {
      iModel.withPreparedSqliteStatement("CREATE TABLE Test(Id INTEGER PRIMARY KEY, Name TEXT NOT NULL, Code INTEGER)", (stmt: SqliteStatement) => {
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });

      iModel.withPreparedSqliteStatement("INSERT INTO Test(Name,Code) VALUES(?,?)", (stmt: SqliteStatement) => {
        stmt.bindValue(1, "Dummy 1");
        stmt.bindValue(2, 100);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });

      iModel.withPreparedSqliteStatement("INSERT INTO Test(Name,Code) VALUES(?,?)", (stmt: SqliteStatement) => {
        stmt.bindValues(["Dummy 2", 200]);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });

      iModel.withPreparedSqliteStatement("INSERT INTO Test(Name,Code) VALUES(:p1,:p2)", (stmt: SqliteStatement) => {
        stmt.bindValue(":p1", "Dummy 3");
        stmt.bindValue(":p2", 300);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });

      iModel.withPreparedSqliteStatement("INSERT INTO Test(Name,Code) VALUES(:p1,:p2)", (stmt: SqliteStatement) => {
        stmt.bindValues({ ":p1": "Dummy 4", ":p2": 400 });
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });

      iModel.saveChanges();

      iModel.withPreparedSqliteStatement("SELECT Id,Name,Code FROM Test ORDER BY Id", (stmt: SqliteStatement) => {
        for (let i: number = 1; i <= 4; i++) {
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          assert.equal(stmt.getColumnCount(), 3);
          const val0: SqliteValue = stmt.getValue(0);
          assert.equal(val0.columnName, "Id");
          assert.equal(val0.type, SqliteValueType.Integer);
          assert.isFalse(val0.isNull);
          assert.equal(val0.getInteger(), i);

          const val1: SqliteValue = stmt.getValue(1);
          assert.equal(val1.columnName, "Name");
          assert.equal(val1.type, SqliteValueType.String);
          assert.isFalse(val1.isNull);
          assert.equal(val1.getString(), `Dummy ${i}`);

          const val2: SqliteValue = stmt.getValue(2);
          assert.equal(val2.columnName, "Code");
          assert.equal(val2.type, SqliteValueType.Integer);
          assert.isFalse(val2.isNull);
          assert.equal(val2.getInteger(), i * 100);

          const row: any = stmt.getRow();
          assert.equal(row.id, i);
          assert.equal(row.name, `Dummy ${i}`);
          assert.equal(row.code, i * 100);
        }
        assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE);
      });
    } finally {
      // delete the briefcase as the test modified it locally.
      let briefcasePath: string | undefined;
      if (iModel.isOpen)
        briefcasePath = iModel.pathName;

      await HubWrappers.closeAndDeleteBriefcaseDb(managerAccessToken, iModel);
      if (!!briefcasePath && IModelJsFs.existsSync(briefcasePath))
        IModelJsFs.unlinkSync(briefcasePath);
    }
  });

  it("Run plain SQL against readonly connection", async () => {
    const iModel = await HubWrappers.downloadAndOpenCheckpoint({ accessToken: managerAccessToken, iTwinId: testITwinId, iModelId: readWriteTestIModelId });

    iModel.withPreparedSqliteStatement("SELECT Name,StrData FROM be_Prop WHERE Namespace='ec_Db'", (stmt: SqliteStatement) => {
      let rowCount = 0;
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        rowCount++;
        assert.equal(stmt.getColumnCount(), 2);
        const nameVal: SqliteValue = stmt.getValue(0);
        assert.equal(nameVal.columnName, "Name");
        assert.equal(nameVal.type, SqliteValueType.String);
        assert.isFalse(nameVal.isNull);
        const name: string = nameVal.getString();

        const versionVal = stmt.getValue(1);
        assert.equal(versionVal.columnName, "StrData");
        assert.equal(versionVal.type, SqliteValueType.String);
        assert.isFalse(versionVal.isNull);
        const profileVersion: any = JSON.parse(versionVal.getString());

        assert.isTrue(name === "SchemaVersion" || name === "InitialSchemaVersion");
        if (name === "SchemaVersion") {
          assert.equal(profileVersion.major, 4);
          assert.equal(profileVersion.minor, 0);
          assert.equal(profileVersion.sub1, 0);
          assert.isAtLeast(profileVersion.sub2, 1);
        } else if (name === "InitialSchemaVersion") {
          assert.equal(profileVersion.major, 4);
          assert.equal(profileVersion.minor, 0);
          assert.equal(profileVersion.sub1, 0);
          assert.isAtLeast(profileVersion.sub2, 1);
        }
      }
      assert.equal(rowCount, 2);
    });
    iModel.close();
  });

  it("should be able to upgrade a briefcase with an older schema", async () => {
    const iTwinId = HubMock.iTwinId;

    /**
     * Test validates that -
     * - User "manager" upgrades the BisCore schema in the briefcase from version 1.0.0 to 1.0.10+
     * - User "super" can get the upgrade "manager" made
     */

    /* Setup test - Push an iModel with an old BisCore schema up to the Hub */
    const pathname = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
    const hubName = IModelTestUtils.generateUniqueName("CompatibilityTest");
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

    // SKIPPED FOR NOW - locking not mocked yet
    // Upgrade the schemas - should fail, since user hasn't pulled changes done by manager
    // // let result: IModelHubStatus = IModelHubStatus.Success;
    // try {
    //   await BriefcaseDb.upgradeSchemas(superRequestContext, superBriefcaseProps);
    // } catch (err) {
    //   // result = err.errorNumber;
    // }
    // assert.strictEqual(result, IModelHubStatus.PullIsRequired);

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
    await IModelHost.hubAccess.deleteIModel({ accessToken: managerAccessToken, iTwinId, iModelId });
  });

  it("changeset size and ec schema version change", async () => {
    const adminToken = "super manager token";
    const iTwinId = HubMock.iTwinId;
    const iModelName = IModelTestUtils.generateUniqueName("changeset_size");
    const rwIModelId = await IModelHost.hubAccess.createNewIModel({ iTwinId, iModelName, description: "TestSubject", accessToken: adminToken });
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
      const changesets = await IModelHost.hubAccess.queryChangesets({ iModelId: rwIModelId, accessToken: superAccessToken });
      assert.equal(changesets.length, 1);
    }
    await rwIModel.locks.acquireSharedLock(IModel.dictionaryId);
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
    const iTwinId = HubMock.iTwinId;
    // Delete any existing iModels with the same name as the OptimisticConcurrencyTest iModel
    const iModelName = IModelTestUtils.generateUniqueName("SchemaChanges");

    // Create a new empty iModel on the Hub & obtain a briefcase
    const rwIModelId = await IModelHost.hubAccess.createNewIModel({ iTwinId, iModelName, description: "TestSubject" });
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
      const changesets = await IModelHost.hubAccess.queryChangesets({ iModelId: rwIModelId, accessToken: superAccessToken });
      assert.equal(changesets.length, 1);
    }
    const codeProps = Code.createEmpty();
    codeProps.value = "DrawingModel";
    let totalEl = 0;
    await rwIModel.locks.acquireSharedLock(IModel.dictionaryId);
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
      const changesets = await IModelHost.hubAccess.queryChangesets({ iModelId: rwIModelId, accessToken: superAccessToken });
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
    for await (const row of rwIModel.query("SELECT * FROM TestDomain.Test2dElement", undefined, QueryRowFormat.UseJsPropertyNames)) {
      rows.push(row);
    }
    assert.equal(rows.length, 10);
    assert.equal(rows.map((r) => r.s).filter((v) => v).length, 10);
    // ====================================================================================================
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
      for await (const row of rwIModel2.query("SELECT * FROM TestDomain.Test2dElement", undefined, QueryRowFormat.UseJsPropertyNames)) {
        rows.push(row);
      }
      assert.equal(rows.length, 10);
      assert.equal(rows.map((r) => r.s).filter((v) => v).length, 10);
      // create some element and push those changes
      await rwIModel2.locks.acquireSharedLock(drawingModelId);
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
        const changesets = await IModelHost.hubAccess.queryChangesets({ iModelId: rwIModelId, accessToken: userToken });
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
      const changesets = await IModelHost.hubAccess.queryChangesets({ iModelId: rwIModelId, accessToken: superAccessToken });
      assert.equal(changesets.length, 4);
    }
    // create some element and push those changes
    await rwIModel.locks.acquireSharedLock(drawingModelId);
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
      const changesets = await IModelHost.hubAccess.queryChangesets({ iModelId: rwIModelId, accessToken: superAccessToken });
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
    for await (const row of rwIModel.query("SELECT * FROM TestDomain.Test2dElement", undefined, QueryRowFormat.UseJsPropertyNames)) {
      rows.push(row);
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
    for await (const row of rwIModel.query("SELECT * FROM TestDomain.Test2dElement2nd", undefined, QueryRowFormat.UseJsPropertyNames)) {
      rows.push(row);
    }
    assert.equal(rows.length, 10);
    assert.equal(rows.map((r) => r.t).filter((v) => v).length, 10);
    assert.equal(rows.map((r) => r.r).filter((v) => v).length, 10);

    // ====================================================================================================
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
      for await (const row of rwIModel2.query("SELECT * FROM TestDomain.Test2dElement", undefined, QueryRowFormat.UseJsPropertyNames)) {
        rows.push(row);
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
      for await (const row of rwIModel2.query("SELECT * FROM TestDomain.Test2dElement2nd", undefined, QueryRowFormat.UseJsPropertyNames)) {
        rows.push(row);
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
});
