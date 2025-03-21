/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { ITwinError } from "@itwin/core-bentley";

/**
 * @beta
 */
export namespace ChannelError {

  export interface Error extends ITwinError.Error {
    channelKey: string;
  }

  export const scope = "itwin-channel-errors";

  export type Key = "may-not-nest" | "not-allowed" | "root-exists";

  export function throwError(key: Key, message: string, channelKey: string): never {
    ITwinError.throwError<Error>({ iTwinErrorId: { scope, key }, message, channelKey });
  }
  export function isError(error: unknown, key: Key): error is ChannelError.Error {
    return ITwinError.isError<Error>(error, scope, key) && typeof error.channelKey === "string";
  }
}

