/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module SQLiteDb
 */

import { IModelHost } from "./IModelHost";
import { IModelJsFs } from "./IModelJsFs";
import { CloudSqlite } from "./CloudSqlite";
import { join } from "path";

export class CloudCaches {
  private static readonly cloudCaches = new Map<string, CloudSqlite.CloudCache>();
  private static initialized = false;

  public static makeCache(cacheName: string, cacheSize?: string): CloudSqlite.CloudCache {
    if (this.cloudCaches.get(cacheName) !== undefined)
      throw new Error(`CloudCache ${cacheName} already exists`);

    const rootDir = join(IModelHost.cacheDir, "CloudCaches", cacheName);
    IModelJsFs.recursiveMkDirSync(rootDir);
    const cache = CloudSqlite.createCloudCache({ rootDir, name: cacheName, cacheSize: cacheSize ?? "10G" });
    this.cloudCaches.set(cacheName, cache);
    if (!this.initialized) {
      this.initialized = true;
      IModelHost.onBeforeShutdown.addOnce(() => {
        this.cloudCaches.forEach((cache) => cache.destroy());
        this.cloudCaches.clear();
      });
    }
    return cache;
  }

  public static getCache(cacheName: string, cacheSize?: string) {
    return this.cloudCaches.get(cacheName) ?? this.makeCache(cacheName, cacheSize);
  }
}

