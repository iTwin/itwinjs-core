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
import { Settings, SettingsPriority } from "./workspace/Settings";
import { WorkspaceContainer, WorkspaceDb } from "./workspace/Workspace";

const loggerCat = "GeoCoord";

interface GcsDbProps extends WorkspaceDb.Props, WorkspaceContainer.Alias {
  prefetch?: boolean;
  priority?: number;
}

export class GeoCoordConfig {

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

      if (!IModelHost.platform.addGcsWorkspaceDb(gcsDbName, cloudContainer, dbProps.priority))
        return; // already had this db

      if (!ws.settings.getBoolean("gcs/noLogging"))
        Logger.logInfo(loggerCat, `loaded gcsDb "${gcsDbName}", size=${gcsDbProps.totalBlocks}, local=${gcsDbProps.localBlocks}`);

      if (true === dbProps.prefetch)
        void CloudSqlite.prefetch(cloudContainer, gcsDbName); // don't await this promise
    } catch (e: unknown) {
      Logger.logError(loggerCat, BentleyError.getErrorMessage(e));
    }
  }

  private static loadAll(settings: Settings, settingName: string) {
    settings.resolveSetting(settingName, (val) => {
      if (Array.isArray(val)) {
        for (const entry of val) {
          if (typeof entry === "string")
            this.addGcsWorkspace(entry);
        }
      }
      return undefined; // keep going through all dictionaries
    });
  }

  public static loadSettings() {
    const containerName = "gcs/container";
    const version = "^1";
    const allGcsDatabases = [
      { name: "gcs/base", dbName: "base", containerName, version, prefetch: true, priority: 0 },
      { name: "gcs/entire-earth", dbName: "allEarth", containerName, version, prefetch: false, priority: 1000 },
    ];
    ["Australia", "Brazil", "Canada", "France", "Germany", "Japan", "NewZealand", "Portugal", "Slovakia", "SouthAfrica", "Spain", "Switzerland", "UK", "Usa", "Venezuela"]
      .forEach((dbName) => allGcsDatabases.push({ name: `gcs/${dbName}`, dbName, containerName, version, prefetch: false, priority: 500 }));

    const gcsSettings = {
      "workspace/accounts": [{ name: "gcs/account", accessName: "http://gcs-data.itwin.org/", storageType: "azure?customuri=1&sas=1" }],
      "workspace/containers": [{ name: "gcs/container", accountName: "gcs/account", containerId: "gcs" }],
      "workspace/databases": allGcsDatabases,
      "gcs/default/databases": ["gcs/base", "gcs/entire-earth"],
    };

    // add this as a settings dictionary so that it can be overridden externally.
    const settings = IModelHost.appWorkspace.settings;
    settings.addDictionary("gcs-data", SettingsPriority.defaults, gcsSettings);
  }

  private static _isStaticInitialized = false;
  public static staticInit(): void {
    if (!this._isStaticInitialized) {
      this._isStaticInitialized = true;
      this.loadAll(IModelHost.appWorkspace.settings, "gcs/default/databases");
    }
  }

  public static initializeImodel(iModel: IModelDb) {
    this.staticInit();
    this.loadAll(iModel.workspace.settings, "gcs/databases");
  }
}

IModelHost.onAfterStartup.addListener(() => GeoCoordConfig.loadSettings());
