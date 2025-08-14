/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { BriefcaseDb, BriefcaseManager, IModelDb, IModelHost, SnapshotDb, Subject } from "@itwin/core-backend";
import { HubMock } from "@itwin/core-backend/lib/cjs/internal/HubMock";
import { IModelTestUtils, KnownTestLocations } from "@itwin/core-backend/lib/cjs/test";
import { AccessToken, Guid, Id64String, IModelStatus } from "@itwin/core-bentley";
import { describe } from "mocha";
import { AzuriteTest } from "./AzuriteTest";
import { IModel, IModelError } from "@itwin/core-common";


async function assertThrowsAsync<T>(test: () => Promise<T>, contains?: string) {
  try {
    await test();
  } catch (e) {
    if (e instanceof Error && contains) {
      assert.isTrue(e.message.includes(contains));
    }
    return;
  }
  throw new Error(`Failed to throw error with message: "${contains}"`);
}

describe("Indirect changes flag on elements", () => {
  let iTwinId = "";
  const user1AccessToken = "token 1";
  const user2AccessToken = "token 2";
  let version0: string;
  let iModelId: string;

  before(async () => {
    await IModelHost.startup();
  });

  after(async () => {
    await IModelHost.shutdown();
  });

  beforeEach(async () => {
    iTwinId = Guid.createValue();
    IModelHost.authorizationClient = new AzuriteTest.AuthorizationClient();
    AzuriteTest.userToken = AzuriteTest.service.userToken.readWrite;
    HubMock.startup("IndirectChanges", KnownTestLocations.outputDir);
    version0 = IModelTestUtils.prepareOutputFile("IndirectChanges", "imodel1.bim");
    SnapshotDb.createEmpty(version0, { rootSubject: { name: "testIndirectChanges" } }).close();
    iModelId = await HubMock.createNewIModel({ accessToken: user1AccessToken, iTwinId, version0, iModelName: "indirectChanges" });
  });

  afterEach(async () => {
    HubMock.shutdown();
    IModelHost.authorizationClient = undefined;
  });

  async function openNewBriefcase(accessToken: AccessToken): Promise<BriefcaseDb> {
    const bcProps = await BriefcaseManager.downloadBriefcase({ iModelId, iTwinId, accessToken });
    return BriefcaseDb.open(bcProps);
  }

  function makeSubject(db: IModelDb, name: string, description: string, indirect?: boolean): Id64String {
    const subject = Subject.create(db, IModel.rootSubjectId, name, description);
    return db.elements.insertElement(subject.toJSON(), { indirect });
  };

  it("Insert, update and delete direct and indirect elements", async () => {
    const b1 = await openNewBriefcase(user1AccessToken);

    // 1. Create subject directly
    await b1.locks.acquireLocks({ shared: IModel.rootSubjectId });
    const directSubjectId = makeSubject(b1, "directSubject", "Direct subject", false);
    assert.isDefined(directSubjectId, "Failed to insert direct subject");
    assert.isTrue(b1.locks.holdsSharedLock(IModel.rootSubjectId));

    b1.saveChanges();
    await b1.pushChanges({ description: "create subject directly" });
    // lock is supposed to be released in pushChanges()
    assert.isFalse(b1.locks.holdsSharedLock(IModel.rootSubjectId));

    // 2. Create subject indirectly
    // First try to create subject indirectly without a lock - should throw (as discussed with @khanaffan)
    await assertThrowsAsync(async () => {
      makeSubject(b1, "indirectSubject", "Indirect subject", true);
    }, "shared lock not held on model for insert");

    // Now acquire the lock and create successfully
    await b1.locks.acquireLocks({ shared: IModel.rootSubjectId });
    const indirectSubjectId = makeSubject(b1, "indirectSubject", "Indirect subject", true);
    assert.isDefined(indirectSubjectId, "Failed to insert indirect subject");
    b1.saveChanges();
    await b1.pushChanges({ description: "create subject indirectly" });
    assert.isFalse(b1.locks.holdsSharedLock(IModel.rootSubjectId));

    // 3. Update subject directly
    // First try to update without a lock - should throw
    const directElement = b1.elements.getElement<Subject>(directSubjectId);
    directElement.userLabel = "updatedDirectly";
    await assertThrowsAsync(async () => {
      b1.elements.updateElement(directElement.toJSON(), { indirect: false });
    }, "exclusive lock not held on element for update");

    // Now acquire the lock and update successfully
    await b1.locks.acquireLocks({ exclusive: directSubjectId });
    b1.elements.updateElement(directElement.toJSON(), { indirect: false });
    b1.saveChanges();
    await b1.pushChanges({ description: "update subject directly" });

    // 4. Update subject indirectly
    const indirectElement = b1.elements.getElement<Subject>(indirectSubjectId);
    indirectElement.userLabel = "updatedIndirectly";
    b1.elements.updateElement(indirectElement.toJSON(), { indirect: true });
    b1.saveChanges();
    await b1.pushChanges({ description: "update subject indirectly" });

    // 5. Delete subject directly (requires lock)
    // First try to delete without a lock - should throw
    await assertThrowsAsync(async () => {
      b1.elements.deleteElement(directSubjectId, { indirect: false });
    }, "exclusive lock not held on element for delete");

    // Now acquire the lock and delete successfully
    await b1.locks.acquireLocks({ exclusive: directSubjectId });
    b1.elements.deleteElement(directSubjectId, { indirect: false });
    b1.saveChanges();
    await b1.pushChanges({ description: "delete subject directly" });

    // 6. Delete subject indirectly (no lock required)
    b1.elements.deleteElement(indirectSubjectId, { indirect: true });
    b1.saveChanges();
    await b1.pushChanges({ description: "delete subject indirectly" });

    b1.close();
  });

  it("Indirect changes should not require a lock", async () => {
    const b1 = await openNewBriefcase(user1AccessToken);
    await assertThrowsAsync(async () => {
      makeSubject(b1, "Subject 1", "Description 1", false);
    }, "shared lock not held on model for insert");

    await assertThrowsAsync(async () => {
      makeSubject(b1, "Subject 2", "Description 2");
    }, "shared lock not held on model for insert");

    const b1s3 = makeSubject(b1, "Subject 3", "Description 3", true);
    assert.isDefined(b1s3, "Subject 3 should be created in b1 as an indirect change");

    b1.close();
  });

  it("Indirect changes to same subject", async () => {
    // Create one subject which we will later modify to produce a conflict.
    // This should not require a lock on the indirect changes, and should pull without complaints.
    const b1 = await openNewBriefcase(user1AccessToken);
    await b1.locks.acquireLocks({ shared: IModel.rootSubjectId });
    const subjectId = makeSubject(b1, "Subject 1", "Description 1");
    assert.isDefined(subjectId);
    b1.saveChanges();
    await b1.pushChanges({ description: "B1: Inserted subject." });

    const b2 = await openNewBriefcase(user2AccessToken);

    const elementInB2 = b2.elements.getElement<Subject>(subjectId);
    assert.isDefined(elementInB2, "Subject 1 should be pulled into b2");
    elementInB2.description = "Modified description in b2";
    b2.elements.updateElement(elementInB2.toJSON(), { indirect: true });
    b2.saveChanges();

    const elementInB1 = b1.elements.getElement<Subject>(subjectId);
    assert.isDefined(elementInB1);
    elementInB1.description = "Modified description in b1";
    b1.elements.updateElement(elementInB1.toJSON(), { indirect: true });
    b1.saveChanges();

    await b1.pushChanges({ description: "B1: Modified subject." });
    await b2.pushChanges({ description: "B2: Modified subject." });

    await b1.pullChanges();
    await b2.pullChanges();

    const b1AfterConflict = b1.elements.getElement<Subject>(subjectId);
    assert.isDefined(b1AfterConflict);
    assert.strictEqual(b1AfterConflict.description, "Modified description in b2");

    const b2AfterConflict = b2.elements.getElement<Subject>(subjectId);
    assert.isDefined(b2AfterConflict);
    assert.strictEqual(b2AfterConflict.description, "Modified description in b1");

    b1.close();
    b2.close();
  });

  it("Element deletion without locks", async () => {
    // First create a subject that we can later delete
    const b1 = await openNewBriefcase(user1AccessToken);
    await b1.locks.acquireLocks({ shared: IModel.rootSubjectId });
    const subjectId = makeSubject(b1, "Subject to Delete", "Will be deleted");
    assert.isDefined(subjectId);
    b1.saveChanges();
    await b1.pushChanges({ description: "B1: Created subject for deletion test." });

    const b2 = await openNewBriefcase(user2AccessToken);
    await b2.pullChanges();

    // Verify the subject exists in both briefcases
    const elementInB1 = b1.elements.getElement<Subject>(subjectId);
    assert.isDefined(elementInB1);
    const elementInB2 = b2.elements.getElement<Subject>(subjectId);
    assert.isDefined(elementInB2);

    // Test that direct deletion requires a lock and fails without one
    await assertThrowsAsync(async () => {
      b2.elements.deleteElement(subjectId, { indirect: false });
    }, "exclusive lock not held on element for delete");

    // Test that indirect deletion works without a lock
    b2.elements.deleteElement(subjectId, { indirect: true });
    b2.saveChanges();
    await b2.pushChanges({ description: "B2: Deleted subject indirectly." });

    // Pull changes and verify the element is deleted
    await b1.pullChanges();

    // The element should no longer exist in either briefcase
    assert.throws(() => {
      try {
        b1.elements.getElement<Subject>(subjectId);
      } catch (err: unknown) {
        assert.instanceOf(err, IModelError);
        assert.strictEqual((err as IModelError).errorNumber, IModelStatus.NotFound);
        assert.include((err as IModelError).message, `Element=${subjectId}`);
        throw err;
      }
    });

    assert.throws(() => {
      try {
        b2.elements.getElement<Subject>(subjectId);
      } catch (err: unknown) {
        assert.instanceOf(err, IModelError);
        assert.strictEqual((err as IModelError).errorNumber, IModelStatus.NotFound);
        assert.include((err as IModelError).message, `Element=${subjectId}`);
        throw err;
      }
    });

    b1.close();
    b2.close();
  });
});
