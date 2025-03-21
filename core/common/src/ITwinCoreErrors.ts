/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { ITwinError } from "@itwin/core-bentley";

/**
 * Errors associated with the `ChannelControl` interface. This interface exists in the common package so
 * they may be handled on both the frontend and backend.
 * @beta
 */
export namespace ChannelError {
  export interface Error extends ITwinError.Error {
    /** the channelKey that caused the error */
    channelKey: string;
  }

  // the value of scope for all ChannelError
  export const scope = "itwin-channel-errors";

  /** The set of keys for `ChannelError`s */
  export type Key =
    /** an attempt to create a channel within an existing channel */
    "may-not-nest" |
    /** an attempt to use a channel that was not "allowed" */
    "not-allowed" |
    /** the root channel already exists */
    "root-exists";

  /** Throw a Channel Error */
  export function throwError(key: Key, message: string, channelKey: string): never {
    ITwinError.throwError<Error>({ iTwinErrorId: { scope, key }, message, channelKey });
  }
  /** Determine whether an error object is a ChannelError */
  export function isError(error: unknown, key: Key): error is ChannelError.Error {
    return ITwinError.isError<Error>(error, scope, key) && typeof error.channelKey === "string";
  }
}
