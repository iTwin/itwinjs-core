/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { join } from "path";
import * as sinon from "sinon";
import { GuidString } from "@bentley/bentleyjs-core";
import { CodeProps, IModelVersion } from "@bentley/imodeljs-common";
import { AuthorizedBackendRequestContext } from "../BackendRequestContext";
import { BriefcaseManager } from "../BriefcaseManager";
import { CheckpointManager, DownloadRequest } from "../CheckpointManager";
import { BriefcaseIdArg, ChangesetFileProps, ChangesetProps, ChangesetRange, HubAccess, IModelIdArg, LockProps } from "../HubAccess";
import { IModelHost } from "../IModelHost";
import { IModelJsFs } from "../IModelJsFs";
import { LocalDirName, LocalHub, LocalHubProps } from "./LocalHub";

/** Mocks iModelHub for testing creating Briefcases, downloading checkpoints, and simulating multiple users pushing and pulling changeset. */
export class HubMock {
  private static mockRoot: LocalDirName;
  private static hubs = new Map<string, LocalHub>();
  private static _saveHubAccess: HubAccess;

  public static get isValid() { return undefined !== this.mockRoot; }
  public static startup(mockRoot: LocalDirName) {
    this.mockRoot = mockRoot;
    IModelJsFs.recursiveMkDirSync(mockRoot);
    IModelJsFs.purgeDirSync(mockRoot);
    this._saveHubAccess = IModelHost.hubAccess;
    IModelHost.hubAccess = this;

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

  public static async getChangeSetIdFromNamedVersion(arg: IModelIdArg & { versionName: string }): Promise<string> {
    return this.findLocalHub(arg.iModelId).findNamedVersion(arg.versionName);
  }

  public static async getChangesetIdFromVersion(arg: IModelIdArg & { version: IModelVersion }): Promise<string> {
    const version = arg.version;
    if (version.isFirst)
      return "";

    const asOf = version.getAsOfChangeSet();
    if (asOf)
      return asOf;

    const versionName = version.getName();
    if (versionName)
      return this.getChangeSetIdFromNamedVersion({ ...arg, versionName });

    return this.getLatestChangeSetId(arg);
  }

  public static async getLatestChangeSetId(arg: IModelIdArg): Promise<string> {
    return this.findLocalHub(arg.iModelId).getLatestChangesetId();
  }

  public static async getChangeSetIndexFromId(arg: IModelIdArg & { changeSetId: string }): Promise<number> {
    return this.findLocalHub(arg.iModelId).getChangesetIndex(arg.changeSetId);
  }

  public static async getMyBriefcaseIds(arg: IModelIdArg): Promise<number[]> {
    const requestContext = arg.requestContext ?? await AuthorizedBackendRequestContext.create();
    return this.findLocalHub(arg.iModelId).getBriefcaseIds(requestContext.accessToken.getUserInfo()!.id);
  }

  public static async acquireNewBriefcaseId(arg: IModelIdArg): Promise<number> {
    const requestContext = arg.requestContext ?? await AuthorizedBackendRequestContext.create();
    return this.findLocalHub(arg.iModelId).acquireNewBriefcaseId(requestContext.accessToken.getUserInfo()!.id);

  }
  /** Release a briefcaseId. After this call it is illegal to generate changesets for the released briefcaseId. */
  public static async releaseBriefcase(arg: BriefcaseIdArg): Promise<void> {
    return this.findLocalHub(arg.iModelId).releaseBriefcaseId(arg.briefcaseId);
  }

  public static async downloadChangeSet(arg: IModelIdArg & { id: string }): Promise<ChangesetFileProps> {
    return this.findLocalHub(arg.iModelId).downloadChangeset({ id: arg.id, targetDir: BriefcaseManager.getChangeSetsPath(arg.iModelId) });
  }

  public static async downloadChangeSets(arg: IModelIdArg & { range: ChangesetRange }): Promise<ChangesetFileProps[]> {
    return this.findLocalHub(arg.iModelId).downloadChangesets({ range: arg.range, targetDir: BriefcaseManager.getChangeSetsPath(arg.iModelId) });
  }

  public static async queryChangesetProps(arg: IModelIdArg & { changesetId: string }): Promise<ChangesetProps> {
    return this.findLocalHub(arg.iModelId).getChangesetById(arg.changesetId);
  }

  public static async pushChangeset(arg: IModelIdArg & { changesetProps: ChangesetFileProps, releaseLocks: boolean }): Promise<void> {
    return this.findLocalHub(arg.iModelId).addChangeset(arg.changesetProps);
  }

  public static async releaseAllLocks(_arg: BriefcaseIdArg) {

  }
  public static async releaseAllCodes(_arg: BriefcaseIdArg) {
  }

  public static async getAllLocks(_arg: BriefcaseIdArg): Promise<LockProps[]> {
    return [];
  }

  public static async getAllCodes(_arg: BriefcaseIdArg): Promise<CodeProps[]> {
    return [];
  }

  public static shutdown() {
    for (const hub of this.hubs)
      hub[1].cleanup();

    IModelJsFs.purgeDirSync(this.mockRoot);
    sinon.restore();
    IModelHost.hubAccess = this._saveHubAccess;
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
  public static create(arg: LocalHubProps) {
    if (!this.mockRoot)
      throw new Error("call startup first");

    const mock = new LocalHub(join(this.mockRoot, arg.iModelId), arg);
    this.hubs.set(arg.iModelId, mock);
  }

  public static destroy(imodelId: GuidString) {
    const hub = this.findLocalHub(imodelId);
    hub.cleanup();
    this.hubs.delete(imodelId);
  }
}

