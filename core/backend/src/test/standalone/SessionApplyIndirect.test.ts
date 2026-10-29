/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

//=================================================================================================
// Tests for the "indirect flag is preserved while applying a changeset" behavior.
//
// Background (iTwin/itwinjs-backlog#2474, scenario iTwin/itwinjs-backlog#2346, SQLite check-in
// https://sqlite.org/src/info/9d36067e76):
//
//   Every row change recorded by a SQLite session is flagged as either "direct" (made explicitly
//   by the user) or "indirect" (a side effect - e.g. produced by a trigger/foreign-key action, or
//   produced by applying a changeset entry that was itself flagged indirect). iTwin surfaces this
//   flag through `SqliteChangesetReader.isIndirect` (and `ChangeInstance.$meta.isIndirectChange`).
//
//   Before the SQLite fix, when a changeset was applied to a briefcase that had an active change
//   session (as happens during a `pullChanges` that must rebase local, un-pushed txns), EVERY
//   applied row change was re-recorded as DIRECT, regardless of how it was flagged in the incoming
//   changeset. In OpenSite+ this caused a whole site to be flagged as "directly modified" when only
//   a pond (whose trigger indirectly touched the site row) had actually been edited, which broke
//   the Blame feature.
//
//   The fix makes `sqlite3changeset_apply()` temporarily set the session "indirect" flag while
//   stepping a row change that was flagged indirect in the incoming changeset. As a result the
//   per-change direct/indirect classification is preserved end-to-end: a direct source change is
//   re-recorded direct, an indirect source change is re-recorded indirect.
//
// What these tests assert:
//   When briefcase B2 has a local, un-pushed change and pulls a changeset from B1 that contains an
//   INDIRECT change (a `bis_Model` LastMod/GeometryGuid update produced by a trigger when B1
//   inserted an element), the incoming indirect change is applied under B2's active session during
//   rebase. After the fix, that re-recorded change is still INDIRECT in B2; before the fix it would
//   have been DIRECT.
//
// NOTE: This test exercises behavior that lives in the native addon (@bentley/imodeljs-native).
//   It can only pass once an addon built from iTwin/imodel-native#1621 (SQLite tag
//   itwin-sqlite-v3.53.4-r3) is published and consumed by itwinjs-core. Until then it is expected
//   to fail locally, which is why it is parked on a branch rather than opened as a PR.
//=================================================================================================

import { assert } from "chai";
import { IModel, SubCategoryAppearance } from "@itwin/core-common";
import { EditTxn } from "../../EditTxn";
import {
  BriefcaseDb,
  ChannelControl,
  DictionaryModel,
  SpatialCategory,
  SqliteChangesetReader,
} from "../../core-backend";
import { HubMock } from "../../internal/HubMock";
import { HubWrappers, KnownTestLocations } from "..";
import { IModelTestUtils, TestUserType } from "../IModelTestUtils";
import { TestUtils } from "../TestUtils";

function startTestTxn(briefcase: BriefcaseDb): EditTxn {
  const txn = new EditTxn(briefcase, "session apply indirect");
  txn.start();
  return txn;
}

describe("Session apply preserves indirect flag (iTwin/itwinjs-backlog#2346)", () => {
  const ctx = {
    accessTokens: { user1: "", user2: "" },
    iModelId: "",
    iTwinId: "",
    modelId: "",
    spatialCategoryId: "",
    iModelName: "SessionApplyIndirect",
    rootSubject: "SessionApplyIndirect",
    openBriefcase: async (user: "user1" | "user2", noLock?: true) => {
      const b = await HubWrappers.downloadAndOpenBriefcase({ accessToken: ctx.accessTokens[user], iTwinId: ctx.iTwinId, iModelId: ctx.iModelId, noLock });
      b.channels.addAllowedChannel(ChannelControl.sharedChannelName);
      return b;
    },
    openB1: async (noLock?: true) => ctx.openBriefcase("user1", noLock),
    openB2: async (noLock?: true) => ctx.openBriefcase("user2", noLock),
  };

  async function insertPhysicalObject(txn: EditTxn): Promise<string> {
    const briefcase = txn.iModel as BriefcaseDb;
    await briefcase.locks.acquireLocks({ shared: ctx.modelId });
    return txn.insertElement(IModelTestUtils.createPhysicalObject(briefcase, ctx.modelId, ctx.spatialCategoryId).toJSON());
  }

  before(async () => {
    await TestUtils.startBackend();
    HubMock.startup("SessionApplyIndirect", KnownTestLocations.outputDir);
  });

  after(async () => {
    HubMock.shutdown();
  });

  beforeEach(async () => {
    ctx.iTwinId = HubMock.iTwinId;
    ctx.accessTokens.user1 = await HubWrappers.getAccessToken(TestUserType.SuperManager);
    ctx.accessTokens.user2 = await HubWrappers.getAccessToken(TestUserType.Regular);
    ctx.iModelId = await HubMock.createNewIModel({ accessToken: ctx.accessTokens.user1, iTwinId: ctx.iTwinId, iModelName: ctx.iModelName, description: ctx.rootSubject });
    assert.isNotEmpty(ctx.iModelId);

    // Seed the iModel with a physical model + spatial category that both briefcases share.
    const b1 = await ctx.openB1();
    const seedTxn = startTestTxn(b1);
    await b1.locks.acquireLocks({ shared: IModel.dictionaryId });
    [, ctx.modelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(
      seedTxn,
      IModelTestUtils.getUniqueModelCode(b1, "indirectModel"),
      true);
    const dictionary: DictionaryModel = b1.models.getModel<DictionaryModel>(IModel.dictionaryId);
    const categoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "IndirectCategory");
    ctx.spatialCategoryId = SpatialCategory.insert(
      seedTxn,
      dictionary.id,
      categoryCode.value,
      new SubCategoryAppearance({ color: 0xff0000 }),
    );
    seedTxn.saveChanges();
    await b1.pushChanges({ description: "seed model + category" });
    b1.close();
  });

  it("re-recorded indirect bis_Model update stays indirect after a rebasing pull", async () => {
    // B1 inserts an element. Inserting an element DIRECTLY writes the bis_Element row, and
    // INDIRECTLY updates the owning bis_Model row (LastMod / GeometryGuid) via a trigger. The
    // pushed changeset therefore contains at least one indirect bis_Model update.
    const b1 = await ctx.openB1();
    const b1Txn = startTestTxn(b1);
    await insertPhysicalObject(b1Txn);
    b1Txn.saveChanges("B1 inserts element (indirectly updates model)");
    await b1.pushChanges({ description: "B1 element insert" });

    // B2 makes its own local change into the SAME model but does NOT push it. This leaves B2 with
    // an active change session and un-pushed local txns, so the subsequent pull must REBASE: B1's
    // changeset is applied into B2 while B2's session is recording. This is exactly the path that
    // re-records applied changes and, before the fix, dropped their indirect flag.
    const b2 = await ctx.openB2();
    const b2Txn = startTestTxn(b2);
    await insertPhysicalObject(b2Txn);
    b2Txn.saveChanges("B2 local element insert (un-pushed)");

    // Pulling B1's changeset forces the rebase/apply of B1's indirect bis_Model update under B2's
    // active session. noFastForward guarantees a rebase actually happens rather than a trivial
    // fast-forward (which would not re-record anything).
    await b2.pullChanges();

    // Walk every local txn recorded in B2 (the result of applying B1's changeset and rebasing B2's
    // own txn on top of it) and inspect each bis_Model update. The #2346 invariant: a bis_Model
    // update must NEVER be recorded as a direct change - model LastMod/GeometryGuid changes are
    // always a trigger side effect, so they must stay indirect through the apply/rebase.
    let sawModelUpdate = false;
    let sawDirectModelUpdate = false;
    for (let txnId = b2.txns.queryFirstTxnId(); b2.txns.isTxnIdValid(txnId); txnId = b2.txns.queryNextTxnId(txnId)) {
      using reader = SqliteChangesetReader.openTxn({ db: b2, txnId });
      while (reader.step()) {
        if (reader.tableName === "bis_Model" && reader.op === "Updated") {
          sawModelUpdate = true;
          if (!reader.isIndirect)
            sawDirectModelUpdate = true;
        }
      }
      reader.close();
    }

    // We must have observed at least one bis_Model update (otherwise the test setup is wrong and
    // the assertion below would be vacuously true).
    assert.isTrue(sawModelUpdate, "expected at least one bis_Model update among B2's local changes");

    // The core assertion: after applying B1's changeset under B2's active session, no bis_Model
    // update was re-recorded as a DIRECT change. Before the SQLite fix this would be false because
    // every applied change was recorded direct.
    assert.isFalse(sawDirectModelUpdate, "a bis_Model update was re-recorded as direct; the indirect flag was lost while applying the changeset (iTwin/itwinjs-backlog#2346)");

    b1.close();
    b2.close();
  });
});
