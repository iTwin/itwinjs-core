/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { CloudSqlite } from "@bentley/imodeljs-native";
import { Logger } from "@itwin/core-bentley";
import { IModelHost } from "./IModelHost";
import { SettingsPriority } from "./workspace/Settings";

IModelHost.onAfterStartup.addListener(() => {
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
        account: "gcs/account",
        id: "gcs",
      },
    ],
    "workspace/databases": [
      {
        name: "gcs/base",
        dbName: "base",
        containerName: "gcs/container",
        version: "^1",
      },
      {
        name: "gcs/entire-earth",
        dbName: "entireEarth",
        containerName: "gcs/container",
        version: "^1",
      },
    ],
  };

  IModelHost.appWorkspace.settings.addDictionary("gcs-data", SettingsPriority.defaults, gcsSettings);
});

export class GeoCoordConfig {
  private _initialized = false;
  private async addGcsWorkspace(wsName: string, prefetch: boolean) {
    const dbProps = IModelHost.appWorkspace.resolveDatabase(wsName);
    const container = IModelHost.appWorkspace.getContainer(dbProps);
    const cloudContainer = container.cloudContainer;
    if (cloudContainer) {
      try {
        await cloudContainer.checkForChanges();
      } catch (e: unknown) {
        Logger.logInfo("geocoord", "check for updates to GCS Workspace failed");
      }
      const wsDbName = container.resolveDbFileName(dbProps);
      IModelHost.platform.addGcsWorkspaceDb(wsDbName, cloudContainer);
      if (prefetch)
        void CloudSqlite.prefetch(cloudContainer, wsDbName); // don't await this promise
    }
  }

  public async initialize() {
    if (!this._initialized) {
      await this.addGcsWorkspace("gcs/entire-earth", false);
      await this.addGcsWorkspace("gcs/base", true);
      this._initialized = true;
    }
  }
}
