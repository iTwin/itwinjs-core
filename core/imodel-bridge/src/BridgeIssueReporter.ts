/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** Abstract implementation of the Issue Reporter
 * @beta
 */
export interface BridgeIssueReporter {
  /**Records element that have not been visited during the running of the bridge*/
  recordIgnoredElements: (repositoryLinkId: string, ignoredElementIdList: string) => void;

  /**Reports a generic issue encountered by the bridge. The sourceId here will determine what file the issue corresponds to*/
  reportIssue: (ecInstanceId: string, sourceId: string, level: "Error" | "Warning", category: string, message: string, type: string) => void;

  /**Records file information for a bridge job. Should be called by the orchestrator */
  recordSourceFileInfo: (srcId: string, name: string, uniqueName: string, itemType: string, dataSource: string, state: string, failureReason: string, exists: boolean, fileSize: number, foundByBridge: boolean, downloadUrl?: string) => void;

  /**Records additional files for a bridge job */
  recordReferenceFileInfo: (srcId: string, name: string, uniqueName: string, itemType: string, dataSource: string, downloadUrl: string, state: string, failureReason: string, exists: boolean, fileSize: number, foundByBridge: boolean) => void;

  /**Returns the path to the report file */
  getReportPath: () => string;

  /**Creates a JSON report file to be uploaded by the orchestrator*/
  publishReport: () => Promise<void>;
}