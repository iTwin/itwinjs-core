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
  uri: string[];
  uploadedBy: string;
  timestamp: Date;
}

/**
 * Contains metadata for an iModel.js Extension
 * @beta
 */
export class Extension implements ExtensionProps {
  public contextId: string;
  public extensionName: string;
  public version: string;
  public uri: string[];
  public uploadedBy: string;
  public timestamp: Date;

  public constructor(props: ExtensionProps) {
    this.contextId = props.contextId;
    this.extensionName = props.extensionName;
    this.version = props.version;
    this.uri = props.uri;
    this.uploadedBy = props.uploadedBy;
    this.timestamp = props.timestamp;
  }

  public static fromJSON(jsonObject: any): Extension | undefined {
    if (jsonObject.contextId === undefined || typeof jsonObject.contextId !== "string" ||
      jsonObject.extensionName === undefined || typeof jsonObject.extensionName !== "string" ||
      jsonObject.version === undefined || typeof jsonObject.version !== "string" ||
      jsonObject.uri === undefined || !(jsonObject.uri instanceof Array) ||
      (jsonObject.uri.length > 0 && typeof jsonObject.uri[0] !== "string") ||
      jsonObject.uploadedBy === undefined || typeof jsonObject.uploadedBy !== "string" ||
      jsonObject.timestamp === undefined || typeof jsonObject.timestamp !== "string") {

      return undefined;
    }

    return new Extension({
      contextId: jsonObject.contextId,
      extensionName: jsonObject.extensionName,
      version: jsonObject.version,
      uri: jsonObject.uri,
      uploadedBy: jsonObject.uploadedBy,
      timestamp: new Date(jsonObject.timestamp),
    });
  }
}
