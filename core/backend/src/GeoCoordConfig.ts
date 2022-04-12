/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { CloudSqlite } from "@bentley/imodeljs-native";
import { BentleyError, Logger } from "@itwin/core-bentley";
import { IModelDb } from "./IModelDb";
import { IModelHost } from "./IModelHost";
import { SettingsPriority } from "./workspace/Settings";
import { WorkspaceContainer, WorkspaceDb } from "./workspace/Workspace";

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
      containerProps.syncOnOpen = true;
      const container = ws.getContainer(containerProps, account);
      const cloudContainer = container.cloudContainer;
      if (!cloudContainer?.isConnected)
        throw new Error("could not connect to GCS Workspace service");

      const wsDbName = container.resolveDbFileName(dbProps);
      IModelHost.platform.addGcsWorkspaceDb(wsDbName, cloudContainer, dbProps.priority);
      if (true === dbProps.prefetch)
        void CloudSqlite.prefetch(cloudContainer, wsDbName); // don't await this promise
    } catch (e: unknown) {
      Logger.logInfo("GeoCoord", BentleyError.getErrorMessage(e));
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
          dbName: "base",
          containerName: "gcs/container",
          version: "^1",
          prefetch: true,
          priority: 0,
        },
        {
          name: "gcs/entire-earth",
          dbName: "earth",
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
