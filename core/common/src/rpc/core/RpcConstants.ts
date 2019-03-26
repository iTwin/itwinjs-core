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

/** RPC interface type marshaling directives.
 * @internal
 */
export enum RpcMarshalingDirective {
  Name = "__name__",
  JSON = "__JSON__",
  Undefined = "__undefined__",
  Map = "__map__",
  Set = "__set__",
  Unregistered = "__unregistered__",
  Error = "__error__",
  ErrorName = "__error_name__",
  ErrorMessage = "__error_message__",
  ErrorStack = "__error_stack__",
  Binary = "__binary__",
}

/** RPC protocol event types.
 * @internal
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
 * @internal
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
 * @internal
 */
export enum RpcRequestEvent {
  StatusChanged,
  PendingUpdateReceived,
}

/** RPC content types.
 * @internal
 */
export enum RpcContentType {
  Unknown,
  Text,
  Binary,
  Multipart,
  Stream,
}

/** RPC supported mobile platforms.
 * @internal
 */
export enum RpcMobilePlatform {
  Unknown,
  Window, // Window Phone
  Android, // Android OS
  iOS, // iOS platform
}

/** Endpoints for RPC protocols.
 * @internal
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
