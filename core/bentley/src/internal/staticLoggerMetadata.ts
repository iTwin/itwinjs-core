/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Logging
 */

import { LoggingMetaData } from "../BentleyError";

/** All static metadata is combined with per-call metadata and stringified in every log message.
 * Static metadata can either be an object or a function that returns an object.
 * Use a key to identify entries in the map so the can be removed individually.
 * @internal
 */
export const staticLoggerMetadata = new Map<String, LoggingMetaData>();
