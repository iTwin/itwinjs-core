/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { LoggingMetaData } from "@itwin/core-bentley";
import { isITwinError, ITwinError, throwITwinError } from "./ITwinError";

/**
 * @beta
 */
export namespace ChannelError {

  export interface Error extends ITwinError {
    channelKey: string;
  }

  export const scope = "itwin-channel-errors";

  export type Key = "may-not-nest" | "not-allowed" | "root-exists";

  export function throwError(key: Key, message: string, channelKey: string, metadata?: LoggingMetaData): never {
    throwITwinError<Error>({ scope, errorKey: key, message, channelKey, metadata });
  }
  export function isError(error: any, key: Key): error is Error {
    return isITwinError(error, scope, key);
  }
}

