/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { AccessToken, ChangeSet, IModelAccessContext } from "@bentley/imodeljs-clients";
import { IModelBankAccessContext } from "@bentley/imodeljs-clients/lib/IModelBank/IModelBankAccessContext";
import { IModelDb, BriefcaseManager, ConcurrencyControl } from "../../backend";
import { KnownTestLocations } from "../KnownTestLocations";
import { OpenParams } from "../../IModelDb";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // (needed temporarily to use self-signed cert to communicate with iModelBank via https)

const imodelId = "233e1f55-561d-42a4-8e80-d6f91743863e";

export class NonBentleyProject {
  public static getAccessToken1() {
    return { toTokenString: () => "", getUserProfile: () => ({ userId: "user1" }) } as AccessToken;
  }

  public static getAccessToken2() {
    return { toTokenString: () => "", getUserProfile: () => ({ userId: "user2" }) } as AccessToken;
  }

  // Deploy and start up an iModelBank server for this iModel
  public static async getIModelAccessContext(imodelid: string, _projectid: string): Promise<IModelAccessContext> {
    // WIP DEMO WIP - we currently always use a single server, and it supports only one iModel!
    return new IModelBankAccessContext(imodelid, "https://localhost:3001", "QA", undefined);
  }
}

describe.skip("iModelBank", () => {
  it("should get schema lock", async () => {
    const accessContext = await NonBentleyProject.getIModelAccessContext(imodelId, "");
    const accessToken1 = NonBentleyProject.getAccessToken1();
    const accessToken2 = NonBentleyProject.getAccessToken2();

    await BriefcaseManager.purgeClosed(accessToken1);
    await BriefcaseManager.purgeClosed(accessToken2);

    const iModel1: IModelDb = await IModelDb.open(accessToken1, accessContext.toIModelTokenContextId(), imodelId, OpenParams.pullAndPush());
    assert.exists(iModel1);

    const iModel2: IModelDb = await IModelDb.open(accessToken2, accessContext.toIModelTokenContextId(), imodelId, OpenParams.pullAndPush());
    assert.exists(iModel2);

    iModel1.concurrencyControl.setPolicy(new ConcurrencyControl.PessimisticPolicy());
    iModel2.concurrencyControl.setPolicy(new ConcurrencyControl.PessimisticPolicy());

    // iModel1 - Obtain schema lock and import a schema
    await iModel1.importSchema(path.join(KnownTestLocations.assetsDir, "PerfTestDomain.ecschema.xml"));
    iModel1.saveChanges();
    await iModel1.pushChanges(accessToken1);

    // iModel2 - Try to obtain schema lock ...
    try {
      await iModel2.importSchema(path.join(KnownTestLocations.assetsDir, "Test2.ecschema.xml"));
      assert.fail("should fail because schema lock is unavailable because briefcase2 must pull first");
    } catch (err) {
      // We expect this attempt to import to fail. That is because ...
    }
    // ... iModel2 must first pull iModel1's schema changes.
    const wasChangeSetId = iModel2.briefcase.changeSetId!;
    const changeSetsOnServer: ChangeSet[] = await BriefcaseManager.imodelClient.ChangeSets().get(accessToken2, iModel2.iModelToken.iModelId!);
    assert.notEqual(changeSetsOnServer.length, 0);
    await iModel2.pullAndMergeChanges(accessToken2);
    assert.notEqual(iModel2.briefcase.changeSetId!, wasChangeSetId); // should have advanced to tip.
    assert.equal(iModel2.briefcase.changeSetId!, changeSetsOnServer[changeSetsOnServer.length - 1].id);

    //  Now iModel2 should be able to get the schema lock.
    await iModel2.importSchema(path.join(KnownTestLocations.assetsDir, "Test2.ecschema.xml"));
    iModel2.saveChanges();
    await iModel2.pushChanges(accessToken2);

  });
});
