/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { registerBackendCallback } from "@itwin/vitest-browser-bridge/callbacks/backend";
import { AccessToken, assert } from "@itwin/core-bentley";
import { BriefcaseDb, BriefcaseManager, IModelHost, withEditTxn } from "@itwin/core-backend";
import { HubMock } from "@itwin/core-backend/lib/cjs/internal/HubMock";
import { GeographicCRS } from "@itwin/core-common";
import { ElectronMainAuthorization } from "@itwin/electron-authorization/Main";
import { TestUtility as OidcTestUtility } from "@itwin/oidc-signin-tool";
import type { TestUserCredentials } from "@itwin/oidc-signin-tool/lib/cjs/frontend";
import { getTokenCallbackName, verticalCrsChangesCallbackName } from "../common/testCallbacks";

/** Lets the Electron test backend inject the token it signed in with; `setAccessToken` is protected in the base class. */
export class TestElectronMainAuthorization extends ElectronMainAuthorization {
  public override setAccessToken(token: AccessToken): void {
    super.setAccessToken(token);
  }
}

/** Register backend callbacks used by both the Chromium and Electron test runners.
 * @param electronAuth The Electron backend's authorization client, which serves tokens to the renderer; omit for Chrome.
 */
export function exposeBackendCallbacks(electronAuth?: TestElectronMainAuthorization) {
  let verticalWriter: BriefcaseDb | undefined;
  let verticalReaderFile: string | undefined;
  let savedAuthorizationClient = IModelHost.authorizationClient;
  const writerToken = "vertical CRS writer";
  const readerToken = "vertical CRS reader";
  const cleanupVerticalCrs = async () => {
    const writerFile = verticalWriter?.pathName;
    verticalWriter?.close();
    verticalWriter = undefined;
    try {
      if (writerFile)
        await BriefcaseManager.deleteBriefcaseFiles(writerFile, writerToken);
      if (verticalReaderFile)
        await BriefcaseManager.deleteBriefcaseFiles(verticalReaderFile, readerToken);
    } finally {
      verticalReaderFile = undefined;
      IModelHost.authorizationClient = savedAuthorizationClient;
      HubMock.shutdown();
    }
  };

  registerBackendCallback(verticalCrsChangesCallbackName, async (action: "setup" | "update" | "cleanup"): Promise<string> => {
    if (action === "cleanup") {
      await cleanupVerticalCrs();
      return "";
    }

    if (action === "setup") {
      savedAuthorizationClient = IModelHost.authorizationClient;
      HubMock.startup("FrontendVerticalCrs", IModelHost.cacheDir);
      IModelHost.authorizationClient = { getAccessToken: async () => readerToken };
      try {
        const iTwinId = HubMock.iTwinId;
        const iModelId = await HubMock.createNewIModel({ iTwinId, iModelName: "Frontend Vertical CRS", noLocks: true });
        const writerProps = await BriefcaseManager.downloadBriefcase({ accessToken: writerToken, iTwinId, iModelId });
        verticalWriter = await BriefcaseDb.open({ fileName: writerProps.fileName });
        verticalWriter.setGeographicCoordinateSystem(GeographicCRS.fromJSON({
          horizontalCRS: { id: "LL84" }, verticalCRS: { id: "GEOID", crsName: "EGM96 height" },
        }));
        withEditTxn(verticalWriter, "Set named Vertical CRS", (txn) => txn.updateIModelProps());
        await verticalWriter.pushChanges({ accessToken: writerToken, description: "Set named Vertical CRS" });
        const readerProps = await BriefcaseManager.downloadBriefcase({ accessToken: readerToken, iTwinId, iModelId });
        verticalReaderFile = readerProps.fileName;
        assert(verticalWriter.changeset.index !== undefined);
        return JSON.stringify({ fileName: verticalReaderFile, index: verticalWriter.changeset.index });
      } catch (error) {
        await cleanupVerticalCrs();
        throw error;
      }
    }

    if (!verticalWriter)
      throw new Error("Vertical CRS fixture has not been initialized");

    verticalWriter.setGeographicCoordinateSystem(GeographicCRS.fromJSON({
      horizontalCRS: { id: "LL84" }, verticalCRS: { id: "ELLIPSOID" },
    }));
    withEditTxn(verticalWriter, "Set ellipsoidal Vertical CRS", (txn) => txn.updateIModelProps());
    await verticalWriter.pushChanges({ accessToken: writerToken, description: "Set ellipsoidal Vertical CRS" });
    assert(verticalWriter.changeset.index !== undefined);
    return JSON.stringify({ index: verticalWriter.changeset.index });
  });

  registerBackendCallback(getTokenCallbackName, async (user: TestUserCredentials): Promise<AccessToken> => {
    const accessToken = electronAuth
      ? await OidcTestUtility.getAuthorizationClient(user, {
        clientId: process.env.IMJS_OIDC_ELECTRON_TEST_CLIENT_ID ?? "testClientId",
        redirectUri: process.env.IMJS_OIDC_ELECTRON_TEST_REDIRECT_URI ?? "testRedirectUri",
        scope: process.env.IMJS_OIDC_ELECTRON_TEST_SCOPES ?? "testScope",
      }).getAccessToken()
      : await OidcTestUtility.getAccessToken(user);

    electronAuth?.setAccessToken(accessToken);

    return accessToken;
  });
}
