/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ClassUtils
 */

/** Utility functions for dealing with JavaScript classes
 * @beta
 */
export namespace ClassUtils {
  /** Check if class `subclass` is a different class from `superclass` but extends from `superclass`
   * @param subclass the class that may be a subclass of `superclass`
   * @param superclass the class that may be a base class of `subclass`
   * @returns whether `subclass` is a proper subclass of `superclass`
   */
  export function isProperSubclassOf<
    A extends new (..._: any[]) => any,
    B extends new (..._: any[]) => any,
  >(subclass: A | B, superclass: B): subclass is B {
    return subclass.prototype instanceof superclass;
  }
}
