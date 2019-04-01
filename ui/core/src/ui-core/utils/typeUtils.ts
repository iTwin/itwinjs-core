/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utilities */

/** Used to omit properties in a given interface
 * @public
 */
export type Omit<T, K> = Pick<T, Exclude<keyof T, K>>;
