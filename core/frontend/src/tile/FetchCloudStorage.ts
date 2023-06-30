/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { FrontendConfigDownloadInput, FrontendConfigUploadInput, FrontendStorage, FrontendUploadInMultiplePartsInput, FrontendUrlDownloadInput, FrontendUrlUploadInput, ObjectReference } from "@itwin/object-storage-core/lib/frontend";

/** @internal */
export class FetchCloudStorage implements FrontendStorage {
  public download(input: (FrontendUrlDownloadInput | FrontendConfigDownloadInput) & { transferType: "buffer" }): Promise<ArrayBuffer>;
  public download(input: (FrontendUrlDownloadInput | FrontendConfigDownloadInput) & { transferType: "stream" }): Promise<ReadableStream<any>>;
  public async download(input: FrontendUrlDownloadInput | FrontendConfigDownloadInput): Promise<ArrayBuffer | ReadableStream<any>> {
    if (input.transferType === "stream")
      throw new Error("Method not implemented.");
    if (this.isUrlInput(input)) {
      return (await fetch(input.url)).arrayBuffer();
    }
    if (!("authentication" in input.transferConfig))
      throw new Error("authentication missing in transferConfig");
    const url = `${input.transferConfig.baseUrl}/${this.buildObjectKey(input.reference)}?${input.transferConfig.authentication}`;
    const resp = await fetch(url);
    if (!resp.ok)
      throw new Error(resp.statusText);
    return resp.arrayBuffer();
  }
  private buildObjectKey(ref: ObjectReference): string {
    const relative = ref.relativeDirectory ? `/${ref.relativeDirectory}` : "";
    return `${ref.baseDirectory}${relative}/${ref.objectName}`;
  }
  private isUrlInput(input: FrontendUrlDownloadInput | FrontendConfigDownloadInput): input is FrontendUrlDownloadInput {
    return "url" in (input as FrontendUrlDownloadInput);
  }
  public async upload(_input: FrontendUrlUploadInput | FrontendConfigUploadInput): Promise<void> {
    throw new Error("Method not implemented.");
  }
  public async uploadInMultipleParts(_input: FrontendUploadInMultiplePartsInput): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
