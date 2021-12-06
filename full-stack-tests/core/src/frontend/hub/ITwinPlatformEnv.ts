/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AccessToken, BentleyError, BentleyStatus, GuidString } from "@itwin/core-bentley";
import { Project as ITwin } from "@itwin/projects-client";
import { AuthorizationClient, BriefcaseId, ChangesetId, IModelVersion } from "@itwin/core-common";
import { FrontendHubAccess, IModelIdArg } from "@itwin/core-frontend";
import { FrontendiModelsAccess } from "@itwin/imodels-access-frontend";
import { IModelQuery, VersionQuery } from "@itwin/imodels-client-management";
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

/** Defines a base set of the set of Simple base interface for the client implementations that will be passed to the IModelApp. */
export interface ITwinPlatformAbstraction {
  readonly hubAccess: TestFrontendHubAccess;
  readonly iTwinMgr: ITwinAccessClientWrapper;
  readonly authClient?: AuthorizationClient;
}

/** A convenient wrapper that includes a default set of clients necessary to configure an iTwin.js application for the iTwin Platform. */
export class ITwinPlatformCloudEnv implements ITwinPlatformAbstraction {
  public readonly iTwinMgr = new ITwinAccessClientWrapper(); // this should be the new ITwinRegistryWrapper defined in #2045
  public readonly hubAccess = new FrontendiModelsAccess();
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

