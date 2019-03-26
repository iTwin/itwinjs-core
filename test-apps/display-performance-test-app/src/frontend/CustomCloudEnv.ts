/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { AccessToken, UserInfo, Project } from "@bentley/imodeljs-clients";
import { IModelBankClient } from "@bentley/imodeljs-clients/lib/IModelBank/IModelBankClient";
import { IModelBankFileSystemContextClient } from "@bentley/imodeljs-clients/lib/IModelBank/IModelBankFileSystemContextClient";
import { IModelApp, AuthorizedFrontendRequestContext } from "@bentley/imodeljs-frontend";

// A connection to a non-Connect-hosted project and iModel
export async function initializeCustomCloudEnv(projectName: string | undefined, url: string): Promise<Project | undefined> {
  const id = "user";
  const email = { id: "email@organization.org" };
  const profile = { firstName: "first", lastName: "last" };
  const organization = { id: "organizationId", name: "organization" };
  const featureTracking = { ultimateSite: "ultimateSite", usageCountryIso: "usageCountryIso" };

  const userInfo = new UserInfo(id, email, profile, organization, featureTracking);
  const foreignAccessTokenWrapper: any = {};
  foreignAccessTokenWrapper[AccessToken.foreignProjectAccessTokenJsonProperty] = { userInfo };
  const accessToken = AccessToken.fromForeignProjectAccessTokenJson(JSON.stringify(foreignAccessTokenWrapper));

  if (undefined === projectName)
    projectName = "iModelJsTest";

  const bankContextClient = new IModelBankFileSystemContextClient(url);
  const requestContext = new AuthorizedFrontendRequestContext(accessToken!);

  const project = await bankContextClient.queryContextByName(requestContext, projectName);

  IModelApp.iModelClient = new IModelBankClient(url, undefined);

  return project;
}
