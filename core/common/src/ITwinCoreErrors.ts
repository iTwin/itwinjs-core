/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { ITwinError } from "@itwin/core-bentley";

/** An error originating from the [[ChannelControl]] interface.
 * @beta
 */
export interface ChannelError extends ITwinError {
  /** The channel key that caused the error. */
  readonly channelKey: string;
}

/** @beta */
export namespace ChannelError {
  // the scope for all `ChannelError`s.
  export const scope = "itwin-channel-errors";

  /** The set of keys identifying the different kinds of `ChannelError`s */
  export type Key =
    /** an attempt to create a channel within an existing channel */
    "may-not-nest" |
    /** an attempt to use a channel that was not "allowed" */
    "not-allowed" |
    /** the root channel already exists */
    "root-exists";

  /** Instantiate and throw a ChannelError */
  export function throwError(key: Key, message: string, channelKey: string): never {
    ITwinError.throwError<ChannelError>({ iTwinErrorId: { scope, key }, message, channelKey });
  }
  /** Determine whether an error object is a ChannelError */
  export function isError(error: unknown, key?: Key): error is ChannelError {
    return ITwinError.isError<ChannelError>(error, scope, key) && typeof error.channelKey === "string";
  }
}
