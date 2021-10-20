/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cspell:words buddi urlps

import { Version } from "@bentley/imodelhub-client";
import { IModelHubBackend } from "@bentley/imodelhub-client/lib/cjs/imodelhub-node";
import { BriefcaseDb, BriefcaseManager, IModelHost, NativeHost, RequestNewBriefcaseArg } from "@itwin/core-backend";
import { AccessToken, assert, GuidString } from "@itwin/core-bentley";
import { BriefcaseIdValue, ChangesetId, ChangesetIndex, ChangesetProps } from "@itwin/core-common";
import { ElectronAuthorizationBackend } from "@itwin/core-electron/lib/cjs/ElectronBackend";

export namespace IModelHubUtils {

  export async function getAccessToken(): Promise<AccessToken> {
    return signIn();
  }

  async function signIn(): Promise<AccessToken> {
    const client = new ElectronAuthorizationBackend();
    await client.initialize({
      clientId: process.env.IMJS_OIDC_ELECTRON_TEST_CLIENT_ID ?? "",
      redirectUri: process.env.IMJS_OIDC_ELECTRON_TEST_REDIRECT_URI ?? "",
      scope: process.env.IMJS_OIDC_ELECTRON_TEST_SCOPES ?? "",
    });
    return new Promise<AccessToken>((resolve, reject) => {
      NativeHost.onAccessTokenChanged.addListener((token) => {
        if (token !== "") {
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

  export async function queryIModelId(accessToken: AccessToken, iTwinId: GuidString, iModelName: string): Promise<GuidString | undefined> {
    return IModelHost.hubAccess.queryIModelByName({ accessToken, iTwinId, iModelName });
  }

  /** Temporarily needed to convert from the now preferred ChangesetIndex to the legacy ChangesetId.
   * @note This function should be removed when full support for ChangesetIndex is in place.
   */
  export async function queryChangesetId(accessToken: AccessToken, iModelId: GuidString, changesetIndex: ChangesetIndex): Promise<ChangesetId> {
    return (await IModelHost.hubAccess.queryChangeset({ accessToken, iModelId, changeset: { index: changesetIndex } })).id;
  }

  /** Temporarily needed to convert from the legacy ChangesetId to the now preferred ChangeSetIndex.
   * @note This function should be removed when full support for ChangesetIndex is in place.
   */
  export async function queryChangesetIndex(accessToken: AccessToken, iModelId: GuidString, changesetId: ChangesetId): Promise<ChangesetIndex> {
    return (await IModelHost.hubAccess.queryChangeset({ accessToken, iModelId, changeset: { id: changesetId } })).index;
  }

  /** Call the specified function for each changeset of the specified iModel. */
  export async function forEachChangeset(accessToken: AccessToken, iModelId: GuidString, func: (c: ChangesetProps) => void): Promise<void> {
    const changesets = await IModelHost.hubAccess.queryChangesets({ accessToken, iModelId });
    for (const changeset of changesets) {
      func(changeset);
    }
  }

  /** Call the specified function for each (named) Version of the specified iModel. */
  export async function forEachNamedVersion(accessToken: AccessToken, iModelId: GuidString, func: (v: Version) => void): Promise<void> {
    assert(IModelHost.hubAccess instanceof IModelHubBackend);
    const namedVersions = await IModelHost.hubAccess.iModelClient.versions.get(accessToken, iModelId);
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
