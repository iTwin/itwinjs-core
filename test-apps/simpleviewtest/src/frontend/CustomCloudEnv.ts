/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { AccessToken, UserProfile } from "@bentley/imodeljs-clients";
import { IModelBankClient } from "@bentley/imodeljs-clients/lib/IModelBank/IModelBankClient";
import { IModelBankFileSystemContextClient } from "@bentley/imodeljs-clients/lib/IModelBank/IModelBankFileSystemContextClient";
import { SimpleViewState } from "./SimpleViewState";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";

// A connection to a non-Connect-hosted project and iModel
export async function initializeCustomCloudEnv(state: SimpleViewState, url: string): Promise<void> {
  const userProfile = new UserProfile("first", "last", "email@organization.org", state.projectConfig!.userName, "organization", "organizationId", "ultimateSite", "usageCountryIso");
  const foreignAccessTokenWrapper: any = {};
  foreignAccessTokenWrapper[AccessToken.foreignProjectAccessTokenJsonProperty] = { userProfile };
  state.accessToken = AccessToken.fromForeignProjectAccessTokenJson(JSON.stringify(foreignAccessTokenWrapper));

  const bankContextClient = new IModelBankFileSystemContextClient(url);
  state.project = await bankContextClient.queryContextByName(new ActivityLoggingContext(""), state.accessToken!, state.projectConfig!.projectName);

  IModelApp.iModelClient = new IModelBankClient(url, undefined);
}
