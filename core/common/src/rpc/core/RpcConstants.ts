/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

/* eslint-disable deprecation/deprecation */

/** Describes available options for RPC response caching.
 * @public
 */
export enum RpcResponseCacheControl {
  None,
  Immutable,
}

/** RPC protocol event types.
 * @public
 * @deprecated in 3.6. The RPC system will be significantly refactored (or replaced) in the future.
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
  BackendReportedNoContent,
}

/** The status of an RPC operation request.
 * @public
 * @deprecated in 3.6. The RPC system will be significantly refactored (or replaced) in the future.
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
  Cancelled,
  NoContent,
  BadGateway,
  ServiceUnavailable,
  GatewayTimeout,
  RequestTimeout,
  TooManyRequests
}

/** @public @deprecated in 3.6. The RPC system will be significantly refactored (or replaced) in the future. */
export namespace RpcRequestStatus { // eslint-disable-line @typescript-eslint/no-redeclare
  export function isTransientError(status: RpcRequestStatus) {
    return status === RpcRequestStatus.BadGateway || status === RpcRequestStatus.ServiceUnavailable || status === RpcRequestStatus.GatewayTimeout
      || status === RpcRequestStatus.RequestTimeout || status === RpcRequestStatus.TooManyRequests;
  }
}

/** RPC request event types.
 * @public
 * @deprecated in 3.6. The RPC system will be significantly refactored (or replaced) in the future.
 */
export enum RpcRequestEvent {
  StatusChanged,
  PendingUpdateReceived,
  TransientErrorReceived
}

/** RPC content types.
 * @public
 * @deprecated in 3.6. The RPC system will be significantly refactored (or replaced) in the future.
 */
export enum RpcContentType {
  Unknown,
  Text,
  Binary,
  Multipart,
  Stream,
}

/** Endpoints for RPC protocols.
 * @public
 * @deprecated in 3.6. The RPC system will be significantly refactored (or replaced) in the future.
 */
export enum RpcEndpoint {
  Frontend,
  Backend,
}

/* eslint-disable @typescript-eslint/naming-convention */

/** @internal */
export const WEB_RPC_CONSTANTS = {
  CONTENT: "Content-Type",
  TEXT: "text/plain",
  ANY_TEXT: "text/",
  BINARY: "application/octet-stream",
  MULTIPART: "multipart/form-data",
};
