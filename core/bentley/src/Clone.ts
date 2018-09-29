/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utils */

/**
 * An agreement that any class that implements this has a clone routine defined
 * ensure cloning is done in a consistent manner
 */
export interface Cloneable<T> {
  clone: (src: T, out?: T) => T;
}
