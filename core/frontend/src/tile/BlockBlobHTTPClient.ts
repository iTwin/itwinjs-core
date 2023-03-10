/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AzureTransferConfigInput, FrontendBlockBlobClientWrapper, FrontendBlockBlobClientWrapperFactory } from "@itwin/object-storage-azure/lib/frontend";
import type { FrontendMultipartUploadData, Metadata, MultipartUploadOptions, ObjectReference, UrlTransferInput } from "@itwin/object-storage-core/lib/frontend";

function isUrlTransferInput(input: UrlTransferInput | AzureTransferConfigInput): input is UrlTransferInput {
  return "url" in (input as UrlTransferInput);
}

function buildObjectKey(ref: ObjectReference): string {
  const relative = ref.relativeDirectory ? `/${ref.relativeDirectory}` : "";
  return `${ref.baseDirectory}${relative}/${ref.objectName}`;
}

function buildBlobUrl(input: AzureTransferConfigInput): string {
  const { authentication, baseUrl } = input.transferConfig;
  return `${baseUrl}/${buildObjectKey(input.reference)}?${authentication}`;
}

export class BlockBlobHTTPClientFactory extends FrontendBlockBlobClientWrapperFactory {
  public override create(input: UrlTransferInput | AzureTransferConfigInput): FrontendBlockBlobClientWrapper {
    const url = isUrlTransferInput(input) ? input.url : buildBlobUrl(input);
    return new BlockBlobHTTPClient(url);
  }
}

export class HttpError extends Error {
  public constructor(public statusCode: number) {
    super(`HTTP error: status ${statusCode}`);
  }
}

export class BlockBlobHTTPClient extends FrontendBlockBlobClientWrapper {
  public constructor(private _url: string) {
    super({} as any); // we are _not_ using any implementation from the base class, we only need to extend it because @itwin/object-storage does not expose an interface to implement.
  }

  public override async download(): Promise<Blob> {
    const resp = await fetch(this._url);
    if (!resp.ok) {
      throw new HttpError(resp.status);
    }
    return resp.blob();
  }

  public override async uploadInMultipleParts(_data: FrontendMultipartUploadData, _options?: MultipartUploadOptions): Promise<void> {
    throw new Error("Upload operation not supported");
  }

  public override async upload(_data: ArrayBuffer, _metadata?: Metadata): Promise<void> {
    throw new Error("Upload operation not supported");
  }
}
