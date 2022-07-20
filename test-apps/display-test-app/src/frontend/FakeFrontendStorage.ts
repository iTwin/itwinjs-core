/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { FrontendConfigDownloadInput, FrontendConfigUploadInput, FrontendStorage, FrontendTransferData, FrontendUploadInMultiplePartsInput, FrontendUrlDownloadInput, FrontendUrlUploadInput } from "@itwin/object-storage-core/lib/frontend";

export class FakeFrontendStorage extends FrontendStorage {

  public async download(input: (FrontendUrlDownloadInput | FrontendConfigDownloadInput) & { transferType: "buffer" }): Promise<ArrayBuffer>;
  public async download(input: (FrontendUrlDownloadInput | FrontendConfigDownloadInput) & { transferType: "stream" }): Promise<ReadableStream<any>>;
  public async download(input: (FrontendUrlDownloadInput | FrontendConfigDownloadInput)): Promise<FrontendTransferData | undefined> {
    const url = "url" in input
      ? input.url
      : `${input.transferConfig.baseUrl}/${input.reference.objectName}`;

    const response = await fetch(url, {method: "GET"});
    switch(input.transferType) {
      case "buffer":
        return response.arrayBuffer();
      case "stream":
        return response.body ?? undefined;
      default:
        throw new Error(`Unsupported transfer type "${input.transferType}"`);
    }
  }

  public async upload(_input: FrontendUrlUploadInput | FrontendConfigUploadInput): Promise<void> {
    throw new Error("Method not implemented.");
  }

  public async uploadInMultipleParts(_input: FrontendUploadInMultiplePartsInput): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
