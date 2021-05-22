/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { join } from "path";
import * as sinon from "sinon";
import { GuidString } from "@bentley/bentleyjs-core";
import { BriefcaseProps, IModelVersion } from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { BriefcaseManager, ChangesetFileProps } from "../BriefcaseManager";
import { CheckpointManager, DownloadRequest } from "../CheckpointManager";
import { IModelJsFs } from "../IModelJsFs";
import { LocalDirName, LocalFileName, LocalHub } from "./LocalHub";

/** Mocks iModelHub for testing creating Briefcases, downloading checkpoints, and simulating multiple users pushing and pulling changeset. */
export class HubMock {
  private static mockRoot: LocalDirName;
  private static hubs = new Map<string, LocalHub>();

  public static startup(mockRoot: LocalDirName) {
    this.mockRoot = mockRoot;
    IModelJsFs.recursiveMkDirSync(mockRoot);
    IModelJsFs.purgeDirSync(mockRoot);

    sinon.stub(BriefcaseManager, "acquireNewBriefcaseId").callsFake(async (req: AuthorizedClientRequestContext, iModelId: GuidString): Promise<number> => {
      return this.findLocalHub(iModelId).acquireNewBriefcaseId(req.accessToken.getUserInfo()!.id);
    });
    sinon.stub(BriefcaseManager, "releaseBriefcase").callsFake(async (_, briefcase: BriefcaseProps) => {
      return this.findLocalHub(briefcase.iModelId).releaseBriefcaseId(briefcase.briefcaseId);
    });

    sinon.stub(BriefcaseManager, "getChangeSetIndexFromId").callsFake(async (_, iModelId: GuidString, changeSetId: string): Promise<number> => {
      return this.findLocalHub(iModelId).getChangesetIndex(changeSetId);
    });

    sinon.stub(BriefcaseManager, "downloadChangeSets").callsFake(async (_, iModelId: GuidString, fromId: string, toId: string): Promise<ChangesetFileProps[]> => {
      return this.findLocalHub(iModelId).downloadChangesets({ fromId, toId, targetDir: BriefcaseManager.getChangeSetsPath(iModelId) });
    });

    sinon.stub(BriefcaseManager, "pushChangesetFile").callsFake(async (_, iModelId: GuidString, changesetProps: ChangesetFileProps) => {
      return this.findLocalHub(iModelId).addChangeset(changesetProps);
    });

    sinon.stub(CheckpointManager, "downloadCheckpoint").callsFake(async (request: DownloadRequest): Promise<void> => {
      return this.findLocalHub(request.checkpoint.iModelId).downloadCheckpoint({ id: request.checkpoint.changeSetId, targetFile: request.localFile });
    });

    sinon.stub(IModelVersion, "getLatestChangeSetId").callsFake(async (_1, _2, iModelId: GuidString): Promise<GuidString> => {
      return this.findLocalHub(iModelId).getLatestChangesetId();
    });

    sinon.stub(IModelVersion, "getChangeSetFromNamedVersion").callsFake(async (_1, _2, iModelId: GuidString, versionName: string): Promise<GuidString> => {
      return this.findLocalHub(iModelId).findNamedVersion(versionName);
    });
  }

  public static shutdown() {
    for (const hub of this.hubs)
      hub[1].cleanup();

    IModelJsFs.purgeDirSync(this.mockRoot);
    sinon.restore();
  }

  public static findLocalHub(iModelId: GuidString): LocalHub {
    const hub = this.hubs.get(iModelId);
    if (!hub)
      throw new Error(`local hub for iModel ${iModelId} not created`);
    return hub;
  }

  /** create a LocalHub for an iModel.
   *  - contextId - the Guid of the context to mock
   *  - iModelId - the Guid of the iModel to mock
   *  - iModelName - the name of the iModel to mock
   *  - revision0 - the local filename of the revision 0 (aka "seed") .bim file
   */
  public static create(arg: { contextId: GuidString, iModelId: GuidString, iModelName: string, revision0: LocalFileName }) {
    if (!this.mockRoot)
      throw new Error("call startup first");

    const mock = new LocalHub(arg.contextId, arg.iModelId, arg.iModelName, join(HubMock.mockRoot, arg.iModelId), arg.revision0);
    this.hubs.set(arg.iModelId, mock);
  }
}

