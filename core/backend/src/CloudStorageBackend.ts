/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { PassThrough, Readable } from "stream";
import * as zlib from "zlib";
import * as Azure from "@azure/storage-blob";
import {
  BentleyStatus, CloudStorageContainerDescriptor, CloudStorageContainerUrl, CloudStorageProvider, IModelError,
} from "@bentley/imodeljs-common";

/** @beta */
export interface CloudStorageServiceCredentials {
  service: "azure" | "alicloud" | "external";
  account: string;
  accessKey: string;
  baseUrl?: string;
}

/** @beta */
export interface CloudStorageUploadOptions {
  type?: string;
  cacheControl?: string;
  contentEncoding?: "gzip";
}

/** @beta */
export abstract class CloudStorageService {
  public initialize(): void { }
  public terminate(): void { }
  public abstract id: CloudStorageProvider;
  public abstract obtainContainerUrl(id: CloudStorageContainerDescriptor, expiry: Date, clientIp?: string): CloudStorageContainerUrl;
  public abstract upload(container: string, name: string, data: Uint8Array, options?: CloudStorageUploadOptions, metadata?: object): Promise<string>;
  public async download(_name: string): Promise<Readable | undefined> { return undefined; }

  protected makeDescriptor(id: CloudStorageContainerDescriptor) {
    return { name: id.name, provider: this.id };
  }
}

/** @beta */
export class AzureBlobStorage extends CloudStorageService {
  private _service: Azure.ServiceURL;
  private _credential: Azure.SharedKeyCredential;
  private _baseUrl: string;

  public constructor(credentials: CloudStorageServiceCredentials) {
    super();

    if (credentials.service !== "azure" || !credentials.account || !credentials.accessKey) {
      throw new IModelError(BentleyStatus.ERROR, "Invalid credentials for Azure blob storage.");
    }

    this._baseUrl = credentials.baseUrl ?? `https://${credentials.account}.blob.core.windows.net`;
    this._credential = new Azure.SharedKeyCredential(credentials.account, credentials.accessKey);
    const options: Azure.INewPipelineOptions = {};
    const pipeline = Azure.StorageURL.newPipeline(this._credential, options);
    this._service = new Azure.ServiceURL(this._baseUrl, pipeline);
  }

  public readonly id = CloudStorageProvider.Azure;

  public obtainContainerUrl(id: CloudStorageContainerDescriptor, expiry: Date, clientIp?: string): CloudStorageContainerUrl {
    const policy: Azure.IBlobSASSignatureValues = {
      containerName: id.name,
      permissions: Azure.ContainerSASPermissions.parse("rl").toString(),
      expiryTime: expiry,
    };

    if (clientIp && clientIp !== "localhost" && clientIp !== "127.0.0.1" && clientIp !== "::1") {
      policy.ipRange = { start: clientIp };
    }

    const token = Azure.generateBlobSASQueryParameters(policy, this._credential);
    const url = new URL(this._baseUrl);
    url.pathname = `${url.pathname.replace(/\/*$/, "")}/${id.name}`;
    url.search = token.toString();

    const urlObject: CloudStorageContainerUrl = {
      descriptor: this.makeDescriptor(id),
      valid: 0,
      expires: expiry.getTime(),
      url: url.toString(),
    };

    return urlObject;
  }

  public async ensureContainer(name: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const container = Azure.ContainerURL.fromServiceURL(this._service, name);
        await container.create(Azure.Aborter.none);
        return resolve();
      } catch (maybeErr) {
        try {
          const err = maybeErr as Azure.RestError;
          if (err.statusCode === 409 && err.body.code === "ContainerAlreadyExists") {
            return resolve();
          }
        } catch { }

        if (typeof (maybeErr) !== "undefined" && maybeErr) {
          return reject(maybeErr);
        }

        return reject(new IModelError(BentleyStatus.ERROR, `Unable to create container "${name}".`));
      }
    });
  }

  public async upload(container: string, name: string, data: Uint8Array, options?: CloudStorageUploadOptions, metadata?: object): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        await this.ensureContainer(container);

        const containerUrl = Azure.ContainerURL.fromServiceURL(this._service, container);
        const blob = Azure.BlobURL.fromContainerURL(containerUrl, name);
        const blocks = Azure.BlockBlobURL.fromBlobURL(blob);
        const blobHTTPHeaders = {
          blobContentType: options?.type ?? "application/octet-stream",
          blobCacheControl: options?.cacheControl ?? "private, max-age=31536000, immutable",
        };

        const blobOptions: Azure.IUploadStreamToBlockBlobOptions = metadata ?
          {
            blobHTTPHeaders,
            metadata: { ...metadata },
          } : {
            blobHTTPHeaders,
          };

        const dataStream = new PassThrough();
        dataStream.end(data);

        let source: Readable;

        if (options && options.contentEncoding === "gzip") {
          blobOptions.blobHTTPHeaders!.blobContentEncoding = options.contentEncoding;
          const compressor = zlib.createGzip();
          source = dataStream.pipe(compressor);
        } else {
          source = dataStream;
        }

        const blockSize = 100 * 1024 * 1024;
        const concurrency = 1;
        const result = await Azure.uploadStreamToBlockBlob(Azure.Aborter.none, source, blocks, blockSize, concurrency, blobOptions);
        return resolve(result.eTag ?? "");
      } catch (maybeErr) {
        if (typeof (maybeErr) !== "undefined" && maybeErr) {
          return reject(maybeErr);
        }

        return reject(new IModelError(BentleyStatus.ERROR, `Unable to upload "${name}".`));
      }
    });
  }
}

