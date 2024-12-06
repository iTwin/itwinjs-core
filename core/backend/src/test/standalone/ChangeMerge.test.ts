/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DbChangeStage, DbConflictCause, DbConflictResolution, DbOpcode, Guid, Id64String, Logger } from "@itwin/core-bentley";
import {
  ChangesetProps,
  ElementAspectProps, IModel,
  SubCategoryAppearance
} from "@itwin/core-common";
import * as chai from "chai";
import { assert } from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { HubWrappers, KnownTestLocations } from "..";
import {
  BriefcaseDb,
  ChannelControl,
  DictionaryModel,
  IModelHost,
  SpatialCategory,
  SqliteChangesetReader,
} from "../../core-backend";
import { HubMock } from "../../HubMock";
import { ChangesetConflictArgs, MergeChangesetConflictArgs, RebaseChangesetConflictArgs, TxnArgs } from "../../internal/ChangesetConflictArgs";
import { IModelTestUtils, TestUserType } from "../IModelTestUtils";
chai.use(chaiAsPromised);
import sinon = require("sinon"); // eslint-disable-line @typescript-eslint/no-require-imports

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

async function createNewModelAndCategory(rwIModel: BriefcaseDb, parent?: Id64String) {
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

async function updatePhysicalObject(b: BriefcaseDb, el1: string, federationGuid: string) {
  await b.locks.acquireLocks({ exclusive: el1 });
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

async function fakeChangesetConflictHandler(b: BriefcaseDb, cb: () => Promise<void>, interceptMethod: (arg: MergeChangesetConflictArgs) => DbConflictResolution | undefined) {
  const s1 = sinon.stub<ChangesetConflictArgs[], DbConflictResolution>(b as any, "onChangesetConflict" as any);
  s1.callsFake(interceptMethod);
  try {
    await cb();
  } finally {
    s1.restore();
  }
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

function dumpLocalChanges(b: BriefcaseDb) {
  Logger.logInfo(`changeset`, `Local changes for ${b.getBriefcaseId()}`);
  const reader = SqliteChangesetReader.openLocalChanges({ db: b });
  while (reader.step()) {
    const tablename = reader.tableName;
    const op = reader.op;
    const id = reader.getChangeValueId(0, reader.op === "Inserted" ? "New" : "Old");
    Logger.logInfo(`changeset`, `tablename=${tablename}, op=${op}, id=${id}`);
  }
}

describe.only("Change merge method", () => {
  const ctx = {
    accessTokens: {
      user1: "",
      user2: "",
      user3: "",
    },
    iModelId: "",
    iTwinId: "",
    modelId: "",
    spatialCategoryId: "",
    iModelName: "TestIModel",
    rootSubject: "TestSubject",
    openBriefcase: async (user: "user1" | "user2" | "user3", noLock?: true) => {
      const b = await HubWrappers.downloadAndOpenBriefcase({ accessToken: ctx.accessTokens[user], iTwinId: ctx.iTwinId, iModelId: ctx.iModelId, noLock });
      b.channels.addAllowedChannel(ChannelControl.sharedChannelName);
      return b;
    },
    openB1: (noLock?: true) => { return ctx.openBriefcase("user1", noLock); },
    openB2: (noLock?: true) => { return ctx.openBriefcase("user2", noLock); },
    openB3: (noLock?: true) => { return ctx.openBriefcase("user3", noLock); },
  }

  async function insertPhysicalObject(b: BriefcaseDb,) {
    await b.locks.acquireLocks({ shared: ctx.modelId });
    return b.elements.insertElement(IModelTestUtils.createPhysicalObject(b, ctx.modelId, ctx.spatialCategoryId).toJSON());
  }

  function dumpChangeset(b: BriefcaseDb, cs: ChangesetProps) {
    const changesetDir = HubMock.findLocalHub(ctx.iModelId).changesetDir;
    Logger.logInfo(`changeset`, `${cs.index} - ${cs.description}`);
    const reader = SqliteChangesetReader.openFile({ fileName: `${changesetDir}/changeset-${cs.index}`, db: b });
    while (reader.step()) {
      const tablename = reader.tableName;
      const op = reader.op;
      const id = reader.getChangeValueId(0, reader.op === "Inserted" ? "New" : "Old");
      Logger.logInfo(`changeset`, `tablename=${tablename}, op=${op}, id=${id}`);
    }
  }

  before(async () => {
    await IModelHost.startup();
    HubMock.startup("PullMergeMethod", KnownTestLocations.outputDir);
  });

  after(async () => {
    HubMock.shutdown()
    //await IModelHost.shutdown();
  });

  beforeEach(async () => {
    ctx.iTwinId = HubMock.iTwinId;
    ctx.accessTokens.user1 = await HubWrappers.getAccessToken(TestUserType.SuperManager);
    ctx.accessTokens.user2 = await HubWrappers.getAccessToken(TestUserType.Regular);
    ctx.accessTokens.user3 = await HubWrappers.getAccessToken(TestUserType.Super);
    ctx.iModelId = await HubMock.createNewIModel({ accessToken: ctx.accessTokens.user1, iTwinId: ctx.iTwinId, iModelName: ctx.iModelName, description: ctx.rootSubject });
    assert.isNotEmpty(ctx.iModelId);
    const b1 = await ctx.openB1();
    await b1.locks.acquireLocks({ shared: IModel.dictionaryId });
    [, ctx.modelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(
      b1,
      IModelTestUtils.getUniqueModelCode(b1, "newPhysicalModel"),
      true);
    const dictionary: DictionaryModel = b1.models.getModel<DictionaryModel>(IModel.dictionaryId);
    const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");
    ctx.spatialCategoryId = SpatialCategory.insert(
      dictionary.iModel,
      dictionary.id,
      newCategoryCode.value,
      new SubCategoryAppearance({ color: 0xff0000 }),
    );
    b1.saveChanges();
    await b1.pushChanges({ description: "" });
    b1.close();
  });

  afterEach(async () => {
    sinon.restore();
  });

  it("default pullmerge method is merge", async () => {

    const b1 = await ctx.openB1();
    b1.channels.addAllowedChannel(ChannelControl.sharedChannelName);

    await b1.pullChanges();

    // Default is merge
    assert.equal(b1.txns.changeMergeManager.getMergeMethod(), "Merge");

    // Imodel host default is merge
    assert.equal(IModelHost.pullMergeMethod, "Merge");
    b1.close();
  });

  it("change pullmerge method to rebase for a briefcase", async () => {
    const b1 = await ctx.openB1();

    // Change method for a briefcase
    b1.txns.changeMergeManager.setMergeMethod("Rebase");

    assert.equal(b1.txns.changeMergeManager.getMergeMethod(), "Rebase");

    // Imodel host default is merge
    assert.equal(IModelHost.pullMergeMethod, "Merge");
    b1.close();
  });

  it("change default pullmerge method on IModelHost config", async () => {
    if (IModelHost.configuration)
      IModelHost.configuration.pullMergeMethod = "Rebase";
    else {
      IModelHost.configuration = { pullMergeMethod: "Rebase" };
    }
    const b1 = await ctx.openB1();

    assert.equal(b1.txns.changeMergeManager.getMergeMethod(), "Rebase");

    // Imodel host default is merge
    assert.equal(IModelHost.pullMergeMethod, "Rebase");
    b1.close();

    if (IModelHost.configuration)
      IModelHost.configuration.pullMergeMethod = "Merge";
    else {
      IModelHost.configuration = { pullMergeMethod: "Merge" };
    }
  });

  it("rebase events", async () => {
    const events = new Map<number, { args: TxnArgs, event: "onRebaseTxnBegin" | "onRebaseLTxnEnd" }[]>();

    const b1 = await ctx.openB1();
    events.set(b1.briefcaseId, []);
    b1.txns.changeMergeManager.setMergeMethod("Rebase");
    b1.txns.onRebaseTxnBegin.addListener((args) => {

      events.get(b1.briefcaseId)?.push({ args, event: "onRebaseTxnBegin" });
    });
    b1.txns.onRebaseLTxnEnd.addListener((args) => {
      events.get(b1.briefcaseId)?.push({ args, event: "onRebaseLTxnEnd" });
    });

    const b2 = await ctx.openB2();
    events.set(b2.briefcaseId, []);
    b2.txns.changeMergeManager.setMergeMethod("Rebase");
    b2.txns.onRebaseTxnBegin.addListener((args) => {
      events.get(b2.briefcaseId)?.push({ args, event: "onRebaseTxnBegin" });
    });
    b2.txns.onRebaseLTxnEnd.addListener((args) => {
      events.get(b2.briefcaseId)?.push({ args, event: "onRebaseLTxnEnd" });
    });


    const e1 = await insertPhysicalObject(b1);
    b1.saveChanges(`inserted physical object [id=${e1}]`);
    events.set(b1.briefcaseId, []);
    await b1.pushChanges({ description: `inserted physical object [id=${e1}]` });
    assert.isDefined(b1.elements.getElement(e1));
    assert.equal(events.get(b1.briefcaseId)?.length, 0);

    const e2 = await insertPhysicalObject(b1);
    b1.saveChanges();
    events.set(b1.briefcaseId, []);
    await b1.pushChanges({ description: `inserted physical object [id=${e2}]` });
    assert.equal(events.get(b1.briefcaseId)?.length, 0);

    assert.isDefined(b1.elements.getElement(e2));

    const e3 = await insertPhysicalObject(b2);
    b2.saveChanges(`inserted physical object [id=${e3}]`);
    const e4 = await insertPhysicalObject(b2);
    b2.saveChanges(`inserted physical object [id=${e4}]`);

    events.set(b2.briefcaseId, []);
    await b2.pushChanges({ description: `inserted physical object [id=${e3},${e4}]` });
    assert.equal(events.get(b2.briefcaseId)?.length, 4);
    assert.equal(events.get(b2.briefcaseId)?.[0].event, "onRebaseTxnBegin");
    assert.equal(events.get(b2.briefcaseId)?.[0].args.id, "0x100000000");
    assert.equal(events.get(b2.briefcaseId)?.[0].args.descr, "inserted physical object [id=0x40000000001]");
    assert.equal(events.get(b2.briefcaseId)?.[0].args.type, "Data");

    assert.equal(events.get(b2.briefcaseId)?.[3].event, "onRebaseLTxnEnd");
    assert.equal(events.get(b2.briefcaseId)?.[3].args.id, "0x100000001");
    assert.equal(events.get(b2.briefcaseId)?.[3].args.descr, "inserted physical object [id=0x40000000002]");
    assert.equal(events.get(b2.briefcaseId)?.[3].args.type, "Data");


    assert.isDefined(b2.elements.getElement(e1));
    assert.isDefined(b2.elements.getElement(e2));
    assert.isDefined(b2.elements.getElement(e3));
    assert.isDefined(b2.elements.getElement(e4));

    const e5 = await insertPhysicalObject(b1);
    b1.saveChanges(`inserted physical object [id=${e5}]`);
    const e6 = await insertPhysicalObject(b1);
    b1.saveChanges(`inserted physical object [id=${e6}]`);
    events.set(b1.briefcaseId, []);
    await b1.pushChanges({ description: `inserted physical object [id=${e5}, ${e6}]` });
    assert.equal(events.get(b1.briefcaseId)?.length, 4);
    assert.equal(events.get(b1.briefcaseId)?.[0].event, "onRebaseTxnBegin");
    assert.equal(events.get(b1.briefcaseId)?.[0].args.id, "0x100000000");
    assert.equal(events.get(b1.briefcaseId)?.[0].args.descr, "inserted physical object [id=0x30000000003]");
    assert.equal(events.get(b1.briefcaseId)?.[0].args.type, "Data");

    assert.equal(events.get(b1.briefcaseId)?.[3].event, "onRebaseLTxnEnd");
    assert.equal(events.get(b1.briefcaseId)?.[3].args.id, "0x100000001");
    assert.equal(events.get(b1.briefcaseId)?.[3].args.descr, "inserted physical object [id=0x30000000004]");
    assert.equal(events.get(b1.briefcaseId)?.[3].args.type, "Data");


    assert.isDefined(b1.elements.getElement(e1));
    assert.isDefined(b1.elements.getElement(e2));
    assert.isDefined(b1.elements.getElement(e3)); // Not found
    assert.isDefined(b1.elements.getElement(e4));
    assert.isDefined(b1.elements.getElement(e5));
    assert.isDefined(b1.elements.getElement(e6));

    events.set(b2.briefcaseId, []);
    await b2.pullChanges();
    assert.equal(events.get(b2.briefcaseId)?.length, 0);
    assert.isDefined(b2.elements.getElement(e1));
    assert.isDefined(b2.elements.getElement(e2));
    assert.isDefined(b2.elements.getElement(e3));
    assert.isDefined(b2.elements.getElement(e4));
    assert.isDefined(b2.elements.getElement(e5));
    assert.isDefined(b2.elements.getElement(e6));

    await updatePhysicalObject(b1, e3, Guid.createValue());
    b1.saveChanges(`update physical object [id=${e3}]`);
    await updatePhysicalObject(b1, e4, Guid.createValue());
    b1.saveChanges(`update physical object [id=${e4}]`);
    events.set(b1.briefcaseId, []);
    await b1.pushChanges({ description: `update physical object [id=${e3},${e4}]` });
    assert.equal(events.get(b1.briefcaseId)?.length, 0);

    await updatePhysicalObject(b2, e1, Guid.createValue());
    b2.saveChanges(`update physical object [id=${e1}]`);
    await updatePhysicalObject(b2, e2, Guid.createValue());
    b2.saveChanges(`update physical object [id=${e2}]`);
    await updatePhysicalObject(b2, e5, Guid.createValue());
    b2.saveChanges(`update physical object [id=${e5}]`);
    await updatePhysicalObject(b2, e6, Guid.createValue());
    b2.saveChanges(`update physical object [id=${e6}]`);
    events.set(b2.briefcaseId, []);
    await b2.pushChanges({ description: `update physical object [id=${e1},${e2},${e5}]` });
    assert.equal(events.get(b2.briefcaseId)?.length, 8);
    assert.equal(events.get(b2.briefcaseId)?.[0].event, "onRebaseTxnBegin");
    assert.equal(events.get(b2.briefcaseId)?.[0].args.id, "0x100000000");
    assert.equal(events.get(b2.briefcaseId)?.[0].args.descr, "update physical object [id=0x30000000001]");
    assert.equal(events.get(b2.briefcaseId)?.[0].args.type, "Data");

    assert.equal(events.get(b2.briefcaseId)?.[2].event, "onRebaseTxnBegin");
    assert.equal(events.get(b2.briefcaseId)?.[2].args.id, "0x100000001");
    assert.equal(events.get(b2.briefcaseId)?.[2].args.descr, "update physical object [id=0x30000000002]");
    assert.equal(events.get(b2.briefcaseId)?.[2].args.type, "Data");

    assert.equal(events.get(b2.briefcaseId)?.[4].event, "onRebaseTxnBegin");
    assert.equal(events.get(b2.briefcaseId)?.[4].args.id, "0x100000002");
    assert.equal(events.get(b2.briefcaseId)?.[4].args.descr, "update physical object [id=0x30000000003]");
    assert.equal(events.get(b2.briefcaseId)?.[4].args.type, "Data");

    assert.equal(events.get(b2.briefcaseId)?.[6].event, "onRebaseTxnBegin");
    assert.equal(events.get(b2.briefcaseId)?.[6].args.id, "0x100000003");
    assert.equal(events.get(b2.briefcaseId)?.[6].args.descr, "update physical object [id=0x30000000004]");
    assert.equal(events.get(b2.briefcaseId)?.[6].args.type, "Data");

    assert.isDefined(b1.elements.getElement(e1).federationGuid);
    assert.isDefined(b1.elements.getElement(e2).federationGuid);
    assert.isDefined(b1.elements.getElement(e3).federationGuid);
    assert.isDefined(b1.elements.getElement(e4).federationGuid);
    assert.isDefined(b1.elements.getElement(e5).federationGuid);
    assert.isDefined(b1.elements.getElement(e6).federationGuid);

    assert.isDefined(b2.elements.getElement(e1).federationGuid);
    assert.isDefined(b2.elements.getElement(e2).federationGuid);
    assert.isDefined(b2.elements.getElement(e3).federationGuid);
    assert.isDefined(b2.elements.getElement(e4).federationGuid);
    assert.isDefined(b2.elements.getElement(e5).federationGuid);
    assert.isDefined(b2.elements.getElement(e6).federationGuid);

    assert.equal(b1.txns.changeMergeManager.getMergeMethod(), `Rebase`);
    assert.equal(b2.txns.changeMergeManager.getMergeMethod(), `Rebase`);

    b1.close();
    b2.close();
  });

  it("rebase with be_props (insert conflict) ", async () => {
    const b1 = await ctx.openB1();
    b1.txns.changeMergeManager.setMergeMethod("Rebase");

    const b2 = await ctx.openB2();
    b2.txns.changeMergeManager.setMergeMethod("Rebase");

    b1.saveFileProperty({ namespace: "test", name: "test" }, "test1");
    b1.saveChanges("test");
    await b1.pushChanges({ description: "test" });

    b2.saveFileProperty({ namespace: "test", name: "test" }, "test2");
    b2.saveChanges("test2");
    await assertThrowsAsync(
      async () => b2.pushChanges({ description: "test2" }),
      "PRIMARY KEY INSERT CONFLICT - rejecting this changeset");

    assert.equal(b2.queryFilePropertyString({ namespace: "test", name: "test" }), "test1");

    b2.saveFileProperty({ namespace: "test", name: "test" }, "test3");

    chai.expect(() => b2.saveChanges("test1")).throws("Could not save changes (test1)");
    b2.abandonChanges();

    // set handler to resolve conflict
    b2.txns.changeMergeManager.addConflictHandler({
      id: "my", handler: (args: RebaseChangesetConflictArgs) =>  {
        if (args.cause === DbConflictCause.Conflict) {
          if (args.tableName === "be_Prop") {
            if (args.opcode === DbOpcode.Insert) {
              const localChangedVal = args.getValueText(5, DbChangeStage.New);
              const tipValue = b2.queryFilePropertyString({ namespace: "test", name: "test" });
              b2.saveFileProperty({ namespace: "test", name: "test" }, `${tipValue} + ${localChangedVal}`);
              return DbConflictResolution.Skip; // skip incomming value and continue
            }
          }
        }
        return undefined;
      }
    });

    // resume rebase see if it resolve the conflict
    b2.txns.changeMergeManager.resume();
    assert.equal(b2.queryFilePropertyString({ namespace: "test", name: "test" }), "test1 + test2");

    await b2.pushChanges({ description: "test2" });
    await b1.pullChanges();
    assert.equal(b2.queryFilePropertyString({ namespace: "test", name: "test" }), "test1 + test2");
    assert.equal(b1.queryFilePropertyString({ namespace: "test", name: "test" }), "test1 + test2");

    b1.close();
    b2.close();
  });

  it("rebase with be_props (data conflict) ", async () => {
    const b1 = await ctx.openB1();
    b1.txns.changeMergeManager.setMergeMethod("Rebase");

    const b2 = await ctx.openB2();
    b2.txns.changeMergeManager.setMergeMethod("Rebase");

    b1.saveFileProperty({ namespace: "test", name: "test" }, "test1");
    b1.saveChanges("test");
    await b1.pushChanges({ description: "test" });

    await b2.pullChanges();
    b2.saveFileProperty({ namespace: "test", name: "test" }, "test2");
    b2.saveChanges("test2");

    b1.saveFileProperty({ namespace: "test", name: "test" }, "test3");
    b1.saveChanges("test");
    await b1.pushChanges({ description: "test" });

    // set handler to resolve conflict
    b2.txns.changeMergeManager.addConflictHandler({
      id: "my", handler: (args: RebaseChangesetConflictArgs) => {
        if (args.cause === DbConflictCause.Data) {
          if (args.tableName === "be_Prop") {
            if (args.opcode === DbOpcode.Update) {
              const localChangedVal = args.getValueText(5, DbChangeStage.New);
              const tipValue = b2.queryFilePropertyString({ namespace: "test", name: "test" });
              b2.saveFileProperty({ namespace: "test", name: "test" }, `${tipValue} + ${localChangedVal}`);
              return DbConflictResolution.Skip; // skip incomming value and continue
            }
          }
        }
        return undefined;
      }
    });

    await b2.pushChanges({ description: "test" });
    await b2.pullChanges();
    await b1.pullChanges();
    assert.equal(b2.queryFilePropertyString({ namespace: "test", name: "test" }), "test3 + test2");
    assert.equal(b1.queryFilePropertyString({ namespace: "test", name: "test" }), "test3 + test2");

    b1.close();
    b2.close();
  });
});

