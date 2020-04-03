/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as fs from "fs-extra";
import * as path from "path";
import {
  CloudStorageContainerDescriptor,
  CloudStorageContainerUrl,
  CloudStorageProvider,
} from "@bentley/imodeljs-common";
import {
  CloudStorageService,
  CloudStorageUploadOptions,
} from "@bentley/imodeljs-backend";

/** Simulates cloud storage tile cache, caching tiles in ./build/tiles/ */
export class FakeTileCacheService extends CloudStorageService {
  private readonly _dirname: string;
  public readonly id = CloudStorageProvider.External;

  public constructor(dirname: string) {
    super();
    this._dirname = dirname;
    if (!fs.existsSync(this._dirname))
      fs.mkdirSync(this._dirname);
  }

  public obtainContainerUrl(id: CloudStorageContainerDescriptor, expiry: Date, _clientIp?: string): CloudStorageContainerUrl {
    return {
      url: "tiles/" + id.name,
      valid: 0,
      expires: expiry.getTime(),
      descriptor: this.makeDescriptor(id),
    };
  }

  public async upload(container: string, name: string, data: Uint8Array, _options?: CloudStorageUploadOptions): Promise<string> {
    const url = container + "/" + name;
    let absPath = this._dirname + url;
    const lastSlash = absPath.lastIndexOf("/");
    absPath = path.normalize(absPath);
    const dir = absPath.substring(0, lastSlash + 1);
    fs.ensureDirSync(dir);
    fs.writeFileSync(absPath, data);
    return "ok";
  }
}
