/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/**
 * Contains metadata for an iModel.js Extension
 * @beta
 */
export interface ExtensionProps {
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

function statusFromJSON(jsonObject: any): ExtensionUploadStatus | undefined {
  if (jsonObject.statusUpdateTime === undefined || typeof jsonObject.statusUpdateTime !== "string" ||
    jsonObject.status === undefined || typeof jsonObject.status !== "string") {

    return undefined;
  }

  return {
    updateTime: new Date(jsonObject.statusUpdateTime),
    status: jsonObject.status,
  };
}

function fileInfoFromJSON(jsonObject: any): FileInfo | undefined {
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

/**
 * Validates JSON and returns ExtensionProps
 * @internal
 */
export function extensionPropsFromJSON(jsonObject: any): ExtensionProps | undefined {
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

  const files: FileInfo[] = new Array(jsonObject.files.length);
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
