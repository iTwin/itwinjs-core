/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { GuidString, Id64String } from "@itwin/core-bentley";
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
  DictionaryModel,
  SpatialCategory,
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

  return { modelId, spatialCategoryId };
}

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

describe("Merge conflict & locking", () => {
  let iTwinId: GuidString;

  before(() => {
    HubMock.startup("MergeConflictTest", KnownTestLocations.outputDir);
    iTwinId = HubMock.iTwinId;
  });
  after(() => HubMock.shutdown());

  it("pull/merge causing update conflict - dirty read/modify (with no lock)", async () => {
    /**
     * To simulate a a data conflict for dirty read we update same aspect from two different briefcases
     * and when the second briefcase try to push its changes it will fail with following error.
     * "UPDATE/DELETE before value do not match with one in db or CASCADE action was triggered."
     */
    const accessToken1 = await HubWrappers.getAccessToken(TestUserType.SuperManager);
    const accessToken2 = await HubWrappers.getAccessToken(TestUserType.Regular);
    const accessToken3 = await HubWrappers.getAccessToken(TestUserType.Super);

    // Delete any existing iModels with the same name as the read-write test iModel
    const iModelName = "TestIModel";

    // Create a new empty iModel on the Hub & obtain a briefcase
    const rwIModelId = await HubMock.createNewIModel({ accessToken: accessToken1, iTwinId, iModelName, description: "TestSubject", noLocks: undefined });
    assert.isNotEmpty(rwIModelId);

    // to reproduce the issue we will disable locks altogether.
    const b1 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: accessToken1, iTwinId, iModelId: rwIModelId, noLock: true });
    const b2 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: accessToken2, iTwinId, iModelId: rwIModelId, noLock: true });
    const b3 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: accessToken3, iTwinId, iModelId: rwIModelId, noLock: true });

    // create and insert a new model with code1
    const [, modelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(
      b1,
      IModelTestUtils.getUniqueModelCode(b1, "newPhysicalModel"),
      true);

    const dictionary: DictionaryModel = b1.models.getModel<DictionaryModel>(IModel.dictionaryId);
    const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");

    const spatialCategoryId = SpatialCategory.insert(
      dictionary.iModel,
      dictionary.id,
      newCategoryCode.value,
      new SubCategoryAppearance({ color: 0xff0000 }),
    );

    // insert element and aspect
    const el1 = b1.elements.insertElement(IModelTestUtils.createPhysicalObject(b1, modelId, spatialCategoryId).toJSON());
    await b1.pullChanges();
    const aspectId1 = b1.elements.insertAspect({
      classFullName: "BisCore:ExternalSourceAspect",
      element: {
        relClassName: "BisCore:ElementOwnsExternalSourceAspects",
        id: el1,
      },
      kind: "",
      identifier: "test identifier",
    } as ElementAspectProps);
    b1.saveChanges();
    await b1.pushChanges({ accessToken: accessToken1, description: `inserted element with aspect ${el1}` });

    // b1 same as b2 and now both will modify same aspect
    await b2.pullChanges();

    // b1  will change identifier from "test identifier" to "test identifier (modified by b1)"
    b1.elements.updateAspect({
      id: aspectId1,
      classFullName: "BisCore:ExternalSourceAspect",
      element: {
        relClassName: "BisCore:ElementOwnsExternalSourceAspects",
        id: el1,
      },
      kind: "",
      identifier: "test identifier (modified by b1)",
    } as ElementAspectProps);
    b1.saveChanges();
    await b1.pushChanges({ accessToken: accessToken1, description: `modify aspect ${aspectId1} with no lock` });

    // b2 will change identifier from "test identifier" to "test identifier (modified by b2)"
    b2.elements.updateAspect({
      id: aspectId1,
      classFullName: "BisCore:ExternalSourceAspect",
      element: {
        relClassName: "BisCore:ElementOwnsExternalSourceAspects",
        id: el1,
      },
      kind: "",
      identifier: "test identifier (modified by b2)",
    } as ElementAspectProps);
    b2.saveChanges();

    await assertThrowsAsync(
      async () => b2.pushChanges({ accessToken: accessToken1, description: `modify aspect ${aspectId1} with no lock` }),
      "UPDATE/DELETE before value do not match with one in db or CASCADE action was triggered.");

    await b3.pullChanges();

    b1.close();
    b2.close();
    b3.close();
  });
  it("pull/merge causing update conflict - cascade delete causing local changes (with no lock)", async () => {
    /**
     * To simulate a incorrect changeset we disable lock and make some changes where we add
     * aspect for a deleted element and try to pull/push/merge it. Which will fail with following error.
     * "UPDATE/DELETE before value do not match with one in db or CASCADE action was triggered."
     */
    const accessToken1 = await HubWrappers.getAccessToken(TestUserType.SuperManager);
    const accessToken2 = await HubWrappers.getAccessToken(TestUserType.Regular);
    const accessToken3 = await HubWrappers.getAccessToken(TestUserType.Super);

    // Delete any existing iModels with the same name as the read-write test iModel
    const iModelName = "TestIModel";

    // Create a new empty iModel on the Hub & obtain a briefcase
    const rwIModelId = await HubMock.createNewIModel({ accessToken: accessToken1, iTwinId, iModelName, description: "TestSubject", noLocks: undefined });
    assert.isNotEmpty(rwIModelId);

    // to reproduce the issue we will disable locks altogether.
    const b1 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: accessToken1, iTwinId, iModelId: rwIModelId, noLock: true });
    const b2 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: accessToken2, iTwinId, iModelId: rwIModelId, noLock: true });
    const b3 = await HubWrappers.downloadAndOpenBriefcase({ accessToken: accessToken3, iTwinId, iModelId: rwIModelId, noLock: true });

    // create and insert a new model with code1
    const [, modelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(
      b1,
      IModelTestUtils.getUniqueModelCode(b1, "newPhysicalModel"),
      true);

    const dictionary: DictionaryModel = b1.models.getModel<DictionaryModel>(IModel.dictionaryId);
    const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");

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
    b2.elements.insertAspect({
      classFullName: "BisCore:ExternalSourceAspect",
      element: {
        relClassName: "BisCore:ElementOwnsExternalSourceAspects",
        id: el1,
      },
      kind: "",
      identifier: "test identifier",
    } as ElementAspectProps);

    b1.elements.deleteElement(el1);
    b1.saveChanges();

    await b1.pushChanges({ accessToken: accessToken1, description: `deleted element ${el1}` });
    b2.saveChanges();

    await assertThrowsAsync(
      async () => b2.pushChanges({ accessToken: accessToken2, description: `add aspect to element ${el1}` }),
      "UPDATE/DELETE before value do not match with one in db or CASCADE action was triggered.");

    await b3.pullChanges();

    b1.close();
    b2.close();
    b3.close();
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
});
