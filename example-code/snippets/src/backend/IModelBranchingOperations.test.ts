/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BriefcaseDb, BriefcaseManager, ExternalSource, ExternalSourceIsInRepository, IModelDb, IModelHost, RepositoryLink } from "@itwin/core-backend";
import * as path from "path";
import { AccessToken } from "@itwin/core-bentley";
import { Code } from "@itwin/core-common";
import { IModelTransformer } from "@itwin/core-transformer";
import { HubMock } from "@itwin/core-backend/lib/cjs/test/HubMock";
import { HubWrappers, TestUserType } from "@itwin/core-backend/lib/cjs/test/IModelTestUtils";

async function initializeBranch(myITwinId: string, masterIModelId: string, myAccessToken: AccessToken) {
  // __PUBLISH_EXTRACT_START__ IModelBranchingOperations_initialize
  // download and open master
  const masterDbProps = await BriefcaseManager.downloadBriefcase({
    accessToken: myAccessToken,
    iTwinId: myITwinId,
    iModelId: masterIModelId,
  });
  const masterDb = await BriefcaseDb.open({ fileName: masterDbProps.fileName });

  // create a duplicate of master as a good starting point for our branch
  const branchIModelId = await IModelHost.hubAccess.createNewIModel({
    iTwinId: myITwinId,
    iModelName: "my-branch-imodel",
    version0: masterDb.pathName,
  });

  // download and open the new branch
  const branchDbProps = await BriefcaseManager.downloadBriefcase({
    accessToken: myAccessToken,
    iTwinId: myITwinId,
    iModelId: branchIModelId,
  });
  const branchDb = await BriefcaseDb.open({ fileName: branchDbProps.fileName });

  // create an external source and owning repository link to use as our *Target Scope Element* for future synchronizations
  const masterLinkRepoId = new RepositoryLink({
    classFullName: RepositoryLink.classFullName,
    code: RepositoryLink.createCode(branchDb, IModelDb.repositoryModelId, "example-code-value"),
    model: IModelDb.repositoryModelId,
    url: "https://wherever-you-got-your-imodel.net",
    format: "iModel",
    repositoryGuid: masterDb.iModelId,
    description: "master iModel repository",
  }, branchDb).insert();

  const masterExternalSourceId = new ExternalSource({
    classFullName: ExternalSource.classFullName,
    model: IModelDb.rootSubjectId,
    code: Code.createEmpty(),
    repository: new ExternalSourceIsInRepository(masterLinkRepoId),
    connectorName: "iModel Transformer",
    connectorVersion: require("@itwin/core-transformer/package.json").version,
  }, branchDb).insert();

  // initialize the branch provenance
  const branchInitializer = new IModelTransformer(masterDb, branchDb, {
    // tells the transformer that we have a raw copy of a source and the target should receive
    // provenance from the source that is necessary for performing synchronizations in the future
    wasSourceIModelCopiedToTarget: true,
    // store the synchronization provenance in the scope of our representation of the external source, master
    targetScopeElementId: masterExternalSourceId,
  });
  await branchInitializer.processAll();
  branchInitializer.dispose();

  // save+push our changes to whatever hub we're using
  const description = "initialized branch iModel";
  branchDb.saveChanges(description);
  await branchDb.pushChanges({
    accessToken: myAccessToken,
    description,
  });
  // __PUBLISH_EXTRACT_END__

  return { masterDb, branchDb };
}

// we assume masterDb and branchDb have already been opened (see the first example)
async function forwardSyncMasterToBranch(masterDb: BriefcaseDb, branchDb: BriefcaseDb, myAccessToken: AccessToken) {
  // __PUBLISH_EXTRACT_START__ IModelBranchingOperations_forwardSync
  const masterExternalSourceId = branchDb.elements.queryElementIdByCode(
    RepositoryLink.createCode(masterDb, IModelDb.repositoryModelId, "example-code-value"),
  );
  const synchronizer = new IModelTransformer(masterDb, branchDb, {
    // read the synchronization provenance in the scope of our representation of the external source, master
    targetScopeElementId: masterExternalSourceId,
  });
  await synchronizer.processChanges(myAccessToken);
  synchronizer.dispose();
  // save and push
  const description = "updated branch with recent master changes";
  branchDb.saveChanges(description);
  await branchDb.pushChanges({
    accessToken: myAccessToken,
    description,
  });
  // __PUBLISH_EXTRACT_END__
}

async function reverseSyncBranchToMaster(branchDb: BriefcaseDb, masterDb: BriefcaseDb, myAccessToken: AccessToken) {
  // __PUBLISH_EXTRACT_START__ IModelBranchingOperations_reverseSync
  // we assume masterDb and branchDb have already been opened (see the first example)
  const masterExternalSourceId = branchDb.elements.queryElementIdByCode(
    RepositoryLink.createCode(masterDb, IModelDb.repositoryModelId, "example-code-value"),
  );
  const reverseSynchronizer = new IModelTransformer(branchDb, masterDb, {
    // tells the transformer that the branch provenance will be stored in the source
    // since the synchronization direction is reversed
    isReverseSynchronization: true,
    // read the synchronization provenance in the scope of our representation of the external source, master
    // "isReverseSynchronization" actually causes the provenance (and therefore the targetScopeElementId) to
    // be searched for from the source
    targetScopeElementId: masterExternalSourceId,
  });
  await reverseSynchronizer.processChanges(myAccessToken);
  reverseSynchronizer.dispose();
  // save and push
  const description = "merged changes from branch into master";
  masterDb.saveChanges(description);
  await masterDb.pushChanges({
    accessToken: myAccessToken,
    description,
  });
  // __PUBLISH_EXTRACT_END__
}

async function arbitraryEdit(_db: BriefcaseDb) {

}

describe("IModelBranchingOperations", () => {

  before(async () => HubMock.startup("IModelBranchingOperations"));
  after(() => HubMock.shutdown());

  it("run branching operations", async () => {
    const myAccessToken = await HubWrappers.getAccessToken(TestUserType.Regular);
    const myITwinId = HubMock.iTwinId;
    const masterIModelId = await IModelHost.hubAccess.createNewIModel({
      iTwinId: myITwinId,
      iModelName: "my-branch-imodel",
      version0: path.join(__dirname, "assets", "test.bim"),
    });
    const { masterDb, branchDb } = await initializeBranch(myITwinId, masterIModelId, myAccessToken);
    await arbitraryEdit(masterDb);
    await forwardSyncMasterToBranch(masterDb, branchDb, myAccessToken);
    await arbitraryEdit(branchDb);
    await reverseSyncBranchToMaster(branchDb, masterDb, myAccessToken);
  });
});
