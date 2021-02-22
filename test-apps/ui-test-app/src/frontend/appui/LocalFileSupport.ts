/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BriefcaseConnection, IModelConnection, SnapshotConnection } from "@bentley/imodeljs-frontend";
import { SampleAppIModelApp } from "../index";
import { IModelStatus, Logger, OpenMode, ProcessDetector } from "@bentley/bentleyjs-core";
import { IModelError } from "@bentley/imodeljs-common";

// cSpell:ignore TESTAPP FILEPATH

export class LocalFileSupport {

  public static localFilesSupported = (): boolean => {
    if (!SampleAppIModelApp.testAppConfiguration?.snapshotPath) {
      alert("imjs_TESTAPP_SNAPSHOT_FILEPATH must be set on the backend and point to a folder containing local snapshot files.");
      return false;
    }
    return true;
  };

  public static openLocalFile = async (fileName: string, writable: boolean): Promise<IModelConnection | undefined> => {
    // Close the current iModelConnection
    await SampleAppIModelApp.closeCurrentIModel();

    let iModelConnection: IModelConnection | undefined;
    const filePath = `${SampleAppIModelApp.testAppConfiguration?.snapshotPath}/${fileName}`;

    // Open the iModel
    if (ProcessDetector.isElectronAppFrontend) {
      Logger.logInfo(SampleAppIModelApp.loggerCategory(LocalFileSupport), `openLocalFile: Opening standalone. path=${filePath} writable=${writable}`);
      try {
        iModelConnection = await BriefcaseConnection.openStandalone(filePath, writable ? OpenMode.ReadWrite : OpenMode.Readonly, { key: filePath });
      } catch (err) {
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
      Logger.logInfo(SampleAppIModelApp.loggerCategory(LocalFileSupport), `openLocalFile: Opening snapshot. path=${filePath}`);
      try {
        iModelConnection = await SnapshotConnection.openFile(filePath);
      } catch (err) {
        alert(err.message);
        iModelConnection = undefined;
      }
    }

    return iModelConnection;
  };
}
