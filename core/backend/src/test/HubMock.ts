/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { join } from "path";
import * as sinon from "sinon";
import { Guid, GuidString } from "@bentley/bentleyjs-core";
import { CodeProps, IModelVersion } from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import {
  BackendHubAccess, BriefcaseDbArg, BriefcaseIdArg, ChangesetFileProps, ChangesetId, ChangesetIdArg, ChangesetProps, ChangesetRange, CheckPointArg,
  IModelIdArg, LocalDirName, LocalFileName, LockProps,
} from "../BackendHubAccess";
import { AuthorizedBackendRequestContext } from "../BackendRequestContext";
import { BriefcaseManager } from "../BriefcaseManager";
import { SnapshotDb } from "../IModelDb";
import { IModelHost } from "../IModelHost";
import { IModelHubBackend } from "../IModelHubBackend";
import { IModelJsFs } from "../IModelJsFs";
import { HubUtility } from "./integration/HubUtility";
import { KnownTestLocations } from "./KnownTestLocations";
import { LocalHub, LocalHubProps } from "./LocalHub";

/** Mocks iModelHub for testing creating Briefcases, downloading checkpoints, and simulating multiple users pushing and pulling changesets, etc. */
export class HubMock {
  private static mockRoot: LocalDirName | undefined;
  private static hubs = new Map<string, LocalHub>();
  private static _saveHubAccess: BackendHubAccess;

  public static get isValid() { return undefined !== this.mockRoot; }
  public static startup(mockName: LocalDirName) {
    this.mockRoot = join(KnownTestLocations.outputDir, "HubMock", mockName);

    IModelJsFs.recursiveMkDirSync(this.mockRoot);
    IModelJsFs.purgeDirSync(this.mockRoot);
    this._saveHubAccess = IModelHost.hubAccess;
    IModelHost.setHubAccess(this);

    HubUtility.contextId = Guid.createValue();

    sinon.stub(IModelVersion, "getLatestChangeSetId").callsFake(async (): Promise<GuidString> => {
      throw new Error("this method is deprecated and cannot be used while IModelHub is mocked - use IModelHost.hubaccess.getChangesetIdFromVersion");
    });

    sinon.stub(IModelVersion, "getChangeSetFromNamedVersion").callsFake(async (): Promise<GuidString> => {
      throw new Error("this method is deprecated and cannot be used while IModelHub is mocked - use IModelHost.hubaccess.getChangesetIdFromVersion");
    });

    sinon.stub(IModelHubBackend, "iModelClient").get(() => {
      throw new Error("IModelHubAccess is mocked for this test - use only IModelHost.hubaccess functions");
    });

  }
  public static shutdown() {
    if (!this.isValid)
      return;

    HubUtility.contextId = undefined;
    for (const hub of this.hubs)
      hub[1].cleanup();

    IModelJsFs.purgeDirSync(this.mockRoot!);
    IModelJsFs.removeSync(this.mockRoot!);
    sinon.restore();
    IModelHost.setHubAccess(this._saveHubAccess);
    this.mockRoot = undefined;
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

  public static async getChangesetIdFromNamedVersion(arg: IModelIdArg & { versionName: string }): Promise<string> {
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
      return this.getChangesetIdFromNamedVersion({ ...arg, versionName });

    return this.getLatestChangesetId(arg);
  }

  public static async getLatestChangesetId(arg: IModelIdArg): Promise<string> {
    return this.findLocalHub(arg.iModelId).getLatestChangesetId();
  }

  public static async getChangesetIndexFromId(arg: IModelIdArg & { changesetId: ChangesetId }): Promise<number> {
    return this.findLocalHub(arg.iModelId).getChangesetIndex(arg.changesetId);
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

  public static async downloadChangeset(arg: ChangesetIdArg): Promise<ChangesetFileProps> {
    return this.findLocalHub(arg.iModelId).downloadChangeset({ changesetId: arg.changesetId, targetDir: BriefcaseManager.getChangeSetsPath(arg.iModelId) });
  }

  public static async downloadChangesets(arg: IModelIdArg & { range?: ChangesetRange }): Promise<ChangesetFileProps[]> {
    return this.findLocalHub(arg.iModelId).downloadChangesets({ range: arg.range, targetDir: BriefcaseManager.getChangeSetsPath(arg.iModelId) });
  }

  public static async queryChangeset(arg: IModelIdArg & { changesetId: ChangesetId }): Promise<ChangesetProps> {
    return this.findLocalHub(arg.iModelId).getChangesetById(arg.changesetId);
  }

  public static async queryChangesets(arg: IModelIdArg & { range?: ChangesetRange }): Promise<ChangesetProps[]> {
    return this.findLocalHub(arg.iModelId).queryChangesets(arg.range);
  }

  public static async pushChangeset(arg: IModelIdArg & { changesetProps: ChangesetFileProps, releaseLocks: boolean }): Promise<void> {
    return this.findLocalHub(arg.iModelId).addChangeset(arg.changesetProps);
  }

  public static async downloadV2Checkpoint(arg: CheckPointArg): Promise<ChangesetId> {
    return this.findLocalHub(arg.checkpoint.iModelId).downloadCheckpoint({ changesetId: arg.checkpoint.changeSetId, targetFile: arg.localFile });
  }

  public static async downloadV1Checkpoint(arg: CheckPointArg): Promise<ChangesetId> {
    return this.findLocalHub(arg.checkpoint.iModelId).downloadCheckpoint({ changesetId: arg.checkpoint.changeSetId, targetFile: arg.localFile });
  }

  public static async releaseAllLocks(_arg: BriefcaseIdArg) {

  }
  public static async releaseAllCodes(_arg: BriefcaseIdArg) {
  }

  public static async getAllLocks(_arg: BriefcaseDbArg): Promise<LockProps[]> {
    return [];
  }

  public static async getAllCodes(_arg: BriefcaseDbArg): Promise<CodeProps[]> {
    return [];
  }

  public static async acquireLocks(_arg: BriefcaseDbArg & { locks: LockProps[] }): Promise<void> {
  }

  public static async queryIModelByName(arg: { requestContext?: AuthorizedClientRequestContext, contextId: GuidString, iModelName: string }): Promise<GuidString | undefined> {
    for (const hub of this.hubs) {
      const localHub = hub[1];
      if (localHub.contextId === arg.contextId && localHub.iModelName === arg.iModelName)
        return localHub.iModelId;
    }
    return undefined;
  }

  public static async createIModel(arg: { requestContext?: AuthorizedClientRequestContext, contextId: GuidString, iModelName: string, description?: string, revision0?: LocalFileName }): Promise<GuidString> {
    const revision0 = arg.revision0 ?? join(this.mockRoot!, "revision0.bim");

    const localProps = { ...arg, iModelId: Guid.createValue(), revision0 };
    if (!arg.revision0) { // if they didn't supply a revision0 file, create a blank one.
      const blank = SnapshotDb.createEmpty(revision0, { rootSubject: { name: arg.description ?? arg.iModelName } });
      blank.saveChanges();
      blank.close();
    }

    this.create(localProps);
    if (!arg.revision0)
      IModelJsFs.removeSync(revision0);

    return localProps.iModelId;
  }

  public static async deleteIModel(arg: IModelIdArg & { contextId: GuidString }): Promise<void> {
    return this.destroy(arg.iModelId);
  }

}

