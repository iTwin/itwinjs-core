/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ChangeSetApplyOption, ChangeSetStatus, Id64String, OpenMode } from "@bentley/bentleyjs-core";
import { IModel, IModelError, SubCategoryAppearance } from "@bentley/imodeljs-common";
import { assert } from "chai";
import * as path from "path";
import { IModelHost } from "../../IModelHost";
import { ChangeSetToken, ConcurrencyControl, DictionaryModel, Element, IModelDb, IModelJsFs, IModelJsNative, SpatialCategory, StandaloneIModelDb } from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { BriefcaseId } from "../../BriefcaseManager";

// Combine all local Txns and generate a changeset file. Then delete all local Txns.
function createChangeSet(imodel: IModelDb): ChangeSetToken {
  const res: IModelJsNative.ErrorStatusOrResult<ChangeSetStatus, string> = imodel.briefcase!.nativeDb!.startCreateChangeSet();
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
  const status: ChangeSetStatus = IModelHost.platform.ApplyChangeSetsRequest.doApplySync(imodel.briefcase!.nativeDb!, JSON.stringify([cstoken]), ChangeSetApplyOption.Merge);
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
    const testFileName = IModelTestUtils.prepareOutputFile("ChangeMerging", "upgraded.bim");
    const seedFileName = IModelTestUtils.resolveAssetFile("testImodel.bim");
    IModelJsFs.copySync(seedFileName, testFileName);
    const upgradedDb = StandaloneIModelDb.open(testFileName, OpenMode.ReadWrite);
    upgradedDb.nativeDb.enableTxnTesting();
    upgradedDb.saveChanges();
    createChangeSet(upgradedDb);

    // Open copies of the seed file.
    const firstFileName = IModelTestUtils.prepareOutputFile("ChangeMerging", "first.bim");
    const secondFileName = IModelTestUtils.prepareOutputFile("ChangeMerging", "second.bim");
    const neutralFileName = IModelTestUtils.prepareOutputFile("ChangeMerging", "neutral.bim");
    IModelJsFs.copySync(testFileName, firstFileName);
    IModelJsFs.copySync(testFileName, secondFileName);
    IModelJsFs.copySync(testFileName, neutralFileName);
    const firstDb = StandaloneIModelDb.open(firstFileName, OpenMode.ReadWrite);
    const secondDb = StandaloneIModelDb.open(secondFileName, OpenMode.ReadWrite);
    const neutralDb = StandaloneIModelDb.open(neutralFileName, OpenMode.ReadWrite);
    assert.isTrue(firstDb !== secondDb);
    firstDb.nativeDb.enableTxnTesting();
    secondDb.nativeDb.enableTxnTesting();
    neutralDb.nativeDb.enableTxnTesting();
    firstDb.nativeDb.setBriefcaseId(BriefcaseId.Standalone);
    secondDb.nativeDb.setBriefcaseId(BriefcaseId.Standalone);
    neutralDb.nativeDb.setBriefcaseId(BriefcaseId.Standalone);

    firstDb.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
    secondDb.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());
    // Note: neutral observer's IModel does not need to be configured for optimistic concurrency. He just pulls changes.

    const cshistory: ChangeSetToken[] = [];

    let firstParent: number = -1;
    let secondParent: number = -1;
    let neutralParent: number = -1;

    let modelId: Id64String;
    let spatialCategoryId: Id64String;
    let el1: Id64String;
    // first. Create a new model, category, and element.  =>  #0
    if (true) {
      [, modelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(firstDb, IModelTestUtils.getUniqueModelCode(firstDb, "newPhysicalModel"), true);
      const dictionary: DictionaryModel = firstDb.models.getModel(IModel.dictionaryId) as DictionaryModel;
      const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");
      spatialCategoryId = SpatialCategory.insert(dictionary.iModel, dictionary.id, newCategoryCode.value!, new SubCategoryAppearance({ color: 0xff0000 }));
      el1 = firstDb.elements.insertElement(IModelTestUtils.createPhysicalObject(firstDb, modelId, spatialCategoryId));
      firstDb.saveChanges();
      cshistory.push(createChangeSet(firstDb));
      firstParent = cshistory.length - 1;
      assert.isTrue((cshistory.length - 1) === firstParent);
    }

    if (true) {
      // first -> second, neutral
      secondParent = applyChangeSets(secondDb, cshistory, secondParent);
      assert.isTrue(secondDb.models.getModel(modelId) !== undefined);
      assert.isTrue(secondDb.elements.getElement(spatialCategoryId) !== undefined);
      assert.isTrue(secondDb.elements.getElement(el1) !== undefined);

      neutralParent = applyChangeSets(neutralDb, cshistory, neutralParent);
      assert.isTrue(neutralDb.models.getModel(modelId) !== undefined);
      assert.isTrue(neutralDb.elements.getElement(spatialCategoryId) !== undefined);
      assert.isTrue(neutralDb.elements.getElement(el1) !== undefined);
    }

    // --- Test 1: Overlapping changes that really are conflicts => conflict-resolution policy is applied ---

    // first: modify el1.userLabel
    if (true) {
      const el1cc = firstDb.elements.getElement(el1);
      el1cc.userLabel = el1cc.userLabel + " -> changed by first";
      firstDb.elements.updateElement(el1cc);
      firstDb.saveChanges("first modified el1.userLabel");
      cshistory.push(createChangeSet(firstDb));
      firstParent = cshistory.length - 1;
    }

    // second: modify el1.userLabel
    let expectedValueofEl1UserLabel: string;
    if (true) {
      const el1before: Element = secondDb.elements.getElement(el1);
      expectedValueofEl1UserLabel = el1before.userLabel + " -> changed by second";
      el1before.userLabel = expectedValueofEl1UserLabel;
      secondDb.elements.updateElement(el1before);
      secondDb.saveChanges("second modified el1.userLabel");

      // merge => take second's change (RejectIncomingChange). That's because the default updateVsUpdate settting is RejectIncomingChange
      secondParent = applyChangeSets(secondDb, cshistory, secondParent);
      const el1after = secondDb.elements.getElement(el1);
      assert.equal(el1after.userLabel, expectedValueofEl1UserLabel);
      cshistory.push(createChangeSet(secondDb));
      secondParent = cshistory.length - 1;
    }

    // Make sure a neutral observer sees secondUser's change.
    if (true) {
      neutralParent = applyChangeSets(neutralDb, cshistory, neutralParent);
      const elobj = neutralDb.elements.getElement(el1);
      assert.equal(elobj.userLabel, expectedValueofEl1UserLabel);
    }

    // firstUser: pull and see that secondUser has overridden my change
    if (true) {
      firstParent = applyChangeSets(firstDb, cshistory, firstParent);
      const elobj = firstDb.elements.getElement(el1);
      assert.equal(elobj.userLabel, expectedValueofEl1UserLabel);
    }
  });

});
