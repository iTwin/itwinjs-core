/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

/** Describes available options for RPC response caching. */
export enum RpcResponseCacheControl {
  None,
  Immutable,
}

/** RPC interface type marshaling directives. */
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

/** RPC protocol event types. */
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

/** The status of an RPC operation request. */
export enum RpcRequestStatus {
  Unknown,
  Created,
  Submitted,
  Provisioning,
  Pending,
  Resolved,
  Rejected,
  Disposed,
  NotFound,
}

/** RPC request event types. */
export enum RpcRequestEvent {
  StatusChanged,
  PendingUpdateReceived,
}

/** RPC content types. */
export enum RpcContentType {
  Unknown,
  Text,
  Binary,
  Multipart,
}

/** RPC supported mobile platforms. */
export enum RpcMobilePlatform {
  Unknown,
  Window, // Window Phone
  Android, // Android OS
  iOS, // iOS platform
}

/** Endpoints for RPC protocols.. */
export enum RpcEndpoint {
  Frontend,
  Backend,
}

/** @hidden */
export const WEB_RPC_CONSTANTS = {
  CONTENT: "Content-Type",
  TEXT: "text/plain",
  ANY_TEXT: "text/",
  BINARY: "application/octet-stream",
  MULTIPART: "multipart/form-data",
};
