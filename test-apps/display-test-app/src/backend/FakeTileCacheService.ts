/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as fs from "fs-extra";
import * as path from "path";
import { CloudStorageService, CloudStorageUploadOptions } from "@itwin/core-backend";
import { CloudStorageContainerDescriptor, CloudStorageContainerUrl, CloudStorageProvider } from "@itwin/core-common";

/** Simulates cloud storage tile cache, caching tiles in ./lib/backend/tiles/ */
export class FakeTileCacheService extends CloudStorageService {
  private readonly _dirname: string;
  private readonly _host: string;
  public readonly id = CloudStorageProvider.External;

  public constructor(dirname: string, hostUrl: string) {
    super();
    this._dirname = dirname;
    if (!fs.existsSync(this._dirname))
      fs.mkdirSync(this._dirname);
    this._host = hostUrl;
  }

  // The tiles "uploaded" to "this._dirname" are served from the backend's origin, "this._host", which is what can be called by the frontend
  public obtainContainerUrl(id: CloudStorageContainerDescriptor, expiry: Date, _clientIp?: string): CloudStorageContainerUrl {
    return {
      url: `${this._host}/tiles/${id.name}`,
      valid: 0,
      expires: expiry.getTime(),
      descriptor: this.makeDescriptor(id),
    };
  }

  // This method "uploads" the tiles to the local path configured by `this._dirname`.
  public async upload(container: string, name: string, data: Uint8Array, _options?: CloudStorageUploadOptions): Promise<string> {
    const relFileName = `${container}/${name}`;
    const relDir = relFileName.substring(0, relFileName.lastIndexOf("/") + 1);
    const filename = path.normalize(path.join(this._dirname, relFileName));
    const dir = path.normalize(path.join(this._dirname, relDir));

    fs.ensureDirSync(dir);
    fs.writeFileSync(filename, data);

    return "ok";
  }
}
