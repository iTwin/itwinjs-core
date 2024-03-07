/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DbConflictCause, DbConflictResolution, DbOpcode, DbResult, Guid, GuidString, Id64String, Logger, LogLevel } from "@itwin/core-bentley";
import {
  ElementAspectProps,
  IModel,
  SubCategoryAppearance,
} from "@itwin/core-common";
import * as chai from "chai";
import { assert, expect } from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { HubWrappers, KnownTestLocations } from "../";
import { HubMock } from "../../HubMock";
import {
  BriefcaseDb,
  ChangesetConflictArgs,
  DictionaryModel,
  SpatialCategory,
} from "../../core-backend";
import { IModelTestUtils, TestUserType } from "../IModelTestUtils";
chai.use(chaiAsPromised);
import sinon = require("sinon");

async function assertThrowsAsync<T>(test: () => Promise<T>, msg?: string) {
  try {
    await test();
  } catch (e) {
    if (e instanceof Error && msg) {
      assert.equal(e.message, msg);
    }
    return;
  }
  throw new Error(`Failed to throw error with message: "${msg}"`);
}
export async function createNewModelAndCategory(rwIModel: BriefcaseDb, parent?: Id64String) {
  // Create a new physical model.
  const [, modelId] = await IModelTestUtils.createAndInsertPhysicalPartitionAndModelAsync(rwIModel, IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel"), true, parent);

  // Find or create a SpatialCategory.
  const dictionary: DictionaryModel = rwIModel.models.getModel<DictionaryModel>(IModel.dictionaryId);
  const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");
  const category = SpatialCategory.create(rwIModel, IModel.dictionaryId, newCategoryCode.value);
  const spatialCategoryId = rwIModel.elements.insertElement(category.toJSON());
  category.setDefaultAppearance(new SubCategoryAppearance({ color: 0xff0000 }));

  return { modelId, spatialCategoryId };
}

Logger.setLevel("Changeset", LogLevel.Trace);

describe("Changeset conflict handler", () => {
  let iTwinId: GuidString;
  let accessToken1: string;
  let accessToken2: string;
  let accessToken3: string;
  let b1: BriefcaseDb;
  let b2: BriefcaseDb;
  let b3: BriefcaseDb;
  let modelId: string;
  let spatialCategoryId: string;
  const iModelName = "TestIModel";

  function insertPhysicalObject(b: BriefcaseDb) {
    return b.elements.insertElement(IModelTestUtils.createPhysicalObject(b1, modelId, spatialCategoryId).toJSON());
  }
  function updatePhysicalObject(b: BriefcaseDb, el1: string, federationGuid: string) {
    const props = b.elements.getElement(el1);
    props.federationGuid = federationGuid;
    b.elements.updateElement(props.toJSON());
  }
  function insertExternalSourceAspect(b: BriefcaseDb, elementId: Id64String, identifier: string) {
    return b.elements.insertAspect({
      classFullName: "BisCore:ExternalSourceAspect",
      element: {
        relClassName: "BisCore:ElementOwnsExternalSourceAspects",
        id: elementId,
      },
      kind: "",
      identifier,
    } as ElementAspectProps);
  }

  function updateExternalSourceAspect(b: BriefcaseDb, aspectId: Id64String, elementId: Id64String, identifier: string) {
    b.elements.updateAspect({
      id: aspectId,
      classFullName: "BisCore:ExternalSourceAspect",
      element: {
        relClassName: "BisCore:ElementOwnsExternalSourceAspects",
        id: elementId,
      },
      kind: "",
      identifier,
    } as ElementAspectProps);
  }

  before(() => {
    HubMock.startup("MergeConflictTest", KnownTestLocations.outputDir);
    iTwinId = HubMock.iTwinId;
  });

  after(() => HubMock.shutdown());

  beforeEach(async () => {
    accessToken1 = await HubWrappers.getAccessToken(TestUserType.SuperManager);
    accessToken2 = await HubWrappers.getAccessToken(TestUserType.Regular);
    accessToken3 = await HubWrappers.getAccessToken(TestUserType.Super);
    const rwIModelId = await HubMock.createNewIModel({ accessToken: accessToken1, iTwinId, iModelName, description: "TestSubject", noLocks: undefined });
    assert.isNotEmpty(rwIModelId);
    b1 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: accessToken1, iTwinId, iModelId: rwIModelId, noLock: true });
    b2 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: accessToken2, iTwinId, iModelId: rwIModelId, noLock: true });
    b3 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: accessToken3, iTwinId, iModelId: rwIModelId, noLock: true });

    [, modelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(
      b1,
      IModelTestUtils.getUniqueModelCode(b1, "newPhysicalModel"),
      true);
    const dictionary: DictionaryModel = b1.models.getModel<DictionaryModel>(IModel.dictionaryId);
    const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");
    spatialCategoryId = SpatialCategory.insert(
      dictionary.iModel,
      dictionary.id,
      newCategoryCode.value,
      new SubCategoryAppearance({ color: 0xff0000 }),
    );
    b1.saveChanges();
    await b1.pushChanges({ accessToken: accessToken1, description: "" });
  });

  afterEach(async () => {
    sinon.restore();

    if (b1.isOpen)
      b1.close();

    if (b2.isOpen)
      b2.close();

    if (b3.isOpen)
      b3.close();
  });

  async function spyChangesetConflictHandler(b: BriefcaseDb, cb: () => Promise<void>, test: (s: sinon.SinonSpy<ChangesetConflictArgs[], DbConflictResolution>) => void) {
    const s1 = sinon.spy(b, "onChangesetConflict" as any) as sinon.SinonSpy<ChangesetConflictArgs[], DbConflictResolution>;
    try {
      await cb();
    } finally {
      test(s1);
      s1.restore();
    }
  }

  async function stubChangesetConflictHandler(b: BriefcaseDb, cb: () => Promise<void>, test: (s: sinon.SinonStub<ChangesetConflictArgs[], DbConflictResolution>) => void) {
    const s1 = sinon.stub(b, "onChangesetConflict" as any);
    try {
      test(s1 as sinon.SinonStub<ChangesetConflictArgs[], DbConflictResolution>);
      await cb();
    } finally {
      s1.restore();
    }
  }
  it("DbConflictCause.Conflict - duplicate primary key cause abort)", async () => {
    await b1.pullChanges();
    await b2.pullChanges();

    const el1 = insertPhysicalObject(b1);
    const el2 = insertPhysicalObject(b2);

    ((/* simulate duplicate primary */) => {
      // Do avoid fk error move geom3d part of physical element to existing id = 1
      b2.withSqliteStatement(`UPDATE bis_GeometricElement3d SET RowId=${0x1} WHERE RowId=${el2}`, (stmt) => {
        expect(stmt.step()).eq(DbResult.BE_SQLITE_DONE);
      });
      // set el2 to same id as el1
      b2.withSqliteStatement(`UPDATE bis_Element SET RowId=${el1} WHERE RowId=${el2}`, (stmt) => {
        expect(stmt.step()).eq(DbResult.BE_SQLITE_DONE);
      });
      // update geom3d back from 1 to el2
      b2.withSqliteStatement(`UPDATE bis_GeometricElement3d SET RowId=${el1} WHERE RowId=${0x1}`, (stmt) => {
        expect(stmt.step()).eq(DbResult.BE_SQLITE_DONE);
      });
    })();

    b1.saveChanges();
    b2.saveChanges();

    await spyChangesetConflictHandler(
      b2,
      async () => b2.pushChanges({ accessToken: accessToken2, description: "" }),
      (spy) => expect(spy.callCount).eq(0, "changeset conflict handler should not be called"),
    );

    await spyChangesetConflictHandler(
      b1,
      async () => assertThrowsAsync(
        async () => b1.pushChanges({ accessToken: accessToken1, description: "" }),
        "PRIMARY KEY INSERT CONFLICT - rejecting this changeset"),
      (spy) => {
        expect(spy.callCount).eq(1);
        expect(spy.alwaysReturned(DbConflictResolution.Abort)).true;
        const arg = spy.args[0][0];
        expect(arg.cause).eq(DbConflictCause.Conflict);
        expect(arg.opcode).eq(DbOpcode.Insert);
        expect(arg.indirect).false;
        expect(arg.tableName).eq("bis_Element");
      },
    );
  });
  it("DbConflictCause.Data - indirect change is not considered as data conflict & replaces existing change)", async () => {
    await b1.pullChanges();
    await b2.pullChanges();

    insertPhysicalObject(b1);
    insertPhysicalObject(b2);

    b1.saveChanges();
    b2.saveChanges();

    await spyChangesetConflictHandler(
      b2,
      async () => b2.pushChanges({ accessToken: accessToken2, description: "" }),
      (spy) => expect(spy.callCount).eq(0, "changeset conflict handler should not be called"),
    );

    await spyChangesetConflictHandler(
      b1,
      async () => b1.pushChanges({ accessToken: accessToken1, description: "" }),
      (spy) => {
        expect(spy.callCount).eq(1);
        expect(spy.alwaysReturned(DbConflictResolution.Replace)).true;
        const arg = spy.args[0][0];
        expect(arg.cause).eq(DbConflictCause.Data);
        expect(arg.opcode).eq(DbOpcode.Update);
        expect(arg.indirect).true;
        expect(arg.tableName).eq("bis_Model");
      },
    );
  });
  it("DbConflictCause.Data - direct changes to LastMod will abort", async () => {
    const el1 = insertPhysicalObject(b1);
    const aspectId1 = insertExternalSourceAspect(b1, el1, "test identifier");
    const aspectId2 = insertExternalSourceAspect(b1, el1, "test identifier");
    b1.saveChanges();
    await b1.pushChanges({ accessToken: accessToken1, description: "" });

    await b1.pullChanges();
    await b2.pullChanges();

    updateExternalSourceAspect(b1, aspectId1, el1, "hello1");
    updateExternalSourceAspect(b2, aspectId2, el1, "hello2");

    b1.saveChanges();
    b2.saveChanges();

    await spyChangesetConflictHandler(
      b2,
      async () => b2.pushChanges({ accessToken: accessToken2, description: "" }),
      (spy) => expect(spy.callCount).eq(0, "changeset conflict handler should not be called"),
    );

    await spyChangesetConflictHandler(
      b1,
      async () => assertThrowsAsync(
        async () => b1.pushChanges({ accessToken: accessToken1, description: "" }),
        "UPDATE/DELETE before value do not match with one in db or CASCADE action was triggered."),
      (spy) => {
        expect(spy.callCount).eq(1);
        expect(spy.alwaysReturned(DbConflictResolution.Abort)).true;
        const arg = spy.args[0][0];
        expect(arg.cause).eq(DbConflictCause.Data);
        expect(arg.opcode).eq(DbOpcode.Update);
        expect(arg.indirect).false;
        expect(arg.tableName).eq("bis_Element");
      },
    );
  });
  it("DbConflictCause.NotFound - deleted row", async () => {
    const el1 = insertPhysicalObject(b1);

    b1.saveChanges();
    await b1.pushChanges({ accessToken: accessToken1, description: "" });

    await b1.pullChanges();
    await b2.pullChanges();

    b1.elements.deleteElement(el1);
    insertExternalSourceAspect(b2, el1, "test identifier");

    b1.saveChanges();
    b2.saveChanges();

    await spyChangesetConflictHandler(
      b1,
      async () => b1.pushChanges({ accessToken: accessToken1, description: "" }),
      (spy) => expect(spy.callCount).eq(0, "changeset conflict handler should not be called"),
    );

    // push will fail with Data conflict and to simulate FK we will for force push by overriding
    // return result of conflict Handler.
    await stubChangesetConflictHandler(
      b2,
      async () => b2.pushChanges({ accessToken: accessToken1, description: "" }),
      (stub) => {
        stub.returns(DbConflictResolution.Skip);
      },
    );

    // third briefcase while pull will see a fk violation.
    await spyChangesetConflictHandler(
      b3,
      async () => b3.pullChanges({ accessToken: accessToken1 }),
      (spy) => {
        expect(spy.callCount).eq(1);
        expect(spy.alwaysReturned(DbConflictResolution.Skip)).true;
        const arg = spy.args[0][0];
        expect(arg.cause).eq(DbConflictCause.NotFound);
        expect(arg.opcode).eq(DbOpcode.Delete);
        expect(arg.indirect).true;
        expect(arg.tableName).eq("bis_GeometricElement3d");
      },
    );
  });
  it.skip("DbConflictCause.Constraint - duplicate userLabels", async () => {
    await b1.pullChanges();
    await b2.pullChanges();
    const nonUniqueGuid = Guid.createValue();
    const el1 = insertPhysicalObject(b1);
    updatePhysicalObject(b1, el1, nonUniqueGuid);
    b1.saveChanges();

    const el2 = insertPhysicalObject(b2);
    updatePhysicalObject(b2, el2, nonUniqueGuid);
    b2.saveChanges();

    await b1.pushChanges({ accessToken: accessToken1, description: "" });

    await spyChangesetConflictHandler(
      b1,
      async () => b1.pushChanges({ accessToken: accessToken1, description: "" }),
      (spy) => expect(spy.callCount).eq(0, "changeset conflict handler should not be called"),
    );

    await spyChangesetConflictHandler(
      b2,
      async () => assertThrowsAsync(
        async () => b2.pushChanges({ accessToken: accessToken1, description: "" }),
        "Error in native callback"),
      (spy) => {
        expect(spy.callCount).eq(2);
        expect(spy.returnValues[0]).eq(DbConflictResolution.Skip);
        const arg0 = spy.args[0][0];
        expect(arg0.cause).eq(DbConflictCause.Constraint);
        expect(arg0.opcode).eq(DbOpcode.Insert);
        expect(arg0.indirect).false;
        expect(arg0.tableName).eq("bis_Element");

        expect(spy.returnValues[1]).eq(DbConflictResolution.Replace);
        const arg1 = spy.args[1][0];
        expect(arg1.cause).eq(DbConflictCause.Data);
        expect(arg1.opcode).eq(DbOpcode.Update);
        expect(arg1.indirect).true;
        expect(arg1.tableName).eq("bis_Model");
      },
    );
  });
});

