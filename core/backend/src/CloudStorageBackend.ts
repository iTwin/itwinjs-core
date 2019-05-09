/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { BentleyStatus, CloudStorageContainerDescriptor, CloudStorageContainerUrl, CloudStorageProvider, IModelError } from "@bentley/imodeljs-common";
import * as as from "azure-storage";
import { PassThrough, Readable } from "stream";

/** @beta */
export interface CloudStorageServiceCredentials {
  service: "azure";
  account: string;
  accessKey: string;
}

/** @beta */
export interface CloudStorageUploadOptions {
  type?: string;
  cacheControl?: string;
}

/** @beta */
export abstract class CloudStorageService {
  public initialize(): void { }
  public terminate(): void { }
  public abstract id: CloudStorageProvider;
  public abstract obtainContainerUrl(id: CloudStorageContainerDescriptor, expiry: Date): CloudStorageContainerUrl;
  public abstract upload(container: string, name: string, data: Uint8Array, options?: CloudStorageUploadOptions): Promise<string>;
  public async download(_name: string): Promise<Readable | undefined> { return Promise.resolve(undefined); }

  protected makeDescriptor(id: CloudStorageContainerDescriptor) {
    return { name: id.name, provider: this.id };
  }
}

/** @beta */
export class AzureBlobStorage extends CloudStorageService {
  private _service: as.BlobService;

  public constructor(credentials: CloudStorageServiceCredentials) {
    super();

    if (credentials.service !== "azure" || !credentials.account || !credentials.accessKey) {
      throw new IModelError(BentleyStatus.ERROR, "Invalid credentials for Azure blob storage.");
    }

    this._service = as.createBlobService(credentials.account, credentials.accessKey);
  }

  public readonly id = CloudStorageProvider.Azure;

  public obtainContainerUrl(id: CloudStorageContainerDescriptor, expiry: Date): CloudStorageContainerUrl {
    const policy: as.common.SharedAccessPolicy = {
      AccessPolicy: {
        Permissions: as.BlobUtilities.SharedAccessPermissions.READ + as.BlobUtilities.SharedAccessPermissions.LIST,
        Expiry: expiry,
      },
    };

    const token = this._service.generateSharedAccessSignature(id.name, "", policy);

    const url: CloudStorageContainerUrl = {
      descriptor: this.makeDescriptor(id),
      valid: 0,
      expires: expiry.getTime(),
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

        this._service.createBlockBlobFromStream(container, name, source, data.byteLength, createOptions, (error, result, response) => {
          if (error) {
            reject(error);
          }

          if (!response.isSuccessful) {
            reject(response.error);
          }

          resolve(result.etag);
        });
      } catch (error) {
        reject(error);
      }
    });
  }
}
