/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BriefcaseConnection, IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { SampleAppIModelApp } from "../index";
import { IModelStatus, Logger, OpenMode } from "@itwin/core-bentley";
import { IModelError } from "@itwin/core-common";
import { ElectronApp } from "@itwin/core-electron/lib/cjs/ElectronFrontend";

// cSpell:ignore TESTAPP FILEPATH

export class LocalFileSupport {

  public static localFilesSupported = (): boolean => {
    if (ElectronApp.isValid)
      return true;

    if (!SampleAppIModelApp.testAppConfiguration?.snapshotPath) {
      alert("IMJS_UITESTAPP_SNAPSHOT_FILEPATH must be set on the backend and point to a folder containing local snapshot files.");
      return false;
    }

    return true;
  };

  public static openLocalFile = async (fileSpec: string, writable: boolean): Promise<IModelConnection | undefined> => {
    // Close the current iModelConnection
    await SampleAppIModelApp.closeCurrentIModel();

    let iModelConnection: IModelConnection | undefined;
    let filePath = "";

    // Open the iModel
    if (ElectronApp.isValid) {
      filePath = fileSpec;
      Logger.logInfo(SampleAppIModelApp.loggerCategory(LocalFileSupport), `openLocalFile: Opening standalone. path=${filePath} writable=${writable}`);
      try {
        iModelConnection = await BriefcaseConnection.openStandalone(filePath, writable ? OpenMode.ReadWrite : OpenMode.Readonly, { key: filePath });
      } catch (err: any) {
        Logger.logError(SampleAppIModelApp.loggerCategory(LocalFileSupport), `openLocalFile: BriefcaseConnection.openStandalone failed.`);

        if (writable && err instanceof IModelError && err.errorNumber === IModelStatus.ReadOnly) {
          iModelConnection = await SnapshotConnection.openFile(filePath);
          alert(`Local file (${filePath}) could not be opened as writable. Special bytes are required in the props table of the iModel to make it editable. File opened as read-only instead.`);
        } else {
          alert(err.message);
          iModelConnection = undefined;
        }
      }
    } else {
      filePath = `${SampleAppIModelApp.testAppConfiguration?.snapshotPath}/${fileSpec}`;
      Logger.logInfo(SampleAppIModelApp.loggerCategory(LocalFileSupport), `openLocalFile: Opening snapshot. path=${filePath}`);
      try {
        iModelConnection = await SnapshotConnection.openFile(filePath);
      } catch (err: any) {
        alert(err.message);
        iModelConnection = undefined;
      }
    }

    return iModelConnection;
  };
}
