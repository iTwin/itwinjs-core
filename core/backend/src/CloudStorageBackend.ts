/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as as from "azure-storage";
import { PassThrough, Readable } from "stream";
import * as path from "path";
import * as crypto from "crypto";
import { CloudStorageContainerDescriptor, CloudStorageProvider, CloudStorageContainerUrl, IModelError, BentleyStatus } from "@bentley/imodeljs-common";
import { IModelJsFs } from "./IModelJsFs";
import * as LRU from "lru-cache";

export interface CloudStorageServiceCredentials {
  service: "azure";
  account: string;
  accessKey: string;
}

export interface CloudStorageUploadOptions {
  type?: string;
  cacheControl?: string;
}

export abstract class CloudStorageService {
  public initialize(): void { }
  public terminate(): void { }
  public abstract id: CloudStorageProvider;
  public abstract obtainContainerUrl(id: CloudStorageContainerDescriptor): CloudStorageContainerUrl;
  public abstract upload(container: string, name: string, data: Uint8Array, options?: CloudStorageUploadOptions): Promise<string>;
  public async download(_name: string): Promise<Readable | undefined> { return Promise.resolve(undefined); }

  protected makeDescriptor(id: CloudStorageContainerDescriptor) {
    return { name: id.name, provider: this.id };
  }
}

export class LocalStorageService extends CloudStorageService {
  private _basePath: string;
  private _entries: LRU<string, number>;
  private _removeOnTerminate: boolean;

  public constructor(basePath: string, maxSize: number = 0, removeOnTerminate: boolean = false) {
    super();

    this._removeOnTerminate = removeOnTerminate;
    this._basePath = basePath;

    this._entries = new LRU({
      max: maxSize,
      length: (value) => value,
      dispose: (key) => IModelJsFs.unlinkSync(key),
      noDisposeOnSet: true,
    });
  }

  public initialize() {
    IModelJsFs.ensureDirSync(this._basePath);
  }

  public terminate() {
    if (this._removeOnTerminate) {
      IModelJsFs.removeSync(this._basePath);
    }
  }

  public readonly id = CloudStorageProvider.Local;

  public obtainContainerUrl(id: CloudStorageContainerDescriptor): CloudStorageContainerUrl {
    return {
      descriptor: this.makeDescriptor(id),
      valid: 0,
      expires: Number.MAX_SAFE_INTEGER,
      url: id.name,
    };
  }

  public async upload(container: string, name: string, data: Uint8Array, _options?: CloudStorageUploadOptions): Promise<string> {
    const containerSafe = path.basename(container);
    const nameSafe = path.basename(name.replace(/\//g, "-"));

    const dest = path.join(this._basePath, containerSafe, nameSafe);
    this._entries.set(dest, data.byteLength);
    IModelJsFs.ensureDirSync(path.dirname(dest));
    IModelJsFs.writeFileSync(dest, data);

    const etag = crypto.createHash("sha256").update(data).digest("hex");
    return Promise.resolve(etag);
  }

  public async download(name: string): Promise<Readable | undefined> {
    const components = name.split("/");
    if (components.length === 2) {
      const containerSafe = path.basename(components[components.length - 2]);
      const nameSafe = path.basename(components[components.length - 1]);

      const resourcePath = path.join(this._basePath, containerSafe, nameSafe);
      if (IModelJsFs.existsSync(resourcePath)) {
        const resource = IModelJsFs.createReadStream(resourcePath);
        this._entries.get(resourcePath);
        return Promise.resolve(resource);
      }
    }

    return Promise.resolve(undefined);
  }
}

export class AzureBlobStorage extends CloudStorageService {
  private _service: as.BlobService;

  public static resourceValidity = 1000 * 60 * 60 * 6;
  public static resourceValidityPadding = 1000 * 60 * 5;

  public constructor(credentials: CloudStorageServiceCredentials) {
    super();

    if (credentials.service !== "azure" || !credentials.account || !credentials.accessKey) {
      throw new IModelError(BentleyStatus.ERROR, "Invalid credentials for Azure blob storage.");
    }

    this._service = as.createBlobService(credentials.account, credentials.accessKey);
  }

  public readonly id = CloudStorageProvider.Azure;

  public obtainContainerUrl(id: CloudStorageContainerDescriptor): CloudStorageContainerUrl {
    let start = new Date().getTime();
    const padding = AzureBlobStorage.resourceValidityPadding;
    const end = start + AzureBlobStorage.resourceValidity + padding;
    start -= padding;

    const policy: as.common.SharedAccessPolicy = {
      AccessPolicy: {
        Permissions: as.BlobUtilities.SharedAccessPermissions.READ,
        Start: new Date(start),
        Expiry: new Date(end),
      },
    };

    const token = this._service.generateSharedAccessSignature(id.name, "", policy);

    const url: CloudStorageContainerUrl = {
      descriptor: this.makeDescriptor(id),
      valid: start,
      expires: end,
      url: this._service.getUrl(id.name, undefined, token),
    };

    return url;
  }

  public async ensureContainer(name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this._service.createContainerIfNotExists(name, (error, _result, response) => {
        if (error) {
          reject(error);
        }

        if (!response.isSuccessful) {
          reject(response.error);
        }

        // _result indicates whether container already existed...irrelevant to semantics of our API

        resolve();
      });
    });
  }

  public async upload(container: string, name: string, data: Uint8Array, options?: CloudStorageUploadOptions): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const source = new PassThrough();
      source.end(data);

      const createOptions: as.BlobService.CreateBlockBlobRequestOptions = {
        contentSettings: {
          contentType: options ? options.type : "application/octet-stream",
          cacheControl: options ? options.cacheControl : "private, max-age=31536000, immutable",
        },
      };

      try {
        await this.ensureContainer(container);
      } catch (error) {
        reject(error);
      }

      this._service.createBlockBlobFromStream(container, name, source, data.byteLength, createOptions, (error, result, response) => {
        if (error) {
          reject(error);
        }

        if (!response.isSuccessful) {
          reject(response.error);
        }

        resolve(result.etag);
      });
    });
  }
}
