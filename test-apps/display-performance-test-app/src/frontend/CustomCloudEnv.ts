/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { AccessToken, UserInfo } from "@bentley/imodeljs-clients";
import { IModelBankClient } from "@bentley/imodeljs-clients/lib/IModelBank/IModelBankClient";
import { IModelBankFileSystemContextClient } from "@bentley/imodeljs-clients/lib/IModelBank/IModelBankFileSystemContextClient";
import { SimpleViewState } from "./SimpleViewState";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";

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

  const bankContextClient = new IModelBankFileSystemContextClient(url);
  state.project = await bankContextClient.queryContextByName(new ActivityLoggingContext(""), state.accessToken!, state.projectConfig!.projectName);

  IModelApp.iModelClient = new IModelBankClient(url, undefined);
}
