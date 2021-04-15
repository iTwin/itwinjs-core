/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cspell:words buddi urlps

import { assert, ClientRequestContext, Config, GuidString, Logger } from "@bentley/bentleyjs-core";
import { ElectronAuthorizationBackend } from "@bentley/electron-manager/lib/ElectronBackend";
import { HubIModel, IModelQuery } from "@bentley/imodelhub-client";
import { BriefcaseDb, BriefcaseManager, IModelHost, NativeHost } from "@bentley/imodeljs-backend";
import { BriefcaseIdValue, IModelVersion } from "@bentley/imodeljs-common";
import { AccessToken, AuthorizedClientRequestContext } from "@bentley/itwin-client";

export namespace IModelHubUtils {

  export async function getAuthorizedClientRequestContext(): Promise<AuthorizedClientRequestContext> {
    const accessToken = await signIn();
    return new AuthorizedClientRequestContext(accessToken);
  }

  async function signIn(): Promise<AccessToken> {
    const client = new ElectronAuthorizationBackend();
    const requestContext = new ClientRequestContext();
    await client.initialize(requestContext, {
      clientId: "imodeljs-electron-test",
      redirectUri: "http://localhost:3000/signin-callback",
      scope: "openid email profile organization imodelhub context-registry-service:read-only reality-data:read product-settings-service projectwise-share urlps-third-party imodel-extension-service-api offline_access",
    });
    return new Promise<AccessToken>((resolve, reject) => {
      NativeHost.onUserStateChanged.addListener((token) => {
        if (token !== undefined) {
          resolve(token);
        } else {
          reject(new Error("Failed to sign in"));
        }
      });
      client.signIn().catch((error: Error) => reject(error));
    });
  }

  export function setHubEnvironment(arg?: string): void {
    let value = "0";
    if ("qa" === arg) {
      value = "102";
    } else if ("dev" === arg) {
      value = "103";
    }
    Config.App.set("imjs_buddi_resolve_url_using_region", value);
  }

  export async function queryIModelId(requestContext: AuthorizedClientRequestContext, contextId: GuidString, iModelName: string): Promise<GuidString | undefined> {
    const hubIModel = await queryIModel(requestContext, contextId, iModelName);
    return hubIModel?.id;
  }

  export async function queryIModel(requestContext: AuthorizedClientRequestContext, contextId: string, iModelName: string): Promise<HubIModel | undefined> {
    const hubIModels = await IModelHost.iModelClient.iModels.get(requestContext, contextId, new IModelQuery().byName(iModelName));
    if (hubIModels.length === 0)
      return undefined;
    if (hubIModels.length > 1)
      throw new Error(`Too many iModels with name ${iModelName} found`);
    return hubIModels[0];
  }

  export async function logChangeSets(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, loggerCategory: string): Promise<void> {
    const changeSets = await IModelHost.iModelClient.changeSets.get(requestContext, iModelId);
    Logger.logInfo(loggerCategory, `changeSets.length=${changeSets.length}`);
    if (changeSets.length > 0) {
      for (const changeSet of changeSets) {
        Logger.logInfo(loggerCategory, `id="${changeSet.id}", description="${changeSet.description}", fileSize=${changeSet.fileSizeNumber}`);
      }
    }
  }

  export async function logNamedVersions(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, loggerCategory: string): Promise<void> {
    const namedVersions = await IModelHost.iModelClient.versions.get(requestContext, iModelId);
    Logger.logInfo(loggerCategory, `namedVersions.length=${namedVersions.length}`);
    if (namedVersions.length > 0) {
      for (const namedVersion of namedVersions) {
        Logger.logInfo(loggerCategory, `id="${namedVersion.id}", changeSetId="${namedVersion.changeSetId}", name="${namedVersion.name}"`);
      }
    }
  }

  export async function downloadAndOpenBriefcase(requestContext: AuthorizedClientRequestContext, sourceContextId: GuidString, sourceIModelId: GuidString, asOfVersion: IModelVersion): Promise<BriefcaseDb> {
    const briefcaseProps = await BriefcaseManager.downloadBriefcase(requestContext, {
      contextId: sourceContextId,
      iModelId: sourceIModelId,
      asOf: asOfVersion.toJSON(),
    });
    const briefcaseDb = await BriefcaseDb.open(requestContext, {
      fileName: briefcaseProps.fileName,
    });
    assert(briefcaseDb.contextId === sourceContextId);
    assert(briefcaseDb.iModelId === sourceIModelId);
    assert(briefcaseDb.getBriefcaseId() !== BriefcaseIdValue.Unassigned);
    return briefcaseDb;
  }
}
