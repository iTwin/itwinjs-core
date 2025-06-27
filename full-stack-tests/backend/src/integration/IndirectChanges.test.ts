/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { BriefcaseDb, BriefcaseManager, IModelDb, IModelHost, SnapshotDb, Subject } from "@itwin/core-backend";
import { HubMock } from "@itwin/core-backend/lib/cjs/internal/HubMock";
import { IModelTestUtils, KnownTestLocations } from "@itwin/core-backend/lib/cjs/test";
import { AccessToken, DbConflictResolution, Guid, Id64String } from "@itwin/core-bentley";
import { describe } from "mocha";
import { AzuriteTest } from "./AzuriteTest";
import { IModel } from "@itwin/core-common";


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

describe.only("Indirect changes flag on elements", () => {
  let iTwinId = "";
  const user1AccessToken = "token 1";
  const user2AccessToken = "token 2";
  let version0: string;
  let iModelId: string;

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
  });

  it("Insert direct and indirect subjects and cross pull", async () => {
    const b1 = await openNewBriefcase(user1AccessToken);
    const b2 = await openNewBriefcase(user2AccessToken);

    await b1.locks.acquireLocks({ shared: IModel.rootSubjectId });
    const b1s1 = makeSubject(b1, "Subject 1", "Description 1", false);
    assert.isDefined(b1s1, "Subject 1 should be created in b1");
    const b1s2 = makeSubject(b1, "Subject 2", "Description 2", true);
    assert.isDefined(b1s2, "Subject 2 should be created in b1 as an indirect change");
    const b1s3 = makeSubject(b1, "Subject 3", "Description 3", undefined);
    assert.isDefined(b1s3, "Subject 3 should be created in b1 as a direct change");
    b1.saveChanges();
    await b1.pushChanges({ description: "B1: Inserted 3 subjects. 2 direct 1 indirect." });


    await b2.locks.acquireLocks({ shared: IModel.rootSubjectId });
    const b2s1 = makeSubject(b2, "Subject 4", "Description 4", false);
    assert.isDefined(b2s1, "Subject 4 should be created in b2");
    const b2s2 = makeSubject(b2, "Subject 5", "Description 5", true);
    assert.isDefined(b2s2, "Subject 5 should be created in b2 as an indirect change");
    const b2s3 = makeSubject(b2, "Subject 6", "Description 6", undefined);
    assert.isDefined(b2s3, "Subject 6 should be created in b2 as a direct change");
    b2.saveChanges();
    await b2.pushChanges({ description: "B2: Inserted 3 subjects. 2 direct 1 indirect." });

    await b1.pullChanges();
    const b1s1Pulled = b1.elements.getElement<Subject>(b1s1);
    assert.isDefined(b1s1Pulled);
    assert.strictEqual(b1s1Pulled.code.value, "Subject 1");

    const b1s2Pulled = b1.elements.getElement<Subject>(b1s2);
    assert.isDefined(b1s2Pulled);
    assert.strictEqual(b1s2Pulled.code.value, "Subject 2");

    const b1s3Pulled = b1.elements.getElement<Subject>(b1s3);
    assert.isDefined(b1s3Pulled);
    assert.strictEqual(b1s3Pulled.code.value, "Subject 3");

    const b1s4Pulled = b1.elements.getElement<Subject>(b2s1);
    assert.isDefined(b1s4Pulled);
    assert.strictEqual(b1s4Pulled.code.value, "Subject 4");

    const b1s5Pulled = b1.elements.getElement<Subject>(b2s2);
    assert.isDefined(b1s5Pulled);
    assert.strictEqual(b1s5Pulled.code.value, "Subject 5");

    const b1s6Pulled = b1.elements.getElement<Subject>(b2s3);
    assert.isDefined(b1s6Pulled);
    assert.strictEqual(b1s6Pulled.code.value, "Subject 6");

    await b2.pullChanges();
    const b2s1Pulled = b2.elements.getElement<Subject>(b1s1);
    assert.isDefined(b2s1Pulled);
    assert.strictEqual(b2s1Pulled.code.value, "Subject 1");

    const b2s2Pulled = b2.elements.getElement<Subject>(b1s2);
    assert.isDefined(b2s2Pulled);
    assert.strictEqual(b2s2Pulled.code.value, "Subject 2");

    const b2s3Pulled = b2.elements.getElement<Subject>(b1s3);
    assert.isDefined(b2s3Pulled);
    assert.strictEqual(b2s3Pulled.code.value, "Subject 3");

    const b2s4Pulled = b2.elements.getElement<Subject>(b2s1);
    assert.isDefined(b2s4Pulled);
    assert.strictEqual(b2s4Pulled.code.value, "Subject 4");

    const b2s5Pulled = b2.elements.getElement<Subject>(b2s2);
    assert.isDefined(b2s5Pulled);
    assert.strictEqual(b2s5Pulled.code.value, "Subject 5");

    const b2s6Pulled = b2.elements.getElement<Subject>(b2s3);
    assert.isDefined(b2s6Pulled);
    assert.strictEqual(b2s6Pulled.code.value, "Subject 6");

    b1.close();
    b2.close();
  });

  it.only("Conflict on changes to same subject", async () => {
    // Create one subject which we will later modify to produce a conflict.
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

    let reportedB1Conflicts = 0;
    let reportedB2Conflicts = 0;
    b1.txns.appCustomConflictHandler = (conflict) => {
      assert.isDefined(conflict);
      reportedB1Conflicts++;
      assert.isTrue(conflict.indirect);
      return DbConflictResolution.Skip;
    }
    b2.txns.appCustomConflictHandler = (conflict) => {
      assert.isDefined(conflict);
      reportedB2Conflicts++;
      assert.isTrue(conflict.indirect);
      return DbConflictResolution.Skip;
    }

    await b1.pullChanges();
    await b2.pullChanges();

    assert.strictEqual(reportedB1Conflicts, 0); // currently no conflicts reported
    assert.strictEqual(reportedB2Conflicts, 0);

    const b1AfterConflict = b1.elements.getElement<Subject>(subjectId);
    assert.isDefined(b1AfterConflict);
    assert.strictEqual(b1AfterConflict.description, "Modified description in b2");

    const b2AfterConflict = b2.elements.getElement<Subject>(subjectId);
    assert.isDefined(b2AfterConflict);
    assert.strictEqual(b2AfterConflict.description, "Modified description in b1");

    b1.close();
    b2.close();
  });
});
