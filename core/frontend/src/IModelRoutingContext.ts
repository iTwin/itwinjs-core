/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelConnection
 */

import { BentleyStatus, IModelError, RpcRoutingToken } from "@itwin/core-common";

/**
 * Controls the RPC routing for an iModel connection.
 * @public
 */
export class IModelRoutingContext {
  private static _current: IModelRoutingContext | undefined;

  public static for(token: RpcRoutingToken) {
    return new IModelRoutingContext(token);
  }

  public static readonly default = new IModelRoutingContext(RpcRoutingToken.default);

  public static get current(): IModelRoutingContext | undefined {
    return this._current;
  }

  public readonly token: RpcRoutingToken;

  public get active(): boolean { return IModelRoutingContext.current === this; }

  private constructor(token: RpcRoutingToken) {
    this.token = token;
  }

  public route<T>(handler: () => T): T {
    if (IModelRoutingContext.current) {
      throw new IModelError(BentleyStatus.ERROR, "Concurrent use is not supported.");
    }

    IModelRoutingContext._current = this;
    const value = handler();
    IModelRoutingContext._current = undefined;
    return value;
  }
}
