/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AccessToken, Guid } from "@itwin/core-bentley";

import { request, RequestOptions } from "../../request/Request";

/** Structure of extensions from the ExtensionService
 * @internal
 */
export interface ExtensionMetadata {
  contextId: string;
  extensionName: string;
  version: string;
  files: FileInfo[];
  uploadedBy: string;
  timestamp: Date;
  status: ExtensionUploadStatus;
  isPublic: boolean;
}

interface ExtensionUploadStatus {
  updateTime: Date;
  status: string;
}

interface FileInfo {
  url: string;
  expires: Date;
  checksum: string;
}

/**
 * Client for querying, publishing and deleting iModel.js Extensions.
 *
 * The `imodel-extension-service-api` OIDC scope is required for all operations and the `imodel-extension-service:modify` is
 * required for modification operations (modify, publish, and deleting).
 * @alpha
 */
export class ExtensionClient {
  private readonly _baseUrl: string;
  public constructor() {
    this._baseUrl = "https://api.bentley.com/iModelExtensionService/";
  }

  private get _endpoint(): string {
    const prefix = process.env.IMJS_URL_PREFIX;
    const baseUrl = new URL(this._baseUrl);
    if (prefix)
      baseUrl.hostname = prefix + new URL(baseUrl).hostname;

    if (!baseUrl.pathname.endsWith("/"))
      baseUrl.pathname += "/";

    baseUrl.pathname += "v1.0/";
    return baseUrl.toString();
  }

  private parseExtensionMetadataArray(json: any): ExtensionMetadata[] {
    if (!(json instanceof Array))
      return [];

    const ret: ExtensionMetadata[] = [];
    json.forEach((extensionJson) => {
      const extension = extensionMetadataFromJSON(extensionJson);
      if (extension !== undefined)
        ret.push(extension);
    });

    return ret;
  }

  /**
   * Gets information on extensions. If extensionName is undefined, will return all extensions in the iTwin.
   * If extensionName is defined, will return all versions of that extension.
   * If iTwinId is undefined, will default to the public extensions.
   * @param extensionName Extension name (optional)
   * @param iTwinId iTwin Id (optional)
   */
  public async getExtensions(accessToken: AccessToken, extensionName?: string, iTwinId = Guid.empty): Promise<ExtensionMetadata[]> {
    const options: RequestOptions = { method: "GET" };
    options.headers = { authorization: accessToken };
    const response = await request(`${this._endpoint}${iTwinId}/IModelExtension/${extensionName ?? ""}`, options);
    if (response.status !== 200)
      throw new Error(`Server returned status: ${response.status}, message: ${response.body.message}`);

    if (!(response.body instanceof Array) || response.body.length < 1)
      return [];

    return this.parseExtensionMetadataArray(response.body);
  }

  /**
   * Gets information about an extension's specific version
   * If iTwinId is undefined, will assume the extension was published publicly.
   * @param extensionName Extension name
   * @param version Extension version
   * @param iTwinId iTwin Id (optional)
   */
  public async getExtensionMetadata(accessToken: AccessToken, extensionName: string, version: string, iTwinId = Guid.empty): Promise<ExtensionMetadata | undefined> {

    const options: RequestOptions = { method: "GET" };
    options.headers = { authorization: accessToken };
    const response = await request(`${this._endpoint}${iTwinId}/IModelExtension/${extensionName}/${version}`, options);
    if (response.status !== 200)
      throw new Error(`Server returned status: ${response.status}, message: ${response.body.message}`);

    if (!(response.body instanceof Array) || response.body.length < 1)
      return undefined;
    if (response.body.length > 1)
      throw new Error("Server returned too many extensions");

    return extensionMetadataFromJSON(response.body[0]);
  }
}

/**
 * Validates JSON and returns ExtensionMetadata
 */
function extensionMetadataFromJSON(jsonObject: any): ExtensionMetadata | undefined {
  if (jsonObject.contextId === undefined || typeof jsonObject.contextId !== "string" ||
    jsonObject.extensionName === undefined || typeof jsonObject.extensionName !== "string" ||
    jsonObject.version === undefined || typeof jsonObject.version !== "string" ||
    jsonObject.files === undefined || !(jsonObject.files instanceof Array) ||
    jsonObject.uploadedBy === undefined || typeof jsonObject.uploadedBy !== "string" ||
    jsonObject.timestamp === undefined || typeof jsonObject.timestamp !== "string" ||
    jsonObject.isPublic === undefined || typeof jsonObject.isPublic !== "boolean" ||
    jsonObject.extensionStatus === undefined) {

    return undefined;
  }

  const status = statusFromJSON(jsonObject.extensionStatus);
  if (status === undefined)
    return undefined;

  const files = new Array(jsonObject.files.length);
  for (let i = 0; i < jsonObject.files.length; i++) {
    const parsed = fileInfoFromJSON(jsonObject.files[i]);
    if (parsed === undefined)
      return undefined;
    files[i] = parsed;
  }

  return {
    contextId: jsonObject.contextId,
    extensionName: jsonObject.extensionName,
    version: jsonObject.version,
    files,
    uploadedBy: jsonObject.uploadedBy,
    timestamp: new Date(jsonObject.timestamp),
    isPublic: jsonObject.isPublic,
    status,
  };
}

function statusFromJSON(jsonObject: any) {
  if (jsonObject.statusUpdateTime === undefined || typeof jsonObject.statusUpdateTime !== "string" ||
    jsonObject.status === undefined || (jsonObject.status !== null && typeof jsonObject.status !== "string")) {

    return undefined;
  }

  return {
    updateTime: new Date(jsonObject.statusUpdateTime),
    status: jsonObject.status ?? "Valid",
  };
}

function fileInfoFromJSON(jsonObject: any) {
  if (jsonObject.url === undefined || typeof jsonObject.url !== "string" ||
    jsonObject.expiresAt === undefined || typeof jsonObject.expiresAt !== "string" ||
    jsonObject.checksum === undefined || (typeof jsonObject.checksum !== "string" && jsonObject.checksum !== null)) {

    return undefined;
  }

  return {
    url: jsonObject.url,
    expires: new Date(jsonObject.expiresAt),
    checksum: jsonObject.checksum,
  };
}
