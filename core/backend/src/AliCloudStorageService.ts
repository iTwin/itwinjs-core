/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { Readable } from "stream";
import { PassThrough } from "stream";
import * as zlib from "zlib";
import { BentleyStatus } from "@itwin/core-bentley";
import type { CloudStorageContainerDescriptor, CloudStorageContainerUrl} from "@itwin/core-common";
import { CloudStorageProvider, IModelError } from "@itwin/core-common";
import type { CloudStorageUploadOptions } from "./CloudStorageBackend";
import { CloudStorageService } from "./CloudStorageBackend";

/** @beta */
export interface AliCloudStorageServiceCredentials {
  region: string;
  accessKeyId: string;
  accessKeySecret: string;
}

declare class OSS {
  constructor(params: AliCloudStorageServiceCredentials)
  public useBucket(name: string): void;
  public signatureUrl(name: string, policy: OSS.SignatureUrlOptions): string;
  public list(params: { marker: string, "max-keys": number }, arg2: {}): Promise<{ objects?: Array<{ name: string }> }>;
  public putBucket(name: string): Promise<void>;
  public putBucketCORS(name: string, params: Array<{ allowedOrigin: string, allowedMethod: string[], allowedHeader: string }>): Promise<void>;
  public putStream(name: string, source: Readable, options: OSS.PutStreamOptions): Promise<void>;
}

declare namespace OSS { // eslint-disable-line no-redeclare
  interface SignatureUrlOptions {
    expires: number;
  }

  interface PutStreamOptions {
    mime: string;
    headers: { [index: string]: string };
  }
}

/** @beta */
export class AliCloudStorageService extends CloudStorageService {
  private _client: OSS;

  public id = CloudStorageProvider.AliCloud;

  public constructor(credentials: AliCloudStorageServiceCredentials) {
    super();

    this._client = new OSS(credentials);
  }

  public obtainContainerUrl(id: CloudStorageContainerDescriptor, expiry: Date, _clientIp?: string): CloudStorageContainerUrl {
    const now = new Date().getTime();

    const policy: OSS.SignatureUrlOptions = {
      expires: expiry.getTime() - now,
    };

    this._client.useBucket(id.name);

    if (undefined === id.resource)
      throw new IModelError(BentleyStatus.ERROR, "Attribute 'resource' on CloudStorageContainerDescriptor object is undefined.");

    const url: CloudStorageContainerUrl = {
      descriptor: this.makeDescriptor(id),
      valid: 0,
      expires: expiry.getTime(),
      url: this._client.signatureUrl(id.resource, policy),
      bound: true,
    };

    return url;
  }

  public async listContainer(name: string, marker: string, count: number): Promise<string[]> {
    this._client.useBucket(name);
    const query = await this._client.list({ marker, "max-keys": count }, {});
    return query.objects ? query.objects.map((o) => o.name) : [];
  }

  public async upload(container: string, name: string, data: Uint8Array, options?: CloudStorageUploadOptions): Promise<string> {
    await this._client.putBucket(container);
    await this._client.putBucketCORS(container, [{ allowedOrigin: "*", allowedMethod: ["GET", "POST", "PUT", "DELETE", "HEAD"], allowedHeader: "*" }]);
    this._client.useBucket(container);

    const dataStream = new PassThrough();
    dataStream.end(data);

    let source: Readable;

    const putOptions = {
      mime: (options && options.type) ? options.type : "application/octet-stream",
      headers: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        "Cache-Control": (options && options.cacheControl) ? options.cacheControl : "private, max-age=31536000, immutable",
      },
    } as OSS.PutStreamOptions;

    if (options && options.contentEncoding === "gzip") {
      (putOptions.headers as any)["Content-Encoding"] = options.contentEncoding;
      const compressor = zlib.createGzip();
      source = dataStream.pipe(compressor);
    } else {
      source = dataStream;
    }
    await this._client.putStream(name, source, putOptions);
    return "";
  }
}
