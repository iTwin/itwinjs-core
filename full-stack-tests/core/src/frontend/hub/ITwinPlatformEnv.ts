/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AccessToken, BentleyError, BentleyStatus, GuidString } from "@itwin/core-bentley";
import { Project as ITwin } from "@itwin/projects-client";
import {
  BriefcaseQuery, ChangeSet, ChangeSetQuery, IModelBankClient, IModelBankFileSystemITwinClient, IModelHubFrontend, IModelQuery, VersionQuery,
} from "@bentley/imodelhub-client";
import { AuthorizationClient, BriefcaseId, ChangesetIndexAndId, IModelVersion } from "@itwin/core-common";
import { FrontendHubAccess, IModelIdArg } from "@itwin/core-frontend";
import { ITwinAccessClientWrapper } from "../../common/ITwinAccessClientWrapper";

export interface IModelNameArg {
  readonly iModelName: string;
  readonly iTwinId: GuidString;
  readonly accessToken: AccessToken;
}

export interface BriefcaseIdArg extends IModelIdArg {
  readonly briefcaseId: BriefcaseId;
}

export interface TestFrontendHubAccess extends FrontendHubAccess {
  /** Get the iModelId of an iModel by name. Undefined if no iModel with that name exists.  */
  queryIModelByName(arg: IModelNameArg): Promise<GuidString | undefined>;
  getMyBriefcaseIds(arg: IModelIdArg): Promise<number[]>;
  releaseBriefcase(arg: BriefcaseIdArg): Promise<void>;
}

export class IModelBankFrontend implements TestFrontendHubAccess {
  private _hubClient: IModelBankClient;
  constructor(orchestratorUrl: string) {
    this._hubClient = new IModelBankClient(orchestratorUrl, undefined);
  }

  private async _getChangesetFromId(arg: IModelIdArg & { changeSetId: string }): Promise<ChangesetIndexAndId> {
    const changeSets: ChangeSet[] = await this._hubClient.changeSets.get(arg.accessToken, arg.iModelId, new ChangeSetQuery().byId(arg.changeSetId));
    if (!changeSets[0] || !changeSets[0].index || !changeSets[0].id)
      throw new BentleyError(BentleyStatus.ERROR, `Changeset ${arg.changeSetId} not found`);
    return { index: +changeSets[0].index, id: changeSets[0].id };
  }

  public async getLatestChangeset(arg: IModelIdArg): Promise<ChangesetIndexAndId> {
    const changeSets: ChangeSet[] = await this._hubClient.changeSets.get(arg.accessToken, arg.iModelId, new ChangeSetQuery().top(1).latest());
    if (!changeSets[0] || !changeSets[0].index || !changeSets[0].id)
      return { index: 0, id: "" };
    return { index: +changeSets[0].index, id: changeSets[0].id };
  }

  public async getChangesetFromVersion(arg: IModelIdArg & { version: IModelVersion }): Promise<ChangesetIndexAndId> {
    const version = arg.version;
    if (version.isFirst)
      return { index: 0, id: "" };

    const asOfChangeSetId = version.getAsOfChangeSet();
    if (asOfChangeSetId)
      return this._getChangesetFromId({ ...arg, changeSetId: asOfChangeSetId });

    const versionName = version.getName();
    if (versionName)
      return this.getChangesetFromNamedVersion({ ...arg, versionName });

    return this.getLatestChangeset(arg);
  }

  public async getChangesetFromNamedVersion(arg: IModelIdArg & { versionName?: string }): Promise<ChangesetIndexAndId> {
    const versionQuery = arg.versionName ? new VersionQuery().select("ChangeSetId").byName(arg.versionName) : new VersionQuery().top(1);
    const versions = await this._hubClient.versions.get(arg.accessToken, arg.iModelId, versionQuery);
    if (!versions[0] || !versions[0].changeSetIndex || !versions[0].changeSetId)
      throw new BentleyError(BentleyStatus.ERROR, `Named version ${arg.versionName ?? ""} not found`);
    return { index: versions[0].changeSetIndex, id: versions[0].changeSetId };
  }

  /** Get the iModelId of an iModel by name. Undefined if no iModel with that name exists.  */
  public async queryIModelByName(arg: IModelNameArg): Promise<GuidString | undefined> {
    const iModels = await this._hubClient.iModels.get(arg.accessToken, arg.iTwinId, new IModelQuery().byName(arg.iModelName));
    return iModels.length === 0 ? undefined : iModels[0].id!;
  }

  public async getMyBriefcaseIds(arg: IModelIdArg): Promise<number[]> {
    const myHubBriefcases = await this._hubClient.briefcases.get(arg.accessToken, arg.iModelId, new BriefcaseQuery().ownedByMe().selectDownloadUrl());
    const myBriefcaseIds: number[] = [];
    for (const hubBc of myHubBriefcases)
      myBriefcaseIds.push(hubBc.briefcaseId!); // save the list of briefcaseIds we already own.
    return myBriefcaseIds;
  }

  public async releaseBriefcase(arg: BriefcaseIdArg): Promise<void> {
    await this._hubClient.briefcases.delete(arg.accessToken, arg.iModelId, arg.briefcaseId);
  }
}

/** Defines a base set of the set of Simple base interface for the client implementations that will be passed to the IModelApp. */
export interface ITwinPlatformAbstraction {
  readonly hubAccess: TestFrontendHubAccess;
  readonly iTwinMgr: ITwinAccessClientWrapper;
  readonly authClient?: AuthorizationClient;
}

/** A convenient wrapper that includes a default set of clients necessary to configure an iTwin.js application for the iTwin Platform. */
export class ITwinPlatformCloudEnv implements ITwinPlatformAbstraction {
  public readonly iTwinMgr = new ITwinAccessClientWrapper(); // this should be the new ITwinRegistryWrapper defined in #2045
  public readonly hubAccess = new IModelHubFrontend();
  public readonly authClient?: AuthorizationClient; // This should be the new AuthorizationClient method defined in #

  public constructor(authClient?: AuthorizationClient) {
    this.authClient = authClient;
  }
}

/** A convenient wrapper that includes a default set of clients necessary to configure an iTwin.js application for the iTwin Stack. */
export class ITwinStackCloudEnv implements ITwinPlatformAbstraction {
  public readonly iTwinMgr: IModelBankFileSystemITwinClient;
  public readonly hubAccess: TestFrontendHubAccess;
  public readonly authClient?: AuthorizationClient;

  public constructor(orchestratorUrl: string, authClient?: AuthorizationClient) {
    this.hubAccess = new IModelBankFrontend(orchestratorUrl);
    this.iTwinMgr = new IModelBankFileSystemITwinClient(orchestratorUrl);
    this.authClient = authClient;
  }

  public async bootstrapIModelBankProject(token: AccessToken, iTwinName: string): Promise<void> {
    const iTwin: ITwin | undefined = await this.iTwinMgr.getITwinByName(token, iTwinName);
    if (iTwin !== undefined)
      await this.iTwinMgr.deleteITwin(token, iTwin.id);
    await this.iTwinMgr.createITwin(token, iTwinName);
  }
}

