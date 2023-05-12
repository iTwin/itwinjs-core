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

interface GcsDbProps extends WorkspaceDb.Props, WorkspaceContainer.Alias {
  prefetch?: boolean;
  priority?: number;
}

/**
 * Internal class to configure and load the gcs workspaces for an iModel.
 * @internal
 */
export class GeoCoordConfig {
  /** array of cloud prefetch tasks that may be awaited to permit offline usage */
  public static readonly prefetches: CloudSqlite.CloudPrefetch[] = [];

  private static addGcsWorkspace(gcsDbAlias: string) {
    // override to disable loading GCS data from workspaces
    if (IModelHost.appWorkspace.settings.getBoolean("gcs/disableWorkspaces", false))
      return;

    let containerProps: WorkspaceContainer.Props | undefined;
    try {
      const ws = IModelHost.appWorkspace;
      const dbProps = ws.resolveDatabase(gcsDbAlias) as GcsDbProps;
      containerProps = ws.resolveContainer(dbProps.containerName);
      const container = ws.getContainer(containerProps);
      const cloudContainer = container.cloudContainer;
      if (!cloudContainer?.isConnected) {
        Logger.logError("GeoCoord", `could not load gcs database "${gcsDbAlias}"`);
        return;
      }

      const gcsDbName = container.resolveDbFileName(dbProps);
      const gcsDbProps = cloudContainer.queryDatabase(gcsDbName);
      if (undefined === gcsDbProps)
        throw new Error(`database "${gcsDbName}" not found in container "${containerProps.containerId}"`);

      if (!IModelHost.platform.addGcsWorkspaceDb(gcsDbName, cloudContainer, dbProps.priority))
        return; // already had this db

      if (IModelHost.appWorkspace.settings.getBoolean("gcs/noLocalData", false))
        IModelHost.platform.enableLocalGcsFiles(false);

      Logger.logInfo(loggerCat, `loaded gcsDb "${gcsDbName}", from "${containerProps.baseUri}/${containerProps.containerId}" size=${gcsDbProps.totalBlocks}, local=${gcsDbProps.localBlocks}`);

      if (true === dbProps.prefetch)
        this.prefetches.push(CloudSqlite.startCloudPrefetch(cloudContainer, gcsDbName));

    } catch (e: any) {
      let msg = `Cannot load GCS workspace (${e.errorNumber}): ${BentleyError.getErrorMessage(e)}`;
      if (containerProps)
        msg += `,container=${containerProps.baseUri}/${containerProps.containerId}, storage=${containerProps.storageType}, public=${containerProps.isPublic}, cacheDir=${IModelHost.cacheDir}`;
      Logger.logError(loggerCat, msg);
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

  private static _defaultDbsLoaded = false;
  public static onStartup() {
    this._defaultDbsLoaded = false;
    this.prefetches.length = 0;
  }

  public static loadDefaultDatabases(): void {
    if (!this._defaultDbsLoaded) {
      this._defaultDbsLoaded = true;
      this.loadAll(IModelHost.appWorkspace.settings, "gcs/default/databases");
    }
  }

  public static loadForImodel(settings: Settings) {
    this.loadDefaultDatabases();
    this.loadAll(settings, "gcs/databases");
  }
}
