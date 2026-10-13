/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

/** Thrown while reading a tile's content when the failure is transient, e.g. the worker decoding the content stopped. The tile is then
 * left unloaded, to be requested again if it is selected again, instead of being marked as not found.
 * @internal
 */
export class RetryableTileContentError extends Error { }
