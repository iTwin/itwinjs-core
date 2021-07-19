/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { OpenMode } from "@bentley/bentleyjs-core";
import { ContextRegistryClient } from "@bentley/context-registry-client";
import { IModelHost, IModelHostConfiguration, KnownLocations, SnapshotDb, StandaloneDb } from "@bentley/imodeljs-backend";
import { IModelJsFs, IModelJsFsStats } from "@bentley/imodeljs-backend/lib/IModelJsFs";
import { IModelReadRpcInterface, RpcManager } from "@bentley/imodeljs-common";

RpcManager.initializeInterface(IModelReadRpcInterface);

export interface IModelTestUtilsOpenOptions {
  copyFilename?: string;
}

export class KnownTestLocations {

  /** The directory where test assets are stored. Keep in mind that the test is playing the role of the app. */
  public static get assetsDir(): string {
    // Assume that we are running in nodejs
    return path.join(__dirname, "assets");
  }

  /** The directory where tests can write. */
  public static get outputDir(): string {
    // Assume that we are running in nodejs
    return path.join(__dirname, "output");
  }

}

export class IModelTestUtils {

  private static _connectClient: ContextRegistryClient | undefined;
  public static get connectClient(): ContextRegistryClient {
    if (!IModelTestUtils._connectClient)
      IModelTestUtils._connectClient = new ContextRegistryClient();
    return IModelTestUtils._connectClient;
  }

  private static getStat(name: string) {
    let stat: IModelJsFsStats | undefined;
    try {
      stat = IModelJsFs.lstatSync(name);
    } catch (err) {
      stat = undefined;
    }
    return stat;
  }

  private static copyIModelForOpen(filename: string, opts: IModelTestUtilsOpenOptions): string {
    const destPath = KnownTestLocations.outputDir;
    if (!IModelJsFs.existsSync(destPath))
      IModelJsFs.mkdirSync(destPath);

    const srcName = path.join(KnownTestLocations.assetsDir, filename);
    const dbName = path.join(destPath, (opts.copyFilename ? opts.copyFilename : filename));
    const srcStat = IModelTestUtils.getStat(srcName);
    const destStat = IModelTestUtils.getStat(dbName);
    if (!srcStat || !destStat || srcStat.mtimeMs !== destStat.mtimeMs)
      IModelJsFs.copySync(srcName, dbName, { preserveTimestamps: true });

    return dbName;
  }

  public static openSnapshotFromSeed(filename: string, opts?: IModelTestUtilsOpenOptions): SnapshotDb {
    const dbName = IModelTestUtils.copyIModelForOpen(filename, opts || {});
    const iModel = SnapshotDb.openFile(dbName); // could throw Error
    assert.exists(iModel);
    return iModel;
  }

  public static openIModelForWrite(filename: string, opts?: IModelTestUtilsOpenOptions): StandaloneDb {
    opts = opts || {};
    const dbName = IModelTestUtils.copyIModelForOpen(filename, opts);
    const iModel = StandaloneDb.openFile(dbName, OpenMode.ReadWrite);
    assert.exists(iModel);
    return iModel;
  }

  // __PUBLISH_EXTRACT_START__ IModelHost.startup
  public static async startupIModelHost(): Promise<void> {
    // The host configuration.
    // The defaults will work for most backends.
    // Here is an example of how the cacheDir property of the host configuration
    // could be set from an environment variable, which could be set by a cloud deployment mechanism.
    let cacheDir = process.env.MY_SERVICE_CACHE_DIR;
    if (cacheDir === undefined) {
      const tempDir = process.env.MY_SERVICE_TMP_DIR || KnownLocations.tmpdir;
      cacheDir = path.join(tempDir, "iModelJs_cache");
    }

    const imHostConfig = new IModelHostConfiguration();
    imHostConfig.cacheDir = cacheDir;

    // Start up IModelHost, supplying the configuration.
    await IModelHost.startup(imHostConfig);
  }
  // __PUBLISH_EXTRACT_END__

}

// Start the backend
before(async () => {
  await IModelTestUtils.startupIModelHost();
});
