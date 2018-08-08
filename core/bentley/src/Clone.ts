/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Utils */

/**
 * An agreement that any class that implements this has a clone routine defined
 * ensure cloning is done in a consistent manner
 */
export interface Cloneable<T> {
  clone: (src: T, out?: T) => T;
}
