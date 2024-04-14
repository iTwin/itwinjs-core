/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { BentleyError, Logger } from "@itwin/core-bentley";
import { CloudSqlite } from "./CloudSqlite";
import { IModelHost } from "./IModelHost";
import { Settings } from "./workspace/Settings";
import { WorkspaceContainer, WorkspaceDb } from "./workspace/Workspace";

const loggerCat = "GeoCoord";

interface GcsDbProps extends WorkspaceDb.Props, WorkspaceContainer.Props {
  priority?: number;
}
const makeSettingName = (name: string) => `${"itwin/core/gcs"}/${name}`;

/**
 * Internal class to configure and load the gcs workspaces for an iModel.
 * @internal
 */
export class GeoCoordConfig {
  /** array of cloud prefetch tasks that may be awaited to permit offline usage */
  public static readonly prefetches: CloudSqlite.CloudPrefetch[] = [];
  public static readonly settingName = {
    databases: makeSettingName("databases"),
    defaultDatabases: makeSettingName("default/databases"),
  };

  private static addGcsWorkspace(dbProps: GcsDbProps) {
    // override to disable loading GCS data from workspaces
    if (IModelHost.appWorkspace.settings.getBoolean("itwin/core/gcs/disableWorkspaces", false))
      return;

    try {
      const ws = IModelHost.appWorkspace;
      const container = ws.getContainer(dbProps);
      const cloudContainer = container.cloudContainer;
      if (!cloudContainer?.isConnected) {
        Logger.logError("GeoCoord", `could not load gcs database "${dbProps.dbName}"`);
        return;
      }

      const gcsDbName = container.resolveDbFileName(dbProps);
      const gcsDbProps = cloudContainer.queryDatabase(gcsDbName);
      if (undefined === gcsDbProps)
        throw new Error(`database "${gcsDbName}" not found in container "${dbProps.containerId}"`);

      if (!IModelHost.platform.addGcsWorkspaceDb(gcsDbName, cloudContainer, dbProps.priority))
        return; // already had this db

      Logger.logInfo(loggerCat, `loaded gcsDb "${gcsDbName}", from "${dbProps.baseUri}/${dbProps.containerId}" size=${gcsDbProps.totalBlocks}, local=${gcsDbProps.localBlocks}`);

      if (true === dbProps.prefetch)
        this.prefetches.push(CloudSqlite.startCloudPrefetch(cloudContainer, gcsDbName));

    } catch (e: any) {
      let msg = `Cannot load GCS workspace (${e.errorNumber}): ${BentleyError.getErrorMessage(e)}`;
      msg += `,container=${dbProps.baseUri}/${dbProps.containerId}, storage=${dbProps.storageType}, public=${dbProps.isPublic}, cacheDir=${IModelHost.cacheDir}`;
      Logger.logError(loggerCat, msg);
    }
  }

  private static loadAll(settings: Settings, settingName: string) {
    const dbProps = settings.getArray<GcsDbProps>(settingName);
    if (dbProps) {
      for (const entry of dbProps) {
        this.addGcsWorkspace(entry);
      }
    }
  }

  private static _defaultDbsLoaded = false;
  public static onStartup() {
    this._defaultDbsLoaded = false;
    this.prefetches.length = 0;
  }

  public static loadDefaultDatabases(): void {
    if (!this._defaultDbsLoaded) {
      this._defaultDbsLoaded = true;
      this.loadAll(IModelHost.appWorkspace.settings, this.settingName.defaultDatabases);
    }
  }

  public static loadForImodel(settings: Settings) {
    this.loadDefaultDatabases();
    this.loadAll(settings, this.settingName.databases);
  }
}
