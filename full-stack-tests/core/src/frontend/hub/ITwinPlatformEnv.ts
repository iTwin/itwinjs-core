/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AccessToken, GuidString } from "@itwin/core-bentley";
import { AuthorizationClient, BriefcaseId } from "@itwin/core-common";
import { FrontendHubAccess, IModelIdArg } from "@itwin/core-frontend";
import { AccessTokenAdapter, FrontendIModelsAccess } from "@itwin/imodels-access-frontend";
import { IModelsClient as AuthorIModelsClient, Briefcase, GetBriefcaseListParams, GetIModelListParams, IModelScopedOperationParams, MinimalIModel, ReleaseBriefcaseParams, SPECIAL_VALUES_ME, toArray } from "@itwin/imodels-client-authoring";
import { IModelsClient as FrontendIModelsClient } from "@itwin/imodels-client-management";
import { ITwinAccessClientWrapper } from "../../common/ITwinAccessClientWrapper.js";

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
        iTwinId: arg.iTwinId,
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
