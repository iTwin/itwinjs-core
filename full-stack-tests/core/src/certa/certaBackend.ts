/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { registerBackendCallback } from "@itwin/certa/lib/utils/CallbackUtils";
import { getTokenCallbackName, verticalCrsChangesCallbackName } from "./certaCommon";
import { ElectronMainAuthorization } from "@itwin/electron-authorization/Main";
import { AccessToken, assert } from "@itwin/core-bentley";
import { BriefcaseDb, BriefcaseManager, IModelHost, withEditTxn } from "@itwin/core-backend";
import { HubMock } from "@itwin/core-backend/lib/cjs/internal/HubMock";
import { GeographicCRS } from "@itwin/core-common";
import { TestUtility } from "../frontend/TestUtility";

// A backend to use within Certa's `backendInitModule` to setup OIDC sign-in

export function exposeBackendCallbacks(){
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

  registerBackendCallback(getTokenCallbackName, async (user: any): Promise<AccessToken> => {
    const accessToken = await TestUtility.getAccessToken(user, {
      clientId: process.env.IMJS_OIDC_ELECTRON_TEST_CLIENT_ID ?? "testClientId",
      redirectUri: process.env.IMJS_OIDC_ELECTRON_TEST_REDIRECT_URI ?? "testRedirectUri",
      scope: process.env.IMJS_OIDC_ELECTRON_TEST_SCOPES ?? "testScope",
    });
    (IModelHost.authorizationClient as ElectronMainAuthorization as any).setAccessToken(accessToken);
    return accessToken;
  });
}
