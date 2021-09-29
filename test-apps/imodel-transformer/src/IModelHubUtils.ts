/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cspell:words buddi urlps

import { AccessToken, GuidString } from "@itwin/core-bentley";
import { ElectronAuthorizationBackend } from "@itwin/electron-manager/lib/ElectronBackend";
import { Version } from "@bentley/imodelhub-client";
import { BriefcaseDb, BriefcaseManager, IModelHost, IModelHubBackend, NativeHost, RequestNewBriefcaseArg } from "@itwin/core-backend";
import { BriefcaseIdValue, ChangesetId, ChangesetIndex, ChangesetProps } from "@itwin/core-common";

export namespace IModelHubUtils {

  export async function getAccessToken(): Promise<AccessToken> {
    return signIn();
  }

  async function signIn(): Promise<AccessToken> {
    const client = new ElectronAuthorizationBackend();
    await client.initialize({
      clientId: "imodeljs-electron-test",
      redirectUri: "http://localhost:3000/signin-callback",
      scope: "openid email profile organization itwinjs",
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
    process.env.IMJS_URL_PREFOX = `${"prod" === arg ? "" : arg}-`;
  }

  export async function queryIModelId(user: AccessToken, iTwinId: GuidString, iModelName: string): Promise<GuidString | undefined> {
    return IModelHost.hubAccess.queryIModelByName({ user, iTwinId, iModelName });
  }

  /** Temporarily needed to convert from the now preferred ChangesetIndex to the legacy ChangesetId.
   * @note This function should be removed when full support for ChangesetIndex is in place.
   */
  export async function queryChangesetId(user: AccessToken, iModelId: GuidString, changesetIndex: ChangesetIndex): Promise<ChangesetId> {
    return (await IModelHost.hubAccess.queryChangeset({ user, iModelId, changeset: { index: changesetIndex } })).id;
  }

  /** Temporarily needed to convert from the legacy ChangesetId to the now preferred ChangeSetIndex.
   * @note This function should be removed when full support for ChangesetIndex is in place.
   */
  export async function queryChangesetIndex(user: AccessToken, iModelId: GuidString, changesetId: ChangesetId): Promise<ChangesetIndex> {
    return (await IModelHost.hubAccess.queryChangeset({ user, iModelId, changeset: { id: changesetId } })).index;
  }

  /** Call the specified function for each changeset of the specified iModel. */
  export async function forEachChangeset(user: AccessToken, iModelId: GuidString, func: (c: ChangesetProps) => void): Promise<void> {
    const changesets = await IModelHost.hubAccess.queryChangesets({ user, iModelId });
    for (const changeset of changesets) {
      func(changeset);
    }
  }

  /** Call the specified function for each (named) Version of the specified iModel. */
  export async function forEachNamedVersion(requestContext: AccessToken, iModelId: GuidString, func: (v: Version) => void): Promise<void> {
    const namedVersions = await IModelHubBackend.iModelClient.versions.get(requestContext, iModelId);
    for (const namedVersion of namedVersions) {
      func(namedVersion);
    }
  }

  export async function downloadAndOpenBriefcase(briefcaseArg: RequestNewBriefcaseArg): Promise<BriefcaseDb> {
    const briefcaseProps = await BriefcaseManager.downloadBriefcase(briefcaseArg);
    return BriefcaseDb.open({
      fileName: briefcaseProps.fileName,
      readonly: briefcaseArg.briefcaseId ? briefcaseArg.briefcaseId === BriefcaseIdValue.Unassigned : false,
    });
  }
}
