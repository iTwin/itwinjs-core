/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

/** Describes available options for RPC response caching.
 * @public
 */
export enum RpcResponseCacheControl {
  None,
  Immutable,
}

/** RPC protocol event types.
 * @public
 */
export enum RpcProtocolEvent {
  RequestCreated,
  ResponseLoaded,
  ResponseLoading,
  ConnectionErrorReceived,
  UnknownErrorReceived,
  BackendErrorReceived,
  ConnectionAborted,
  RequestReceived,
  BackendResponseCreated,
  BackendReportedPending,
  BackendReportedNotFound,
  BackendErrorOccurred,
}

/** The status of an RPC operation request.
 * @public
 */
export enum RpcRequestStatus {
  Unknown,
  Created,
  Submitted,
  Pending,
  Resolved,
  Rejected,
  Disposed,
  NotFound,
}

/** RPC request event types.
 * @public
 */
export enum RpcRequestEvent {
  StatusChanged,
  PendingUpdateReceived,
}

/** RPC content types.
 * @public
 */
export enum RpcContentType {
  Unknown,
  Text,
  Binary,
  Multipart,
  Stream,
}

/** RPC supported mobile platforms.
 * @beta
 */
export enum RpcMobilePlatform {
  Unknown,
  Android,
  iOS,
}

/** Endpoints for RPC protocols.
 * @public
 */
export enum RpcEndpoint {
  Frontend,
  Backend,
}

/** @internal */
export const WEB_RPC_CONSTANTS = {
  CONTENT: "Content-Type",
  TEXT: "text/plain",
  ANY_TEXT: "text/",
  BINARY: "application/octet-stream",
  MULTIPART: "multipart/form-data",
};
