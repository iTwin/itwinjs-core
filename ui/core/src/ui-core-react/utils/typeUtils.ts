/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

/** Used to omit properties in a given interface
 * @public
 */
export type Omit<T, K> = Pick<T, Exclude<keyof T, K>>;
