/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cspell:words buddi urlps

import { assert, Config, GuidString } from "@bentley/bentleyjs-core";
import { ElectronAuthorizationBackend } from "@bentley/electron-manager/lib/ElectronBackend";
import { BriefcaseQuery, ChangeSet, HubIModel, IModelQuery, Version } from "@bentley/imodelhub-client";
import { BriefcaseDb, BriefcaseManager, IModelHost, IModelJsFs, NativeHost, RequestNewBriefcaseArg } from "@bentley/imodeljs-backend";
import { BriefcaseIdValue, IModelVersion } from "@bentley/imodeljs-common";
import { AccessToken, AuthorizedClientRequestContext } from "@bentley/itwin-client";

export namespace IModelHubUtils {

  export async function getAuthorizedClientRequestContext(): Promise<AuthorizedClientRequestContext> {
    const accessToken = await signIn();
    return new AuthorizedClientRequestContext(accessToken);
  }

  async function signIn(): Promise<AccessToken> {
    const client = new ElectronAuthorizationBackend();
    await client.initialize({
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

  /** Call the specified function for each changeSet of the specified iModel. */
  export async function forEachChangeSet(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, func: (c: ChangeSet) => void): Promise<void> {
    const changeSets = await IModelHost.iModelClient.changeSets.get(requestContext, iModelId);
    for (const changeSet of changeSets) {
      func(changeSet);
    }
  }

  /** Call the specified function for each (named) Version of the specified iModel. */
  export async function forEachNamedVersion(requestContext: AuthorizedClientRequestContext, iModelId: GuidString, func: (v: Version) => void): Promise<void> {
    const namedVersions = await IModelHost.iModelClient.versions.get(requestContext, iModelId);
    for (const namedVersion of namedVersions) {
      func(namedVersion);
    }
  }

  export async function downloadAndOpenBriefcase(requestContext: AuthorizedClientRequestContext, briefcaseArg: RequestNewBriefcaseArg): Promise<BriefcaseDb> {
    let briefcaseQuery = new BriefcaseQuery().ownedByMe();
    if (briefcaseArg.briefcaseId) {
      briefcaseQuery = briefcaseQuery.filter(`BriefcaseId+eq+${briefcaseArg.briefcaseId}`);
    }
    const briefcases = await IModelHost.iModelClient.briefcases.get(requestContext, briefcaseArg.iModelId, briefcaseQuery);
    if (0 === briefcases.length) {
      const briefcaseProps = await BriefcaseManager.downloadBriefcase(requestContext, briefcaseArg);
      return BriefcaseDb.open(requestContext, {
        fileName: briefcaseProps.fileName,
        readonly: briefcaseArg.briefcaseId ? briefcaseArg.briefcaseId === BriefcaseIdValue.Unassigned : false,
      });
    }

    let briefcaseFileName: string | undefined;
    for (const briefcase of briefcases) {
      assert(briefcase.briefcaseId !== undefined);
      briefcaseFileName = BriefcaseManager.getFileName({
        iModelId: briefcaseArg.iModelId,
        briefcaseId: briefcase.briefcaseId,
      });
      if (IModelJsFs.existsSync(briefcaseFileName)) {
        break;
      }
    }

    if (undefined === briefcaseFileName) {
      throw new Error();
    }

    const briefcaseDb = await BriefcaseDb.open(requestContext, {
      fileName: briefcaseFileName,
      readonly: briefcaseArg.briefcaseId ? briefcaseArg.briefcaseId === BriefcaseIdValue.Unassigned : undefined,
    });
    const asOf = briefcaseArg.asOf?.afterChangeSetId ? IModelVersion.asOfChangeSet(briefcaseArg.asOf.afterChangeSetId) : IModelVersion.latest();
    await briefcaseDb.pullAndMergeChanges(requestContext, asOf);
    return briefcaseDb;
  }
}
