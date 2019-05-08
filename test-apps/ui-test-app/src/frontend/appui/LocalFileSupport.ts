/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IModelConnection } from "@bentley/imodeljs-frontend";

import { testAppConfiguration, SampleAppIModelApp } from "../index";

// cSpell:ignore TESTAPP FILEPATH

export class LocalFileSupport {

  public static localFilesSupported = (): boolean => {
    if (!testAppConfiguration.snapshotPath) {
      alert("TESTAPP_SNAPSHOT_FILEPATH must be set on the backend and point to a folder containing local snapshot files.");
      return false;
    }

    return true;
  }

  public static openLocalFile = async (fileName: string): Promise<IModelConnection | undefined> => {
    // Close the current iModelConnection
    await SampleAppIModelApp.closeCurrentIModel();

    let iModelConnection: IModelConnection | undefined;

    try {
      const filePath = testAppConfiguration.snapshotPath + "/" + fileName;
      iModelConnection = await IModelConnection.openSnapshot(filePath);
    } catch (e) {
      alert(e.message);
      iModelConnection = undefined;
    }

    return iModelConnection;
  }

}
