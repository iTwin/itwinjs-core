/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DbConflictResolution, Guid } from "@itwin/core-bentley";
import {
  IModel,
  SubCategoryAppearance
} from "@itwin/core-common";
import chai from "chai";
import { assert } from "chai";
import chaiAsPromised from "chai-as-promised";
import { HubWrappers, KnownTestLocations } from "../index.js";
import {
  BriefcaseDb,
  ChannelControl,
  DictionaryModel,
  IModelHost,
  SpatialCategory,
  SqliteChangesetReader
} from "../../core-backend.js";
import { HubMock } from "../../HubMock.js";
import { RebaseChangesetConflictArgs, TxnArgs } from "../../internal/ChangesetConflictArgs.js";
import { IModelTestUtils, TestUserType } from "../IModelTestUtils.js";
chai.use(chaiAsPromised);
import * as sinon from "sinon";

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


async function updatePhysicalObject(b: BriefcaseDb, el1: string, federationGuid: string) {
  await b.locks.acquireLocks({ exclusive: el1 });
  const props = b.elements.getElement(el1);
  props.federationGuid = federationGuid;
  b.elements.updateElement(props.toJSON());
}

describe("Change merge method", () => {
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
    openB1: async (noLock?: true) => { return ctx.openBriefcase("user1", noLock); },
    openB2: async (noLock?: true) => { return ctx.openBriefcase("user2", noLock); },
    openB3: async (noLock?: true) => { return ctx.openBriefcase("user3", noLock); },
  }

  async function insertPhysicalObject(b: BriefcaseDb,) {
    await b.locks.acquireLocks({ shared: ctx.modelId });
    return b.elements.insertElement(IModelTestUtils.createPhysicalObject(b, ctx.modelId, ctx.spatialCategoryId).toJSON());
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

  it("rebase events (noFastForward:true)", async () => {
    /**
     * Fastforward will not trigger rebase events as rebase was not required to merge changes.
     * In this test we will test rebase events when noFastForward is set to true. Which mean rebase is required to merge changes.
     */
    const events = new Map<number, { args: TxnArgs, event: "onRebaseTxnBegin" | "onRebaseTxnEnd" }[]>();

    const b1 = await ctx.openB1();
    events.set(b1.briefcaseId, []);
    b1.txns.onRebaseTxnBegin.addListener((args) => {

      events.get(b1.briefcaseId)?.push({ args, event: "onRebaseTxnBegin" });
    });
    b1.txns.onRebaseTxnEnd.addListener((args) => {
      events.get(b1.briefcaseId)?.push({ args, event: "onRebaseTxnEnd" });
    });

    const b2 = await ctx.openB2();
    events.set(b2.briefcaseId, []);
    b2.txns.onRebaseTxnBegin.addListener((args) => {
      events.get(b2.briefcaseId)?.push({ args, event: "onRebaseTxnBegin" });
    });
    b2.txns.onRebaseTxnEnd.addListener((args) => {
      events.get(b2.briefcaseId)?.push({ args, event: "onRebaseTxnEnd" });
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
    // fast-forward
    await b2.pushChanges({ description: `inserted physical object [id=${e3},${e4}]`, noFastForward: true });
    assert.equal(events.get(b2.briefcaseId)?.length, 4);
    assert.equal(events.get(b2.briefcaseId)?.[0].event, "onRebaseTxnBegin");
    assert.equal(events.get(b2.briefcaseId)?.[0].args.id, "0x100000000");
    assert.equal(events.get(b2.briefcaseId)?.[0].args.descr, "inserted physical object [id=0x40000000001]");
    assert.equal(events.get(b2.briefcaseId)?.[0].args.type, "Data");

    assert.equal(events.get(b2.briefcaseId)?.[3].event, "onRebaseTxnEnd");
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

    assert.equal(events.get(b1.briefcaseId)?.[3].event, "onRebaseTxnEnd");
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
    await b2.pushChanges({ description: `update physical object [id=${e1},${e2},${e5}]`, noFastForward: true });
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

    b1.close();
    b2.close();
  });
  it("rebase events (noFastForward:false/default)", async () => {
    /**
     * Fastforward will not trigger rebase events as rebase was not required to merge changes.
     * In this test we will test rebase events when noFastForward is set to false. Which mean rebase is not required to merge changes.
     */
    const events = new Map<number, { args: TxnArgs, event: "onRebaseTxnBegin" | "onRebaseTxnEnd" }[]>();

    const b1 = await ctx.openB1();
    events.set(b1.briefcaseId, []);
    b1.txns.onRebaseTxnBegin.addListener((args) => {

      events.get(b1.briefcaseId)?.push({ args, event: "onRebaseTxnBegin" });
    });
    b1.txns.onRebaseTxnEnd.addListener((args) => {
      events.get(b1.briefcaseId)?.push({ args, event: "onRebaseTxnEnd" });
    });

    const b2 = await ctx.openB2();
    events.set(b2.briefcaseId, []);
    b2.txns.onRebaseTxnBegin.addListener((args) => {
      events.get(b2.briefcaseId)?.push({ args, event: "onRebaseTxnBegin" });
    });
    b2.txns.onRebaseTxnEnd.addListener((args) => {
      events.get(b2.briefcaseId)?.push({ args, event: "onRebaseTxnEnd" });
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
    // fast-forward
    await b2.pushChanges({ description: `inserted physical object [id=${e3},${e4}]` });
    assert.equal(events.get(b2.briefcaseId)?.length, 0);

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
    assert.equal(events.get(b1.briefcaseId)?.length, 0);

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

    b1.close();
    b2.close();
  });
  it("rebase with be_props (insert conflict)", async () => {
    const b1 = await ctx.openB1();
    const b2 = await ctx.openB2();

    b1.saveFileProperty({ namespace: "test", name: "test" }, "test1");
    b1.saveChanges("test");
    await b1.pushChanges({ description: "test" });

    b2.saveFileProperty({ namespace: "test", name: "test" }, "test2");
    b2.saveChanges("test2");

    await assertThrowsAsync(
      async () => b2.pushChanges({ description: "test2" }),
      "PRIMARY KEY insert conflict. Aborting rebase.");

    assert.equal(b2.queryFilePropertyString({ namespace: "test", name: "test" }), "test1");

    b2.saveFileProperty({ namespace: "test", name: "test" }, "test3");

    chai.expect(() => b2.saveChanges("test1")).throws("Could not save changes (test1)");
    b2.abandonChanges();

    // set handler to resolve conflict
    b2.txns.changeMergeManager.addConflictHandler({
      id: "my", handler: (args: RebaseChangesetConflictArgs) => {
        if (args.cause === "Conflict") {
          if (args.tableName === "be_Prop") {
            if (args.opcode === "Inserted") {
              chai.expect(args.getColumnNames()).to.be.deep.equal(["Namespace", "Name", "Id", "SubId", "TxnMode", "StrData", "RawSize", "Data"]);
              chai.expect(args.txn.id).to.be.equal("0x100000000");
              chai.expect(args.txn.descr).to.be.equal("test2");
              chai.expect(args.txn.type).to.be.equal("Data");
              const localChangedVal = args.getValueText(5, "New");
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

    // use changeset api to read txn directly
    const reader = SqliteChangesetReader.openTxn({ db: b2, txnId: "0x100000000" });
    chai.expect(reader.step()).to.be.true;
    chai.expect(reader.tableName).to.be.equal("be_Prop");
    chai.expect(reader.getColumnNames(reader.tableName)[5]).to.be.equal("StrData");
    // note the operation changed from insert to update
    chai.expect(reader.op).to.be.equal("Updated");
    // note this old value is from master branch after changeset was recomputed
    chai.expect(reader.getChangeValueText(5, "Old")).to.be.equal("test1");
    // note this new value is from local branch after merger.
    chai.expect(reader.getChangeValueText(5, "New")).to.be.equal("test1 + test2");
    reader.close();

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
    const b2 = await ctx.openB2();

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
        if (args.cause === "Data") {
          if (args.tableName === "be_Prop") {
            if (args.opcode === "Updated") {
              const localChangedVal = args.getValueText(5, "New");
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

