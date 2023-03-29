/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module SQLiteDb
 */

import { join } from "path";
import { NativeLibrary } from "@bentley/imodeljs-native";
import { CloudSqlite } from "./CloudSqlite";
import { IModelHost } from "./IModelHost";
import { IModelJsFs } from "./IModelJsFs";

/** Arguments to create or find a CloudCache
 * @beta
 */
export interface CreateCloudCacheArg {
  /** The name of the CloudCache. Cache names must be unique for a session. */
  cacheName: string,
  /** A string that specifies the maximum size of the CloudCache. It should be a number followed by "K",
   * "M" "G", or "T". Default is "10G". */
  cacheSize?: string,
  /** A local directory in temporary storage for the CloudCache. If not supplied, it is a directory called `cacheName`
   * in the `CloudCaches` temporary directory. */
  cacheDir?: string;
}

export class CloudCaches {
  private static readonly cloudCaches = new Map<string, CloudSqlite.CloudCache>();
  private static initialized = false;

  /** create a new CloudCache */
  private static makeCache(args: CreateCloudCacheArg): CloudSqlite.CloudCache {
    const cacheName = args.cacheName;
    const rootDir = args.cacheDir ?? join(IModelHost.cacheDir, "CloudCaches", cacheName);
    IModelJsFs.recursiveMkDirSync(rootDir);
    const cache = new NativeLibrary.nativeLib.CloudCache({ rootDir, name: cacheName, cacheSize: args.cacheSize ?? "10G" });
    this.cloudCaches.set(cacheName, cache);
    // make sure we destroy all CloudCaches when we shut down.
    if (!this.initialized) {
      this.initialized = true;
      IModelHost.onBeforeShutdown.addOnce(() => {
        this.cloudCaches.forEach((cache) => cache.destroy());
        this.cloudCaches.clear();
      });
    }
    return cache;
  }

  public static getCache(args: CreateCloudCacheArg) {
    return this.cloudCaches.get(args.cacheName) ?? this.makeCache(args);
  }
}

