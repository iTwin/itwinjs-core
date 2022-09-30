/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import {
  BentleyError, BentleyStatus, GetMetaDataFunction, IModelStatus, RpcInterfaceStatus,
} from "@itwin/core-bentley";

export { BentleyStatus, BentleyError, IModelStatus, GetMetaDataFunction, LogFunction, RpcInterfaceStatus } from "@itwin/core-bentley";

/** The error type thrown by this module. See [[IModelStatus]] for `errorNumber` values.
 * @public
 */
export class RpcError extends BentleyError {
  public constructor(errorNumber: number | IModelStatus | BentleyStatus | RpcInterfaceStatus, message: string, getMetaData?: GetMetaDataFunction) {
    super(errorNumber, message, getMetaData);
  }
}

/** @public */
export class ServerError extends RpcError {
  public constructor(errorNumber: number, message: string) {
    super(errorNumber, message);
    this.name = `Server error (${errorNumber})`;
  }
}

/** @public */
export class ServerTimeoutError extends RpcError {
  public constructor(message: string) {
    super(IModelStatus.ServerTimeout, message);
    this.name = "Server timeout error";
  }
}

/** @public */
export class BackendError extends RpcError {
  public constructor(errorNumber: number, name: string, message: string, getMetaData?: GetMetaDataFunction) {
    super(errorNumber, message, getMetaData);
    this.name = name;
  }
}

/** Intended for API "no content" semantics where the error case should not trigger application failure monitoring systems.
 * @public
 */
export class NoContentError extends RpcError {
  public constructor() {
    super(IModelStatus.NoContent, "No Content");
  }
}
