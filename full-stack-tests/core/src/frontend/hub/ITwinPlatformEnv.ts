/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AccessToken, BentleyError, BentleyStatus, GuidString } from "@itwin/core-bentley";
import { Project as ITwin } from "@itwin/projects-client";
import { AuthorizationClient, BriefcaseId, ChangesetIndexAndId, IModelVersion } from "@itwin/core-common";
import { FrontendHubAccess, IModelIdArg } from "@itwin/core-frontend";
import { BriefcaseQuery, ChangeSet, ChangeSetQuery, IModelBankClient, IModelBankFileSystemITwinClient, IModelQuery, VersionQuery } from "@bentley/imodelbank-client"; // TODO: Remove when we have a replacement for the current iModelBank client in the way
import { AccessTokenAdapter, FrontendIModelsAccess } from "@itwin/imodels-access-frontend";
import { IModelsClient as AuthorIModelsClient, Briefcase, GetBriefcaseListParams, GetIModelListParams, IModelScopedOperationParams, MinimalIModel, ReleaseBriefcaseParams, SPECIAL_VALUES_ME, toArray } from "@itwin/imodels-client-authoring";
import { IModelsClient as FrontendIModelsClient } from "@itwin/imodels-client-management";
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

export class TestHubFrontend extends FrontendIModelsAccess {
  private getScopedOperationParams(arg: IModelIdArg): IModelScopedOperationParams {
    return {
      authorization: AccessTokenAdapter.toAuthorizationCallback(arg.accessToken),
      iModelId: arg.iModelId,
    };
  }

  public async queryIModelByName(arg: IModelNameArg): Promise<GuidString | undefined> {
    const getIModelListParams: GetIModelListParams = {
      authorization: AccessTokenAdapter.toAuthorizationCallback(arg.accessToken),
      urlParams: {
        projectId: arg.iTwinId,
        name: arg.iModelName,
      },
    };

    const iModelsIterator: AsyncIterableIterator<MinimalIModel> = this._iModelsClient.iModels.getMinimalList(getIModelListParams);
    const iModels = await toArray(iModelsIterator);
    return iModels.length === 0 ? undefined : iModels[0].id;
  }
  public async getMyBriefcaseIds(arg: IModelIdArg): Promise<number[]> {
    const getBriefcaseListParams: GetBriefcaseListParams = {
      ...this.getScopedOperationParams(arg),
      urlParams: {
        ownerId: SPECIAL_VALUES_ME,
      },
    };

    const briefcasesIterator: AsyncIterableIterator<Briefcase> = this._iModelsClient.briefcases.getRepresentationList(getBriefcaseListParams);
    const briefcases: Briefcase[] = await toArray(briefcasesIterator);
    const briefcaseIds: BriefcaseId[] = briefcases.map((briefcase) => briefcase.briefcaseId);
    return briefcaseIds;

  }
  public async releaseBriefcase(arg: BriefcaseIdArg): Promise<void> {
    const releaseBriefcaseParams: ReleaseBriefcaseParams = {
      ...this.getScopedOperationParams(arg),
      briefcaseId: arg.briefcaseId,
    };

    // Need to use the IModelsClient from the authoring package to be able to release the briefcase.
    const iModelClient = new AuthorIModelsClient({ api: { baseUrl: `https://${process.env.IMJS_URL_PREFIX ?? ""}api.bentley.com/imodels`}});
    return iModelClient.briefcases.release(releaseBriefcaseParams);
  }
}

// WARNING: Only this section is allowed to import from imodelbank-client
export class IModelBankFrontend implements TestFrontendHubAccess {
  private _hubClient: IModelBankClient;
  constructor(orchestratorUrl: string) {
    this._hubClient = new IModelBankClient(orchestratorUrl, undefined);
  }

  private async _getChangesetFromId(arg: IModelIdArg & { changesetId: string }): Promise<ChangesetIndexAndId> {
    const changesets: ChangeSet[] = await this._hubClient.changeSets.get(arg.accessToken, arg.iModelId, new ChangeSetQuery().byId(arg.changesetId));
    if (!changesets[0] || !changesets[0].index || !changesets[0].id)
      throw new BentleyError(BentleyStatus.ERROR, `Changeset ${arg.changesetId} not found`);
    return { index: +changesets[0].index, id: changesets[0].id };
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
      return this._getChangesetFromId({ ...arg, changesetId: asOfChangeSetId });

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
  public readonly hubAccess: TestFrontendHubAccess;
  public readonly authClient?: AuthorizationClient; // This should be the new AuthorizationClient method defined in #

  public constructor(authClient?: AuthorizationClient) {
    const iModelClient = new FrontendIModelsClient({ api: { baseUrl: `https://${process.env.IMJS_URL_PREFIX ?? ""}api.bentley.com/imodels`}});
    this.hubAccess = new TestHubFrontend(iModelClient);
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
