/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { Id64, ChangeSetStatus, ChangeSetApplyOption, OpenMode } from "@bentley/bentleyjs-core";
import { Element, IModelDb, DictionaryModel, ChangeSetToken, IModelJsFs, ConcurrencyControl } from "../../backend";
import { IModelError, SubCategoryAppearance, IModel } from "@bentley/imodeljs-common";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { ErrorStatusOrResult } from "../../imodeljs-native-platform-api";

// Combine all local Txns and generate a changeset file. Then delete all local Txns.
function createChangeSet(imodel: IModelDb): ChangeSetToken {
  const res: ErrorStatusOrResult<ChangeSetStatus, string> = imodel.briefcase!.nativeDb!.startCreateChangeSet();
  if (res.error)
    throw new IModelError(res.error.status, "Error in startCreateChangeSet");

  const token: ChangeSetToken = JSON.parse(res.result!);

  // finishCreateChangeSet deletes the file that startCreateChangeSet created.
  // We make a copy of it now, before he does that.
  const csfilename = path.join(KnownTestLocations.outputDir, token.id + ".cs");
  IModelJsFs.copySync(token.pathname, csfilename);
  token.pathname = csfilename;

  const status: ChangeSetStatus = imodel.briefcase!.nativeDb!.finishCreateChangeSet();
  if (ChangeSetStatus.Success !== status)
    throw new IModelError(status, "Error in finishCreateChangeSet");

  return token;
}

function applyOneChangeSet(imodel: IModelDb, cstoken: ChangeSetToken) {
  const status: ChangeSetStatus = imodel.briefcase!.nativeDb!.applyChangeSets(JSON.stringify([cstoken]), ChangeSetApplyOption.Merge);
  imodel.onChangesetApplied.raiseEvent();
  assert.equal(status, ChangeSetStatus.Success);
}

function applyChangeSets(imodel: IModelDb, cshistory: ChangeSetToken[], curIdx: number): number {
  while (curIdx < (cshistory.length - 1)) {
    ++curIdx;
    applyOneChangeSet(imodel, cshistory[curIdx]);
  }
  return curIdx;
}

describe("ChangeMerging", () => {

  it("should merge changes so that two branches of an iModel converge", () => {
    // Make sure that the seed imodel has had all schema/profile upgrades applied, before we make copies of it.
    // (Otherwise, the upgrade Txn will appear to be in the changesets of the copies.)
    const upgraded: IModelDb = IModelTestUtils.openIModel("testImodel.bim", { copyFilename: "upgraded.bim", openMode: OpenMode.ReadWrite, enableTransactions: true });
    upgraded.saveChanges();
    createChangeSet(upgraded);

    // Open copies of the seed file.
    const first: IModelDb = IModelTestUtils.openIModelFromOut("upgraded.bim", { copyFilename: "first.bim", openMode: OpenMode.ReadWrite, enableTransactions: true });
    const second: IModelDb = IModelTestUtils.openIModelFromOut("upgraded.bim", { copyFilename: "second.bim", openMode: OpenMode.ReadWrite, enableTransactions: true });
    const neutral: IModelDb = IModelTestUtils.openIModelFromOut("upgraded.bim", { copyFilename: "neutral.bim", openMode: OpenMode.ReadWrite, enableTransactions: true });
    assert.isTrue(first !== second);

    first.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
    second.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
    // Note: neutral observer's IModel does not need to be configured for optimistic concurrency. He just pulls changes.

    const cshistory: ChangeSetToken[] = [];

    let firstparent: number = -1;
    let secondparent: number = -1;
    let neutralparent: number = -1;

    let modelId: Id64;
    let spatialCategoryId: Id64;
    let el1: Id64;
    // first. Create a new model, category, and element.  =>  #0
    if (true) {
      [, modelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(first, IModelTestUtils.getUniqueModelCode(first, "newPhysicalModel"), true);
      const dictionary: DictionaryModel = first.models.getModel(IModel.dictionaryId) as DictionaryModel;
      const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");
      spatialCategoryId = IModelTestUtils.createAndInsertSpatialCategory(dictionary, newCategoryCode.value!, new SubCategoryAppearance({ color: 0xff0000 }));
      el1 = first.elements.insertElement(IModelTestUtils.createPhysicalObject(first, modelId, spatialCategoryId));
      first.saveChanges();
      cshistory.push(createChangeSet(first));
      firstparent = cshistory.length - 1;
      assert.isTrue((cshistory.length - 1) === firstparent);
    }

    if (true) {
      // first -> second, neutral
      secondparent = applyChangeSets(second, cshistory, secondparent);
      assert.isTrue(second.models.getModel(modelId) !== undefined);
      assert.isTrue(second.elements.getElement(spatialCategoryId) !== undefined);
      assert.isTrue(second.elements.getElement(el1) !== undefined);

      neutralparent = applyChangeSets(neutral, cshistory, neutralparent);
      assert.isTrue(neutral.models.getModel(modelId) !== undefined);
      assert.isTrue(neutral.elements.getElement(spatialCategoryId) !== undefined);
      assert.isTrue(neutral.elements.getElement(el1) !== undefined);
    }

    // --- Test 1: Overlapping changes that really are conflicts => conflict-resolution policy is applied ---

    // first: modify el1.userLabel
    if (true) {
      const el1cc = first.elements.getElement(el1);
      el1cc.userLabel = el1cc.userLabel + " -> changed by first";
      first.elements.updateElement(el1cc);
      first.saveChanges("first modified el1.userLabel");
      cshistory.push(createChangeSet(first));
      firstparent = cshistory.length - 1;
    }

    // second: modify el1.userLabel
    let expectedValueofEl1UserLabel: string;
    if (true) {
      const el1before: Element = second.elements.getElement(el1);
      expectedValueofEl1UserLabel = el1before.userLabel + " -> changed by second";
      el1before.userLabel = expectedValueofEl1UserLabel;
      second.elements.updateElement(el1before);
      second.saveChanges("second modified el1.userLabel");

      // merge => take second's change (RejectIncomingChange). That's because the default updateVsUpdate settting is RejectIncomingChange
      secondparent = applyChangeSets(second, cshistory, secondparent);
      const el1after = second.elements.getElement(el1);
      assert.equal(el1after.userLabel, expectedValueofEl1UserLabel);
      cshistory.push(createChangeSet(second));
      secondparent = cshistory.length - 1;
    }

    // Make sure a neutral observer sees secondUser's change.
    if (true) {
      neutralparent = applyChangeSets(neutral, cshistory, neutralparent);
      const elobj = neutral.elements.getElement(el1);
      assert.equal(elobj.userLabel, expectedValueofEl1UserLabel);
    }

    // firstUser: pull and see that secondUser has overridden my change
    if (true) {
      firstparent = applyChangeSets(first, cshistory, firstparent);
      const elobj = first.elements.getElement(el1);
      assert.equal(elobj.userLabel, expectedValueofEl1UserLabel);
    }
  });

});
