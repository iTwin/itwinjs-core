/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import * as path from "path";
import {
  BriefcaseDb, BriefcaseManager, ExternalSource, ExternalSourceIsInRepository, HubMock, IModelDb, IModelHost, PhysicalModel, PhysicalObject,
  PhysicalPartition, RepositoryLink, SnapshotDb, SpatialCategory,
} from "@itwin/core-backend";
import { IModelTestUtils as BackendTestUtils, HubWrappers, TestUserType } from "@itwin/core-backend/lib/cjs/test/IModelTestUtils";
import { AccessToken } from "@itwin/core-bentley";
import { Code, ExternalSourceProps, IModel, PhysicalElementProps, RepositoryLinkProps, SubCategoryAppearance } from "@itwin/core-common";
import { Point3d, YawPitchRollAngles } from "@itwin/core-geometry";
process.env.TRANSFORMER_NO_STRICT_DEP_CHECK = "1"; // allow this monorepo's dev versions of core libs in transformer
import { IModelTransformer } from "@itwin/imodel-transformer";
import { KnownTestLocations } from "./IModelTestUtils";

// some json will be required later, but we don't want an eslint-disable line in the example code, so just disable for the file
/* eslint-disable @typescript-eslint/no-var-requires */

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
    noLocks: true, // you may prefer locks for your application
  });

  // download and open the new branch
  const branchDbProps = await BriefcaseManager.downloadBriefcase({
    accessToken: myAccessToken,
    iTwinId: myITwinId,
    iModelId: branchIModelId,
  });
  const branchDb = await BriefcaseDb.open({ fileName: branchDbProps.fileName });

  // create an external source and owning repository link to use as our *Target Scope Element* for future synchronizations
  const masterLinkRepoId = branchDb.constructEntity<RepositoryLink, RepositoryLinkProps>({
    classFullName: RepositoryLink.classFullName,
    code: RepositoryLink.createCode(branchDb, IModelDb.repositoryModelId, "example-code-value"),
    model: IModelDb.repositoryModelId,
    url: "https://wherever-you-got-your-imodel.net",
    format: "iModel",
    repositoryGuid: masterDb.iModelId,
    description: "master iModel repository",
  }).insert();

  const masterExternalSourceId = branchDb.constructEntity<ExternalSource, ExternalSourceProps>({
    classFullName: ExternalSource.classFullName,
    model: IModelDb.rootSubjectId,
    code: Code.createEmpty(),
    repository: new ExternalSourceIsInRepository(masterLinkRepoId),
    connectorName: "iModel Transformer",
    connectorVersion: require("@itwin/imodel-transformer/package.json").version,
  }).insert();

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

async function arbitraryEdit(db: BriefcaseDb, myAccessToken: AccessToken, description: string) {
  const spatialCategoryCode = SpatialCategory.createCode(db, IModel.dictionaryId, "SpatialCategory1");
  const physicalModelCode = PhysicalPartition.createCode(db, IModel.rootSubjectId, "PhysicalModel1");
  let spatialCategoryId = db.elements.queryElementIdByCode(spatialCategoryCode);
  let physicalModelId = db.elements.queryElementIdByCode(physicalModelCode);
  if (physicalModelId === undefined || spatialCategoryId === undefined) {
    spatialCategoryId = SpatialCategory.insert(db, IModel.dictionaryId, "SpatialCategory1", new SubCategoryAppearance());
    physicalModelId = PhysicalModel.insert(db, IModel.rootSubjectId, "PhysicalModel1");
  }
  const physicalObjectProps: PhysicalElementProps = {
    classFullName: PhysicalObject.classFullName,
    model: physicalModelId,
    category: spatialCategoryId,
    code: new Code({ spec: IModelDb.rootSubjectId, scope: IModelDb.rootSubjectId, value: `${arbitraryEdit.editCounter}` }),
    userLabel: `${arbitraryEdit.editCounter}`,
    geom: BackendTestUtils.createBox(Point3d.create(1, 1, 1)),
    placement: {
      origin: Point3d.create(arbitraryEdit.editCounter, arbitraryEdit.editCounter, 0),
      angles: YawPitchRollAngles.createDegrees(0, 0, 0),
    },
  };
  arbitraryEdit.editCounter++;
  db.elements.insertElement(physicalObjectProps);
  db.saveChanges();
  await db.pushChanges({
    accessToken: myAccessToken,
    description,
  });
}

namespace arbitraryEdit {
  // eslint-disable-next-line prefer-const
  export let editCounter = 0;
}

describe("IModelBranchingOperations", () => {
  const version0Path = path.join(KnownTestLocations.outputDir, "branching-ops.bim");

  before(async () => {
    HubMock.startup("IModelBranchingOperations", KnownTestLocations.outputDir);
    if (fs.existsSync(version0Path))
      fs.unlinkSync(version0Path);
    SnapshotDb.createEmpty(version0Path, { rootSubject: { name: "branching-ops" } }).close();
  });

  after(() => {
    HubMock.shutdown();
  });

  it("run branching operations", async () => {
    const myAccessToken = await HubWrappers.getAccessToken(TestUserType.Regular);
    const myITwinId = HubMock.iTwinId;
    const masterIModelId = await IModelHost.hubAccess.createNewIModel({
      iTwinId: myITwinId,
      iModelName: "my-branch-imodel",
      version0: version0Path,
      noLocks: true,
    });
    const { masterDb, branchDb } = await initializeBranch(myITwinId, masterIModelId, myAccessToken);
    await arbitraryEdit(masterDb, myAccessToken, "edit master");
    await forwardSyncMasterToBranch(masterDb, branchDb, myAccessToken);
    await arbitraryEdit(branchDb, myAccessToken, "edit branch");
    await reverseSyncBranchToMaster(branchDb, masterDb, myAccessToken);
    masterDb.close();
    branchDb.close();
  });
});
