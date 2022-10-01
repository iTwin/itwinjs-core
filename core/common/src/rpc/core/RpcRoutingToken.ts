/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

/** @internal */
export class RpcRoutingToken {
  private static _next = -1;

  public static generate(debugLabel = ""): RpcRoutingToken {
    return new RpcRoutingToken(++this._next, debugLabel);
  }

  public static readonly default = RpcRoutingToken.generate("default");

  public readonly id: number;
  public readonly debugLabel: string;

  private constructor(id: number, debugLabel: string) {
    this.id = id;
    this.debugLabel = debugLabel;
  }
}
