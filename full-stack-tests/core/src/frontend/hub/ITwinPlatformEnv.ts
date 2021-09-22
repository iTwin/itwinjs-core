/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BentleyError, BentleyStatus, GuidString } from "@bentley/bentleyjs-core";
import { Project } from "@bentley/context-registry-client";
import { FrontendAuthorizationClient } from "@bentley/frontend-authorization-client";
import {
  BriefcaseQuery,
  ChangeSet, ChangeSetQuery, IModelBankClient, IModelBankFileSystemContextClient, IModelHubFrontend, IModelQuery, VersionQuery,
} from "@bentley/imodelhub-client";
import { BriefcaseId, IModelVersion } from "@bentley/imodeljs-common";
import { ChangeSetId, FrontendHubAccess, IModelIdArg } from "@bentley/imodeljs-frontend";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { ContextRegistryClientWrapper } from "../../common/ContextRegistryClientWrapper";

export interface IModelNameArg {
  readonly iModelName: string;
  readonly iTwinId: GuidString;
  readonly requestContext: AuthorizedClientRequestContext;
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

  public async getLatestChangesetId(arg: IModelIdArg): Promise<ChangeSetId> {
    const changeSets: ChangeSet[] = await this._hubClient.changeSets.get(arg.requestContext, arg.iModelId, new ChangeSetQuery().top(1).latest());
    return (changeSets.length === 0) ? "" : changeSets[changeSets.length - 1].wsgId;
  }

  public async getChangesetIdFromVersion(arg: IModelIdArg & { version: IModelVersion }): Promise<ChangeSetId> {
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

  public async getChangesetIdFromNamedVersion(arg: IModelIdArg & { versionName: string }): Promise<ChangeSetId> {
    const versions = await this._hubClient.versions.get(arg.requestContext, arg.iModelId, new VersionQuery().select("ChangeSetId").byName(arg.versionName));
    if (!versions[0] || !versions[0].changeSetId)
      throw new BentleyError(BentleyStatus.ERROR, `Named version ${arg.versionName} not found`);
    return versions[0].changeSetId;
  }

  /** Get the iModelId of an iModel by name. Undefined if no iModel with that name exists.  */
  public async queryIModelByName(arg: IModelNameArg): Promise<GuidString | undefined> {
    const iModels = await this._hubClient.iModels.get(arg.requestContext, arg.iTwinId, new IModelQuery().byName(arg.iModelName));
    return iModels.length === 0 ? undefined : iModels[0].id!;
  }

  public async getMyBriefcaseIds(arg: IModelIdArg): Promise<number[]> {
    const myHubBriefcases = await this._hubClient.briefcases.get(arg.requestContext, arg.iModelId, new BriefcaseQuery().ownedByMe().selectDownloadUrl());
    const myBriefcaseIds: number[] = [];
    for (const hubBc of myHubBriefcases)
      myBriefcaseIds.push(hubBc.briefcaseId!); // save the list of briefcaseIds we already own.
    return myBriefcaseIds;
  }

  public async releaseBriefcase(arg: BriefcaseIdArg): Promise<void> {
    await this._hubClient.briefcases.delete(arg.requestContext, arg.iModelId, arg.briefcaseId);
  }
}

/** Defines a base set of the set of Simple base interface for the client implementations that will be passed to the IModelApp. */
export interface ITwinPlatformAbstraction {
  readonly hubAccess: TestFrontendHubAccess;
  readonly contextMgr: ContextRegistryClientWrapper;
  readonly authClient?: FrontendAuthorizationClient;
}

/** A convenient wrapper that includes a default set of clients necessary to configure an iTwin.js application for the iTwin Platform. */
export class ITwinPlatformCloudEnv implements ITwinPlatformAbstraction {
  public readonly contextMgr = new ContextRegistryClientWrapper(); // this should be the new ContextRegistryWrapper defined in #2045
  public readonly hubAccess = new IModelHubFrontend();
  public readonly authClient?: FrontendAuthorizationClient; // This should be the new AuthorizationClient method defined in #

  public constructor(authClient?: FrontendAuthorizationClient) {
    this.authClient = authClient;
  }
}

/** A convenient wrapper that includes a default set of clients necessary to configure an iTwin.js application for the iTwin Stack. */
export class ITwinStackCloudEnv implements ITwinPlatformAbstraction {
  public readonly contextMgr: IModelBankFileSystemContextClient;
  public readonly hubAccess: TestFrontendHubAccess;
  public readonly authClient?: FrontendAuthorizationClient;

  public constructor(orchestratorUrl: string, authClient?: FrontendAuthorizationClient) {
    this.hubAccess = new IModelBankFrontend(orchestratorUrl);
    this.contextMgr = new IModelBankFileSystemContextClient(orchestratorUrl);
    this.authClient = authClient;
  }

  public async bootstrapIModelBankProject(requestContext: AuthorizedClientRequestContext, projectName: string): Promise<void> {
    let project: Project | undefined = await this.contextMgr.queryProjectByName(requestContext, projectName);
    if (project !== undefined)
      await this.contextMgr.deleteContext(requestContext, project.ecId);
    await this.contextMgr.createContext(requestContext, projectName);
  }
}

