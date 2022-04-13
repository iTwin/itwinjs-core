/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

// cspell:ignore customuri

import { CloudSqlite } from "@bentley/imodeljs-native";
import { BentleyError, Logger } from "@itwin/core-bentley";
import { IModelDb } from "./IModelDb";
import { IModelHost } from "./IModelHost";
import { SettingsPriority } from "./workspace/Settings";
import { WorkspaceContainer, WorkspaceDb } from "./workspace/Workspace";

const loggerCat = "GeoCoord";

interface GcsDbProps extends WorkspaceDb.Props, WorkspaceContainer.Alias {
  prefetch?: boolean;
  priority?: number;
}

export class GeoCoordConfig {
  private static _isStaticInitialized = false;

  private static addGcsWorkspace(gcsDbAlias: string) {
    try {
      const ws = IModelHost.appWorkspace;
      const dbProps = ws.resolveDatabase(gcsDbAlias) as GcsDbProps;
      const containerProps = ws.resolveContainer(dbProps.containerName);
      const account = ws.resolveAccount(containerProps.accountName);
      containerProps.syncOnConnect = true;
      const container = ws.getContainer(containerProps, account);
      const cloudContainer = container.cloudContainer;
      if (!cloudContainer?.isConnected) {
        Logger.logInfo("GeoCoord", `could not load gcs database "${gcsDbAlias}"`);
        return;
      }

      const gcsDbName = container.resolveDbFileName(dbProps);
      const gcsDbProps = cloudContainer.queryDatabase(gcsDbName);
      if (undefined === gcsDbProps)
        throw new Error(`database "${gcsDbName}" not found in container "${containerProps.containerId}"`);

      if (!ws.settings.getBoolean("gcs/noLogging"))
        Logger.logInfo(loggerCat, `loaded gcsDb "${gcsDbName}", size=${gcsDbProps.totalBlocks}, local=${gcsDbProps.localBlocks}`);

      IModelHost.platform.addGcsWorkspaceDb(gcsDbName, cloudContainer, dbProps.priority);
      if (true === dbProps.prefetch)
        void CloudSqlite.prefetch(cloudContainer, gcsDbName); // don't await this promise
    } catch (e: unknown) {
      Logger.logError(loggerCat, BentleyError.getErrorMessage(e));
    }
  }

  public static staticInit() {
    if (this._isStaticInitialized)
      return;
    this._isStaticInitialized = true;

    const gcsSettings = {
      "workspace/accounts": [
        {
          name: "gcs/account",
          accessName: "http://gcs-data.itwin.org/",
          storageType: "azure?customuri=1&sas=1",
        },
      ],
      "workspace/containers": [
        {
          name: "gcs/container",
          accountName: "gcs/account",
          containerId: "gcs",
        },
      ],
      "workspace/databases": [
        {
          name: "gcs/base",
          dbName: "baseGCS",
          containerName: "gcs/container",
          version: "^1",
          prefetch: true,
          priority: 0,
        },
        {
          name: "gcs/entire-earth",
          dbName: "allEarth",
          containerName: "gcs/container",
          version: "^1",
          prefetch: false,
          priority: 1000,
        },
      ],
    };
    // add this as a settings dictionary so that it can be overridden externally.
    IModelHost.appWorkspace.settings.addDictionary("gcs-data", SettingsPriority.defaults, gcsSettings);
    this.addGcsWorkspace("gcs/base");
    this.addGcsWorkspace("gcs/entire-earth");
  }

  private _initialized = false;
  public initialize(iModel: IModelDb) {
    if (this._initialized)
      return;
    this._initialized = true;

    GeoCoordConfig.staticInit();
    iModel.workspace.settings.resolveSetting("gcs/databases", (val) => {
      if (Array.isArray(val)) {
        for (const entry of val) {
          if (typeof entry === "string")
            GeoCoordConfig.addGcsWorkspace(entry);
        }
      }
      return undefined; // keep going through all dictionaries
    });
  }
}
