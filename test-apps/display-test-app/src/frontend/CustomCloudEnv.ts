/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { AccessToken, UserInfo, IModelBankClient, IModelBankFileSystemContextClient } from "@bentley/imodeljs-clients";
import { SimpleViewState } from "./SimpleViewState";
import { IModelApp, AuthorizedFrontendRequestContext } from "@bentley/imodeljs-frontend";

// A connection to a non-Connect-hosted project and iModel
export async function initializeCustomCloudEnv(state: SimpleViewState, url: string): Promise<void> {
  const id = "user";
  const email = { id: "email@organization.org" };
  const profile = { firstName: "first", lastName: "last" };
  const organization = { id: "organizationId", name: "organization" };
  const featureTracking = { ultimateSite: "ultimateSite", usageCountryIso: "usageCountryIso" };

  const userInfo = new UserInfo(id, email, profile, organization, featureTracking);
  const foreignAccessTokenWrapper: any = {};
  foreignAccessTokenWrapper[AccessToken.foreignProjectAccessTokenJsonProperty] = { userInfo };
  state.accessToken = AccessToken.fromForeignProjectAccessTokenJson(JSON.stringify(foreignAccessTokenWrapper));

  const projectName = state.projectConfig ? state.projectConfig.projectName || "iModelJsTest" : "iModelJsTest";
  const bankContextClient = new IModelBankFileSystemContextClient(url);
  const requestContext = new AuthorizedFrontendRequestContext(state.accessToken!);

  state.project = await bankContextClient.queryContextByName(requestContext, projectName);

  (IModelApp as any)._iModelClient = new IModelBankClient(url, undefined);
}
