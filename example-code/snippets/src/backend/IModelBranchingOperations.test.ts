/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import * as path from "path";
import {
  BriefcaseDb, BriefcaseManager, ExternalSource, ExternalSourceIsInRepository, IModelDb, IModelHost, PhysicalModel, PhysicalObject,
  PhysicalPartition, RepositoryLink, SnapshotDb, SpatialCategory, withEditTxn,
} from "@itwin/core-backend";
import { IModelTestUtils as BackendTestUtils, HubWrappers, TestUserType } from "@itwin/core-backend/lib/cjs/test/IModelTestUtils";
import { HubMock } from "@itwin/core-backend/lib/cjs/internal/HubMock";
import { AccessToken } from "@itwin/core-bentley";
import { Code, ExternalSourceProps, IModel, PhysicalElementProps, RepositoryLinkProps, SubCategoryAppearance } from "@itwin/core-common";
import { Point3d, YawPitchRollAngles } from "@itwin/core-geometry";
process.env.TRANSFORMER_NO_STRICT_DEP_CHECK = "1"; // allow this monorepo's dev versions of core libs in transformer
import { IModelTransformer, ProcessChangesOptions } from "@itwin/imodel-transformer";
import { KnownTestLocations } from "./IModelTestUtils";

// some json will be required later, but we don't want an eslint-disable line in the example code, so just disable for the file
/* eslint-disable @typescript-eslint/no-require-imports */

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
  const branchIModelId = await IModelHost.createNewIModel({
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
  const masterLinkRepoId = withEditTxn(branchDb, (txn) => branchDb.constructEntity<RepositoryLink, RepositoryLinkProps>({
    classFullName: RepositoryLink.classFullName,
    code: RepositoryLink.createCode(branchDb, IModelDb.repositoryModelId, "example-code-value"),
    model: IModelDb.repositoryModelId,
    url: "https://wherever-you-got-your-imodel.net",
    format: "iModel",
    repositoryGuid: masterDb.iModelId,
    description: "master iModel repository",
  }).insert(txn));

  const masterExternalSourceId = withEditTxn(branchDb, (txn) => branchDb.constructEntity<ExternalSource, ExternalSourceProps>({
    classFullName: ExternalSource.classFullName,
    model: IModelDb.rootSubjectId,
    code: Code.createEmpty(),
    repository: new ExternalSourceIsInRepository(masterLinkRepoId),
    connectorName: "iModel Transformer",
    connectorVersion: require("@itwin/imodel-transformer/package.json").version,
  }).insert(txn));

  // initialize the branch provenance
  const branchInitializer = new IModelTransformer(masterDb, branchDb, {
    // tells the transformer that we have a raw copy of a source and the target should receive
    // provenance from the source that is necessary for performing synchronizations in the future
    wasSourceIModelCopiedToTarget: true,
    // store the synchronization provenance in the scope of our representation of the external source, master
    targetScopeElementId: masterExternalSourceId,
  });
  const description = "initialized branch iModel";
  await withEditTxn(branchDb, description, async () => branchInitializer.processAll());
  branchInitializer.dispose();

  // The withEditTxn scope above ends by calling EditTxn.saveChanges before pushChanges.
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
  const opts: ProcessChangesOptions = {
    accessToken: myAccessToken,
  };
  const description = "updated branch with recent master changes";
  await withEditTxn(branchDb, description, async () => synchronizer.processChanges(opts));
  synchronizer.dispose();
  // The withEditTxn scope above ends by calling EditTxn.saveChanges before pushChanges.
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
  const opts: ProcessChangesOptions = {
    accessToken: myAccessToken,
  };
  const description = "merged changes from branch into master";
  await withEditTxn(masterDb, description, async () => reverseSynchronizer.processChanges(opts));
  reverseSynchronizer.dispose();
  // The withEditTxn scope above ends by calling EditTxn.saveChanges before pushChanges.
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
    const ids = withEditTxn(db, (txn) => ({
      spatialCategoryId: SpatialCategory.insert(txn, IModel.dictionaryId, "SpatialCategory1", new SubCategoryAppearance()),
      physicalModelId: PhysicalModel.insert(txn, IModel.rootSubjectId, "PhysicalModel1"),
    }));
    spatialCategoryId = ids.spatialCategoryId;
    physicalModelId = ids.physicalModelId;
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
  withEditTxn(db, description, (txn) => txn.insertElement(physicalObjectProps));
  // The withEditTxn scope above ends by calling EditTxn.saveChanges before pushChanges.
  await db.pushChanges({
    accessToken: myAccessToken,
    description,
  });
}

namespace arbitraryEdit {
  // eslint-disable-next-line prefer-const
  export let editCounter = 0;
}

// ###TODO: @itwin/imodel-transformer tries to access IModelDb.nativeDb which was removed in 5.0, test will fail
// until that package is updated to 5.0.
describe.skip("IModelBranchingOperations", () => {
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
    const masterIModelId = await IModelHost.createNewIModel({
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
