/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelConnection, SnapshotConnection } from "@bentley/imodeljs-frontend";
import { SampleAppIModelApp } from "../index";
import { Logger } from "@bentley/bentleyjs-core";

// cSpell:ignore TESTAPP FILEPATH

export class LocalFileSupport {

  public static localFilesSupported = (): boolean => {
    if (!SampleAppIModelApp.testAppConfiguration?.snapshotPath) {
      alert("imjs_TESTAPP_SNAPSHOT_FILEPATH must be set on the backend and point to a folder containing local snapshot files.");
      return false;
    }
    return true;
  };

  public static openLocalFile = async (fileName: string): Promise<IModelConnection | undefined> => {
    // Close the current iModelConnection
    await SampleAppIModelApp.closeCurrentIModel();

    let iModelConnection: IModelConnection | undefined;

    try {
      const filePath = `${SampleAppIModelApp.testAppConfiguration?.snapshotPath}/${fileName}`;

      // open the imodel
      Logger.logInfo("LocalFileSupport", `SnapshotConnection.openFile path=${filePath}`);

      iModelConnection = await SnapshotConnection.openFile(filePath);
    } catch (e) {
      alert(e.message);
      iModelConnection = undefined;
    }
    return iModelConnection;
  };
}
