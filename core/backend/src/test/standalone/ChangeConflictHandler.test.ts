/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DbChangeStage, DbConflictCause, DbConflictResolution, DbOpcode, DbResult, DbValueType, Guid, GuidString, Id64String, IModelStatus, Logger, LogLevel } from "@itwin/core-bentley";
import {
  ElementAspectProps,
  FilePropertyProps,
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
  ChannelControl,
  DictionaryModel,
  SpatialCategory,
  SqliteChangesetReader,
} from "../../core-backend";
import { IModelTestUtils, TestUserType } from "../IModelTestUtils";
chai.use(chaiAsPromised);
import sinon = require("sinon");
import { Point3d, Range3d, Range3dProps } from "@itwin/core-geometry";
import { FilePropertyConflictHandler } from "../../FilePropertyConflictHandler";

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
function setProjectExtentsSource(db: BriefcaseDb, source: "user" | "computed") {
  const unitsJson = db.queryFilePropertyString({ namespace: "dgn_Db", name: "Units" });
  let units: any;
  if (unitsJson) {
    units = JSON.parse(unitsJson);
    units.extentsSource = source === "user" ? 1 : 0;
  } else
    units = source === "user" ? { extentsSource: 1 } : undefined;

  if (units) {
    db.saveFileProperty({ namespace: "dgn_Db", name: "Units" }, JSON.stringify(units));
  }
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

describe.only("Changeset conflict handler", () => {
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
    b1.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    b2 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: accessToken2, iTwinId, iModelId: rwIModelId, noLock: true });
    b2.channels.addAllowedChannel(ChannelControl.sharedChannelName);

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
    b2.saveChanges();
    b3.saveChanges();
    await b1.pushChanges({ accessToken: accessToken1, description: "" });
  });

  afterEach(async () => {
    sinon.restore();

    if (b1.isOpen) {
      b1.abandonChanges();
      b1.close();
    }

    if (b2.isOpen) {
      b2.abandonChanges();
      b2.close();
    }

    if (b3.isOpen) {
      b3.abandonChanges();
      b3.close();
    }
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
    const s1 = sinon.stub(b as any, "onChangesetConflict" as any);
    try {
      test(s1 as sinon.SinonStub<ChangesetConflictArgs[], DbConflictResolution>);
      await cb();
    } finally {
      s1.restore();
    }
  }
  async function fakeChangesetConflictHandler(b: BriefcaseDb, cb: () => Promise<void>, interceptMethod: (arg: ChangesetConflictArgs) => DbConflictResolution | undefined) {
    const s1 = sinon.stub<ChangesetConflictArgs[], DbConflictResolution>(b as any, "onChangesetConflict" as any);
    s1.callsFake(interceptMethod);
    try {
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
  it("FileProps conflict handler", async () => {

    const kB1LargeBlob = Uint8Array.from(Array(1024).fill(1)); // will be compressed by default
    const kB1SmallBlob = Uint8Array.from(Array(50).fill(1)); // we do not compress < 100 bytes by default.
    const kB1StrData = "Test data form briefcase 1";
    const kB1StrDataPrivate = "only pushed by b1";

    const kB2LargeBlob = Uint8Array.from(Array(1024).fill(2)); // will be compressed by default
    const kB2SmallBlob = Uint8Array.from(Array(50).fill(2)); // we do not compress < 100 bytes by default.
    const kB2StrData = "Test data form briefcase 2";
    const kB2StrDataPrivate = "only pushed by b2";

    const kB3LargeBlob = Uint8Array.from(Array(1024).fill(3)); // will be compressed by default
    const kB3SmallBlob = Uint8Array.from(Array(50).fill(3)); // we do not compress < 100 bytes by default.
    const kB3StrData = "Test data form briefcase 3";
    const kB3StrDataPrivate = "only pushed by b3";

    b1.saveFileProperty({ namespace: "Test", name: "LargeBlobWithStrData", id: "0xaabbcc", subId: "0xccddee" }, "large blob b1", kB1LargeBlob);
    b1.saveFileProperty({ namespace: "Test", name: "SmallBlobWithStrData" }, "small blob b1", kB1SmallBlob);
    b1.saveFileProperty({ namespace: "Test", name: "LargeBlob" }, undefined, kB1LargeBlob);
    b1.saveFileProperty({ namespace: "Test", name: "SmallBlob" }, undefined, kB1SmallBlob);
    b1.saveFileProperty({ namespace: "Test", name: "StrDataOnly" }, kB1StrData);
    b1.saveFileProperty({ namespace: "Test", name: "b1" }, kB1StrDataPrivate);
    b1.saveFileProperty({ namespace: "Test", name: "ShouldBeDeleted" }, kB1StrData);

    b1.saveChanges();
    await b1.pushChanges({ description: "" });

    b2.saveFileProperty({ namespace: "Test", name: "LargeBlobWithStrData" }, "large blob b2", kB2LargeBlob);
    b2.saveFileProperty({ namespace: "Test", name: "SmallBlobWithStrData" }, "small blob b2", kB2SmallBlob);
    b2.saveFileProperty({ namespace: "Test", name: "LargeBlob" }, undefined, kB2LargeBlob);
    b2.saveFileProperty({ namespace: "Test", name: "SmallBlob" }, undefined, kB2SmallBlob);
    b2.saveFileProperty({ namespace: "Test", name: "StrDataOnly" }, kB2StrData);
    b2.saveFileProperty({ namespace: "Test", name: "b2" }, kB2StrDataPrivate);
    b2.deleteFileProperty({ namespace: "Test", name: "ShouldBeDeleted" });

    b2.saveChanges("b2 save file props");

    await spyChangesetConflictHandler(
      b2,
      async () => assertThrowsAsync(
        async () => b2.pushChanges({ description: "" }),
        "PRIMARY KEY INSERT CONFLICT - rejecting this changeset"),
      (spy) => {
        expect(spy.callCount).eq(1);
        expect(spy.alwaysReturned(DbConflictResolution.Abort)).true;
        const arg = spy.args[0][0];
        expect(arg.cause).eq(DbConflictCause.Conflict);
        expect(arg.opcode).eq(DbOpcode.Insert);
        expect(arg.indirect).false;
        expect(arg.tableName).eq("be_Prop");
      },
    );

    expect(b2.txns.isUndoPossible).is.true;
    expect(b2.txns.getUndoString()).equals("Merged");
    expect(b2.txns.reverseSingleTxn()).equals(IModelStatus.Success);
    expect(b2.txns.getUndoString()).equals("b2 save file props");
    expect(b2.txns.reverseSingleTxn()).equals(IModelStatus.Success);
    expect(b2.txns.isUndoPossible).is.false;
    await b2.pullChanges();

    expect(b2.queryFilePropertyString({ namespace: "Test", name: "LargeBlobWithStrData", id: "0xaabbcc", subId: "0xccddee" })).equals("large blob b1");
    expect(b2.queryFilePropertyBlob({ namespace: "Test", name: "LargeBlobWithStrData", id: "0xaabbcc", subId: "0xccddee" })).deep.equals(kB1LargeBlob);
    expect(b2.queryFilePropertyString({ namespace: "Test", name: "SmallBlobWithStrData" })).equals("small blob b1");
    expect(b2.queryFilePropertyBlob({ namespace: "Test", name: "SmallBlobWithStrData" })).deep.equals(kB1SmallBlob);
    expect(b2.queryFilePropertyString({ namespace: "Test", name: "LargeBlob" })).equals("");
    expect(b2.queryFilePropertyBlob({ namespace: "Test", name: "LargeBlob" })).deep.equals(kB1LargeBlob);
    expect(b2.queryFilePropertyString({ namespace: "Test", name: "SmallBlob" })).equals("");
    expect(b2.queryFilePropertyBlob({ namespace: "Test", name: "SmallBlob" })).deep.equals(kB1SmallBlob);
    expect(b2.queryFilePropertyString({ namespace: "Test", name: "StrDataOnly" })).equals(kB1StrData);
    expect(b2.queryFilePropertyString({ namespace: "Test", name: "b1" })).equals(kB1StrDataPrivate);
    expect(b2.queryFilePropertyString({ namespace: "Test", name: "ShouldBeDeleted" })).equals(kB1StrData);

    b2.saveFileProperty({ namespace: "Test", name: "LargeBlobWithStrData", id: "0xaabbcc", subId: "0xccddee" }, "large blob b2", kB2LargeBlob);
    b2.saveFileProperty({ namespace: "Test", name: "SmallBlobWithStrData" }, "small blob b2", kB2SmallBlob);
    b2.saveFileProperty({ namespace: "Test", name: "LargeBlob" }, undefined, kB2LargeBlob);
    b2.saveFileProperty({ namespace: "Test", name: "SmallBlob" }, undefined, kB2SmallBlob);
    b2.saveFileProperty({ namespace: "Test", name: "StrDataOnly" }, kB2StrData);
    b2.saveFileProperty({ namespace: "Test", name: "b2" }, kB2StrDataPrivate);
    b2.deleteFileProperty({ namespace: "Test", name: "ShouldBeDeleted" });
    b2.saveChanges();

    expect(b2.queryFilePropertyString({ namespace: "Test", name: "LargeBlobWithStrData", id: "0xaabbcc", subId: "0xccddee" })).equals("large blob b2");
    expect(b2.queryFilePropertyBlob({ namespace: "Test", name: "LargeBlobWithStrData", id: "0xaabbcc", subId: "0xccddee" })).deep.equals(kB2LargeBlob);
    expect(b2.queryFilePropertyString({ namespace: "Test", name: "SmallBlobWithStrData" })).equals("small blob b2");
    expect(b2.queryFilePropertyBlob({ namespace: "Test", name: "SmallBlobWithStrData" })).deep.equals(kB2SmallBlob);
    expect(b2.queryFilePropertyString({ namespace: "Test", name: "LargeBlob" })).equals("");
    expect(b2.queryFilePropertyBlob({ namespace: "Test", name: "LargeBlob" })).deep.equals(kB2LargeBlob);
    expect(b2.queryFilePropertyString({ namespace: "Test", name: "SmallBlob" })).equals("");
    expect(b2.queryFilePropertyBlob({ namespace: "Test", name: "SmallBlob" })).deep.equals(kB2SmallBlob);
    expect(b2.queryFilePropertyString({ namespace: "Test", name: "StrDataOnly" })).equals(kB2StrData);
    expect(b2.queryFilePropertyString({ namespace: "Test", name: "b2" })).equals(kB2StrDataPrivate);
    expect(b2.queryFilePropertyString({ namespace: "Test", name: "b1" })).equals(kB1StrDataPrivate);
    expect(b2.queryFilePropertyString({ namespace: "Test", name: "ShouldBeDeleted" })).is.undefined;

    await b3.pullChanges();
    b3.saveFileProperty({ namespace: "Test", name: "LargeBlobWithStrData", id: "0xaabbcc", subId: "0xccddee" }, "large blob b3", kB3LargeBlob);
    b3.saveFileProperty({ namespace: "Test", name: "SmallBlobWithStrData" }, "small blob b3", kB3SmallBlob);
    b3.saveFileProperty({ namespace: "Test", name: "LargeBlob" }, undefined, kB3LargeBlob);
    b3.saveFileProperty({ namespace: "Test", name: "SmallBlob" }, undefined, kB3SmallBlob);
    b3.saveFileProperty({ namespace: "Test", name: "StrDataOnly" }, kB3StrData);
    b3.saveFileProperty({ namespace: "Test", name: "b3" }, kB3StrDataPrivate);
    b3.saveFileProperty({ namespace: "Test", name: "ShouldBeDeleted" }, "update this property");
    b3.saveChanges();

    await b2.pushChanges({ description: "" });
    await b3.pullChanges();
    const fileConflictHandler = b3.findConflictHandler(FilePropertyConflictHandler)!;
    const conflicts = fileConflictHandler?.conflicts;
    expect(conflicts.length).eq(6);

    expect(conflicts[0].cause).eq(DbConflictCause.Data);
    expect(conflicts[0].changeset.index).equals(3);
    expect(conflicts[0].key).deep.equals({ namespace: "Test", name: "LargeBlobWithStrData", id: "0xaabbcc", subId: "0xccddee" });
    expect(conflicts[0].newVal).deep.equals({ strValue: "large blob b2", blobVal: kB2LargeBlob });
    expect(conflicts[0].oldVal).deep.equals({ strValue: "large blob b1", blobVal: kB1LargeBlob });
    expect(conflicts[0].localVal).deep.equals({ strValue: "large blob b3", blobVal: kB3LargeBlob });
    expect(conflicts[0].opCode).eq(DbOpcode.Update);
    expect(conflicts[0].resolution).eq(DbConflictResolution.Skip);

    expect(conflicts[1].cause).eq(DbConflictCause.Data);
    expect(conflicts[1].changeset.index).equals(3);
    expect(conflicts[1].key).deep.equals({ namespace: "Test", name: "LargeBlob", id: undefined, subId: undefined });
    expect(conflicts[1].newVal).deep.equals({ strValue: undefined, blobVal: kB2LargeBlob });
    expect(conflicts[1].oldVal).deep.equals({ strValue: undefined, blobVal: kB1LargeBlob });
    expect(conflicts[1].localVal).deep.equals({ strValue: undefined, blobVal: kB3LargeBlob });
    expect(conflicts[1].opCode).eq(DbOpcode.Update);
    expect(conflicts[1].resolution).eq(DbConflictResolution.Skip);

    expect(conflicts[2].cause).eq(DbConflictCause.Data);
    expect(conflicts[2].changeset.index).equals(3);
    expect(conflicts[2].key).deep.equals({ namespace: "Test", name: "SmallBlob", id: undefined, subId: undefined });
    expect(conflicts[2].newVal).deep.equals({ strValue: undefined, blobVal: kB2SmallBlob });
    expect(conflicts[2].oldVal).deep.equals({ strValue: undefined, blobVal: kB1SmallBlob });
    expect(conflicts[2].localVal).deep.equals({ strValue: undefined, blobVal: kB3SmallBlob });
    expect(conflicts[2].opCode).eq(DbOpcode.Update);
    expect(conflicts[2].resolution).eq(DbConflictResolution.Skip);

    expect(conflicts[3].cause).eq(DbConflictCause.Data);
    expect(conflicts[3].changeset.index).equals(3);
    expect(conflicts[3].key).deep.equals({ namespace: "Test", name: "SmallBlobWithStrData", id: undefined, subId: undefined });
    expect(conflicts[3].newVal).deep.equals({ strValue: "small blob b2", blobVal: kB2SmallBlob });
    expect(conflicts[3].oldVal).deep.equals({ strValue: "small blob b1", blobVal: kB1SmallBlob });
    expect(conflicts[3].localVal).deep.equals({ strValue: "small blob b3", blobVal: kB3SmallBlob });
    expect(conflicts[3].opCode).eq(DbOpcode.Update);
    expect(conflicts[3].resolution).eq(DbConflictResolution.Skip);

    expect(conflicts[4].cause).eq(DbConflictCause.Data);
    expect(conflicts[4].changeset.index).equals(3);
    expect(conflicts[4].key).deep.equals({ namespace: "Test", name: "ShouldBeDeleted", id: undefined, subId: undefined });
    expect(conflicts[4].newVal).deep.equals({ strValue: undefined, blobVal: undefined });
    expect(conflicts[4].oldVal).deep.equals({ strValue: "Test data form briefcase 1", blobVal: undefined });
    expect(conflicts[4].localVal).deep.equals({ strValue: "update this property", blobVal: undefined });
    expect(conflicts[4].opCode).eq(DbOpcode.Delete);
    expect(conflicts[4].resolution).eq(DbConflictResolution.Skip);

    expect(conflicts[5].cause).eq(DbConflictCause.Data);
    expect(conflicts[5].changeset.index).equals(3);
    expect(conflicts[5].key).deep.equals({ namespace: "Test", name: "StrDataOnly", id: undefined, subId: undefined });
    expect(conflicts[5].newVal).deep.equals({ strValue: "Test data form briefcase 2", blobVal: undefined });
    expect(conflicts[5].oldVal).deep.equals({ strValue: "Test data form briefcase 1", blobVal: undefined });
    expect(conflicts[5].localVal).deep.equals({ strValue: "Test data form briefcase 3", blobVal: undefined });
    expect(conflicts[5].opCode).eq(DbOpcode.Update);
    expect(conflicts[5].resolution).eq(DbConflictResolution.Skip);
    // await b3.pushChanges({ description: "hello" });

    // all the incoming change took precedence application can override and still set them back to local value.
    // conflicts.forEach((conflict) => {
    //   b3.saveFileProperty(conflict.key, conflict.newVal?.strValue, conflict.localVal?.blobVal);
    // });
    b3.saveChanges();

    await b3.pushChanges({ description: "hello" });
    await b2.pullChanges();
    await b1.pullChanges();

    b2.clearCaches();
    b2.saveChanges();
    b3.saveChanges();

    expect(b3.queryFilePropertyString({ namespace: "Test", name: "LargeBlobWithStrData", id: "0xaabbcc", subId: "0xccddee" })).equals("large blob b3");
    expect(b3.queryFilePropertyBlob({ namespace: "Test", name: "LargeBlobWithStrData", id: "0xaabbcc", subId: "0xccddee" })).deep.equals(kB3LargeBlob);
    expect(b3.queryFilePropertyString({ namespace: "Test", name: "SmallBlobWithStrData" })).equals("small blob b3");
    expect(b3.queryFilePropertyBlob({ namespace: "Test", name: "SmallBlobWithStrData" })).deep.equals(kB3SmallBlob);
    expect(b3.queryFilePropertyString({ namespace: "Test", name: "LargeBlob" })).equals("");
    expect(b3.queryFilePropertyBlob({ namespace: "Test", name: "LargeBlob" })).deep.equals(kB3LargeBlob);
    expect(b3.queryFilePropertyString({ namespace: "Test", name: "SmallBlob" })).equals("");
    expect(b3.queryFilePropertyBlob({ namespace: "Test", name: "SmallBlob" })).deep.equals(kB3SmallBlob);
    expect(b3.queryFilePropertyString({ namespace: "Test", name: "StrDataOnly" })).equals(kB3StrData);
    expect(b3.queryFilePropertyString({ namespace: "Test", name: "b3" })).equals(kB3StrDataPrivate);
    expect(b3.queryFilePropertyString({ namespace: "Test", name: "b2" })).equals(kB2StrDataPrivate);
    expect(b3.queryFilePropertyString({ namespace: "Test", name: "b1" })).equals(kB1StrDataPrivate);
    expect(b3.queryFilePropertyString({ namespace: "Test", name: "ShouldBeDeleted" })).equals("update this property");

    expect(b2.queryFilePropertyString({ namespace: "Test", name: "LargeBlobWithStrData", id: "0xaabbcc", subId: "0xccddee" })).equals("large blob b3");
    expect(b2.queryFilePropertyBlob({ namespace: "Test", name: "LargeBlobWithStrData", id: "0xaabbcc", subId: "0xccddee" })).deep.equals(kB3LargeBlob);
    expect(b2.queryFilePropertyString({ namespace: "Test", name: "SmallBlobWithStrData" })).equals("small blob b3");
    expect(b2.queryFilePropertyBlob({ namespace: "Test", name: "SmallBlobWithStrData" })).deep.equals(kB3SmallBlob);
    expect(b2.queryFilePropertyString({ namespace: "Test", name: "LargeBlob" })).equals("");
    expect(b2.queryFilePropertyBlob({ namespace: "Test", name: "LargeBlob" })).deep.equals(kB3LargeBlob);
    expect(b2.queryFilePropertyString({ namespace: "Test", name: "SmallBlob" })).equals("");
    expect(b2.queryFilePropertyBlob({ namespace: "Test", name: "SmallBlob" })).deep.equals(kB3SmallBlob);
    expect(b2.queryFilePropertyString({ namespace: "Test", name: "StrDataOnly" })).equals(kB3StrData);
    expect(b2.queryFilePropertyString({ namespace: "Test", name: "b3" })).equals(kB3StrDataPrivate);
    expect(b2.queryFilePropertyString({ namespace: "Test", name: "b2" })).equals(kB2StrDataPrivate);
    expect(b2.queryFilePropertyString({ namespace: "Test", name: "b1" })).equals(kB1StrDataPrivate);
    expect(b2.queryFilePropertyString({ namespace: "Test", name: "ShouldBeDeleted" })).equals("update this property");

    expect(b1.queryFilePropertyString({ namespace: "Test", name: "LargeBlobWithStrData", id: "0xaabbcc", subId: "0xccddee" })).equals("large blob b3");
    expect(b1.queryFilePropertyBlob({ namespace: "Test", name: "LargeBlobWithStrData", id: "0xaabbcc", subId: "0xccddee" })).deep.equals(kB3LargeBlob);
    expect(b1.queryFilePropertyString({ namespace: "Test", name: "SmallBlobWithStrData" })).equals("small blob b3");
    expect(b1.queryFilePropertyBlob({ namespace: "Test", name: "SmallBlobWithStrData" })).deep.equals(kB3SmallBlob);
    expect(b1.queryFilePropertyString({ namespace: "Test", name: "LargeBlob" })).equals("");
    expect(b1.queryFilePropertyBlob({ namespace: "Test", name: "LargeBlob" })).deep.equals(kB3LargeBlob);
    expect(b1.queryFilePropertyString({ namespace: "Test", name: "SmallBlob" })).equals("");
    expect(b1.queryFilePropertyBlob({ namespace: "Test", name: "SmallBlob" })).deep.equals(kB3SmallBlob);
    expect(b1.queryFilePropertyString({ namespace: "Test", name: "StrDataOnly" })).equals(kB3StrData);
    expect(b1.queryFilePropertyString({ namespace: "Test", name: "b3" })).equals(kB3StrDataPrivate);
    expect(b1.queryFilePropertyString({ namespace: "Test", name: "b2" })).equals(kB2StrDataPrivate);
    expect(b1.queryFilePropertyString({ namespace: "Test", name: "b1" })).equals(kB1StrDataPrivate);
    expect(b1.queryFilePropertyString({ namespace: "Test", name: "ShouldBeDeleted" })).equals("update this property");
  });

  it("DbConflictCause.Data - ChangesetConflictArgs vs SqliteChangeSetReader API", async () => {
    insertPhysicalObject(b1);
    const prop: FilePropertyProps = { namespace: "test", name: "test", id: 0xfffffff, subId: 0x1234 };
    b1.saveFileProperty(prop, "test");
    b1.saveChanges();
    await b1.pushChanges({ accessToken: accessToken1, description: "" });

    await b1.pullChanges();
    await b2.pullChanges();

    b1.saveFileProperty(prop, "test1");
    b2.saveFileProperty(prop, "test2");

    b1.saveChanges();
    b2.saveChanges();

    await spyChangesetConflictHandler(
      b1,
      async () => b1.pushChanges({ accessToken: accessToken1, description: "" }),
      (spy) => expect(spy.callCount).eq(0, "changeset conflict handler should not be called"),
    );

    await fakeChangesetConflictHandler(
      b2,
      async () => b2.pushChanges({ accessToken: accessToken1, description: "" }),
      (arg: ChangesetConflictArgs) => {

        // *** SqliteChangeReader API test ***
        const reader = SqliteChangesetReader.openFile({ fileName: arg.changesetFile!, db: b2 });
        expect(reader.step()).is.true;
        expect(reader.tableName).equals("be_Prop");
        expect(reader.getPrimaryKeyColumnNames()).deep.equals(["Namespace", "Name", "Id", "SubId"]);
        expect(reader.primaryKeyValues).deep.equals(["test", "test", "0xfffffff", "0x1234"]);
        expect(reader.getChangeValue(0, "Old")).equals("test");
        expect(reader.getChangeValue(1, "Old")).equals("test");
        expect(reader.getChangeValue(2, "Old")).equals("0xfffffff");
        expect(reader.getChangeValue(3, "Old")).equals("0x1234");
        expect(reader.getChangeValue(4, "Old")).is.undefined;
        expect(reader.getChangeValue(5, "Old")).equals("test");
        expect(reader.getChangeValue(6, "Old")).is.undefined;
        expect(reader.getChangeValue(7, "Old")).is.undefined;

        expect(reader.getChangeValue(0, "New")).is.undefined;
        expect(reader.getChangeValue(1, "New")).is.undefined;
        expect(reader.getChangeValue(2, "New")).is.undefined;
        expect(reader.getChangeValue(3, "New")).is.undefined;
        expect(reader.getChangeValue(4, "New")).is.undefined;
        expect(reader.getChangeValue(5, "New")).equals("test1");
        expect(reader.getChangeValue(6, "New")).is.undefined;
        expect(reader.getChangeValue(7, "New")).is.undefined;

        expect(reader.getChangeValueType(0, "Old")).equals(DbValueType.TextVal);
        expect(reader.getChangeValueType(1, "Old")).equals(DbValueType.TextVal);
        expect(reader.getChangeValueType(2, "Old")).equals(DbValueType.IntegerVal);
        expect(reader.getChangeValueType(3, "Old")).equals(DbValueType.IntegerVal);
        expect(reader.getChangeValueType(4, "Old")).is.undefined;
        expect(reader.getChangeValueType(5, "Old")).equals(DbValueType.TextVal);
        expect(reader.getChangeValueType(6, "Old")).is.undefined;
        expect(reader.getChangeValueType(7, "Old")).is.undefined;

        expect(reader.getChangeValueType(0, "New")).is.undefined;
        expect(reader.getChangeValueType(1, "New")).is.undefined;
        expect(reader.getChangeValueType(2, "New")).is.undefined;
        expect(reader.getChangeValueType(3, "New")).is.undefined;
        expect(reader.getChangeValueType(4, "New")).is.undefined;
        expect(reader.getChangeValueType(5, "New")).equals(DbValueType.TextVal);
        expect(reader.getChangeValueType(6, "New")).is.undefined;
        expect(reader.getChangeValueType(7, "New")).is.undefined;

        expect(reader.getChangeValueBinary(0, "Old")).deep.equals(new Uint8Array([116, 101, 115, 116]));
        expect(reader.getChangeValueDouble(0, "Old")).equals(0);
        expect(reader.getChangeValueId(0, "Old")).equals("0");
        expect(reader.getChangeValueInteger(0, "Old")).equals(0);
        expect(reader.getChangeValueText(0, "Old")).equals("test");

        expect(reader.getChangeValueBinary(0, "New")).is.undefined;
        expect(reader.getChangeValueDouble(0, "New")).is.undefined;
        expect(reader.getChangeValueId(0, "New")).is.undefined;
        expect(reader.getChangeValueInteger(0, "New")).is.undefined;
        expect(reader.getChangeValueText(0, "New")).is.undefined;

        // *** ChangesetConflictArgs API test ***
        expect(arg.tableName).eq("be_Prop");
        expect(arg.cause).eq(DbConflictCause.Data);
        expect(arg.opcode).eq(DbOpcode.Update);
        expect(arg.indirect).false;
        expect(arg.getPrimaryKeyColumns()).deep.equals([0, 1, 2, 3]);
        expect(arg.columnCount).equals(8);

        // 0 - Namespace (primary key)
        expect(arg.getValueText(0, DbChangeStage.New)).is.undefined;
        expect(arg.getValueText(0, DbChangeStage.Old)).equal("test");
        expect(arg.getValueType(0, DbChangeStage.New)).is.undefined;
        expect(arg.getValueType(0, DbChangeStage.Old)).is.equals(DbValueType.TextVal);
        expect(arg.isValueNull(0, DbChangeStage.New)).is.undefined;
        expect(arg.isValueNull(0, DbChangeStage.Old)).is.false;

        // 1 - Name (primary key)
        expect(arg.getValueText(1, DbChangeStage.New)).is.undefined;
        expect(arg.getValueText(1, DbChangeStage.Old)).equal("test");
        expect(arg.getValueType(1, DbChangeStage.New)).is.undefined;
        expect(arg.getValueType(1, DbChangeStage.Old)).is.equals(DbValueType.TextVal);
        expect(arg.isValueNull(1, DbChangeStage.New)).is.undefined;
        expect(arg.isValueNull(1, DbChangeStage.Old)).is.false;

        // 2 - Id (primary key)
        expect(arg.getValueBinary(2, DbChangeStage.Old)).deep.equal(new Uint8Array([50, 54, 56, 52, 51, 53, 52, 53, 53]));
        expect(arg.getValueId(2, DbChangeStage.New)).is.undefined;
        expect(arg.getValueId(2, DbChangeStage.Old)).equal("0xfffffff");
        expect(arg.getValueInteger(2, DbChangeStage.New)).is.undefined;
        expect(arg.getValueInteger(2, DbChangeStage.Old)).equal(268435455);
        expect(arg.getValueText(2, DbChangeStage.New)).is.undefined;
        expect(arg.getValueText(2, DbChangeStage.Old)).equal("268435455");
        expect(arg.getValueType(2, DbChangeStage.New)).is.undefined;
        expect(arg.getValueType(2, DbChangeStage.Old)).is.equals(DbValueType.IntegerVal);
        expect(arg.isValueNull(2, DbChangeStage.New)).is.undefined;
        expect(arg.isValueNull(2, DbChangeStage.Old)).is.false;

        // 3 - SubId (primary key)
        expect(arg.getValueBinary(3, DbChangeStage.Old)).deep.equal(new Uint8Array([52, 54, 54, 48]));
        expect(arg.getValueId(3, DbChangeStage.New)).is.undefined;
        expect(arg.getValueId(3, DbChangeStage.Old)).equal("0x1234");
        expect(arg.getValueInteger(3, DbChangeStage.New)).is.undefined;
        expect(arg.getValueInteger(3, DbChangeStage.Old)).equal(4660);
        expect(arg.getValueText(3, DbChangeStage.New)).is.undefined;
        expect(arg.getValueText(3, DbChangeStage.Old)).equal("4660");
        expect(arg.getValueType(3, DbChangeStage.New)).is.undefined;
        expect(arg.getValueType(3, DbChangeStage.Old)).is.equals(DbValueType.IntegerVal);
        expect(arg.isValueNull(3, DbChangeStage.New)).is.undefined;
        expect(arg.isValueNull(3, DbChangeStage.Old)).is.false;

        // 4 - TxnMode
        expect(arg.getValueBinary(4, DbChangeStage.Old)).undefined;
        expect(arg.getValueId(4, DbChangeStage.New)).is.undefined;
        expect(arg.getValueId(4, DbChangeStage.Old)).is.undefined;
        expect(arg.getValueInteger(4, DbChangeStage.New)).is.undefined;
        expect(arg.getValueInteger(4, DbChangeStage.Old)).is.undefined;
        expect(arg.getValueText(4, DbChangeStage.New)).is.undefined;
        expect(arg.getValueText(4, DbChangeStage.Old)).is.undefined;
        expect(arg.getValueType(4, DbChangeStage.New)).is.undefined;
        expect(arg.getValueType(4, DbChangeStage.Old)).is.undefined;
        expect(arg.isValueNull(4, DbChangeStage.New)).is.undefined;
        expect(arg.isValueNull(4, DbChangeStage.Old)).is.undefined;

        // 5 - StrData
        expect(arg.getValueBinary(5, DbChangeStage.Old)).deep.equals(new Uint8Array([116, 101, 115, 116]));
        expect(arg.getValueBinary(5, DbChangeStage.New)).deep.equals(new Uint8Array([116, 101, 115, 116, 49]));
        expect(arg.getValueId(5, DbChangeStage.New)).is.equals("0");
        expect(arg.getValueId(5, DbChangeStage.Old)).is.equals("0");
        expect(arg.getValueText(5, DbChangeStage.New)).is.equals("test1");
        expect(arg.getValueText(5, DbChangeStage.Old)).is.equals("test");
        expect(arg.getValueType(5, DbChangeStage.New)).is.equals(DbValueType.TextVal);
        expect(arg.getValueType(5, DbChangeStage.Old)).is.equals(DbValueType.TextVal);
        expect(arg.isValueNull(5, DbChangeStage.New)).is.false;
        expect(arg.isValueNull(5, DbChangeStage.Old)).is.false;

        //  6 - RawSize
        expect(arg.getValueBinary(6, DbChangeStage.Old)).undefined;
        expect(arg.getValueId(6, DbChangeStage.New)).is.undefined;
        expect(arg.getValueId(6, DbChangeStage.Old)).is.undefined;
        expect(arg.getValueInteger(6, DbChangeStage.New)).is.undefined;
        expect(arg.getValueInteger(6, DbChangeStage.Old)).is.undefined;
        expect(arg.getValueText(6, DbChangeStage.New)).is.undefined;
        expect(arg.getValueText(6, DbChangeStage.Old)).is.undefined;
        expect(arg.getValueType(6, DbChangeStage.New)).is.undefined;
        expect(arg.getValueType(6, DbChangeStage.Old)).is.undefined;
        expect(arg.isValueNull(6, DbChangeStage.New)).is.undefined;
        expect(arg.isValueNull(6, DbChangeStage.Old)).is.undefined;

        // 7 - Data
        expect(arg.getValueBinary(7, DbChangeStage.Old)).undefined;
        expect(arg.getValueId(7, DbChangeStage.New)).is.undefined;
        expect(arg.getValueId(7, DbChangeStage.Old)).is.undefined;
        expect(arg.getValueInteger(7, DbChangeStage.New)).is.undefined;
        expect(arg.getValueInteger(7, DbChangeStage.Old)).is.undefined;
        expect(arg.getValueText(7, DbChangeStage.New)).is.undefined;
        expect(arg.getValueText(7, DbChangeStage.Old)).is.undefined;
        expect(arg.getValueType(7, DbChangeStage.New)).is.undefined;
        expect(arg.getValueType(7, DbChangeStage.Old)).is.undefined;
        expect(arg.isValueNull(7, DbChangeStage.New)).is.undefined;
        expect(arg.isValueNull(7, DbChangeStage.Old)).is.undefined;

        return DbConflictResolution.Replace;
      },
    );
  });

  it.only("DbConflictCause.Data - Project Extent Conflict", async () => {
    insertPhysicalObject(b1);
    b1.saveChanges();
    await b1.pushChanges({ accessToken: accessToken1, description: "" });
    await b1.pullChanges();
    await b2.pullChanges();
    await b3.pullChanges();

    const newExtentsByB1 = Range3d.create(Point3d.fromJSON([-40, -10, 20]), Point3d.fromJSON([40, 100, 200]));
    b1.updateProjectExtents(newExtentsByB1);
    setProjectExtentsSource(b1, "user");
    b1.saveChanges();
    await b1.pushChanges({ accessToken: accessToken1, description: "" });

    const newExtentsByB2 = Range3d.create(Point3d.fromJSON([-5, -75, -15]), Point3d.fromJSON([20, 75, 75]));
    b2.updateProjectExtents(newExtentsByB2);
    setProjectExtentsSource(b2, "user");
    b2.saveChanges();

    await b2.pullChanges({ accessToken: accessToken1 });

    // '{"low":[-40,-75,-15],"high":[40,100,200]}'
    const expectedProjectExtents = newExtentsByB1.union(newExtentsByB2);
    assert.isTrue(b2.projectExtents.isAlmostEqual(expectedProjectExtents));
    b2.saveChanges();
    await b2.pushChanges({ accessToken: accessToken1, description: "" });

    await b1.pullChanges();
    assert.isTrue(b1.projectExtents.isAlmostEqual(expectedProjectExtents));

    await b2.pullChanges();
    assert.isTrue(b2.projectExtents.isAlmostEqual(expectedProjectExtents));

    await b3.pullChanges();
    assert.isTrue(b3.projectExtents.isAlmostEqual(expectedProjectExtents));

    // attempt to set project source extents to computed
    const newExtentsByB3 = Range3d.create(Point3d.fromJSON([-10, -10, -10]), Point3d.fromJSON([10, 10, 10]));
    b3.updateProjectExtents(newExtentsByB3);
    setProjectExtentsSource(b1, "computed");
    b3.saveChanges();
  });
});

