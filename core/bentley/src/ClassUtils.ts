/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

/** Check if class `subclass` is a different class from `superclass` but extends from `superclass`
 * @param subclass the class that may be a subclass of `superclass`
 * @param superclass the class that may be a base class of `subclass`
 * @note The constructors of all types must be `public`.
 * @returns whether `subclass` is a proper subclass of `superclass`
 * @public
 */
export function isProperSubclassOf<
  SuperClass extends new (..._: any[]) => any,
  NonSubClass extends new (..._: any[]) => any,
  SubClass extends new (..._: any[]) => InstanceType<SuperClass>,
>(subclass: SubClass | NonSubClass, superclass: SuperClass): subclass is SubClass {
  return subclass.prototype instanceof superclass;
}

/** Check if class `subclass` is `superclass` or extends from `superclass`
 * @param subclass the class that may be a subclass of `superclass`.
 * @param superclass the class that may be a base class of `subclass`.
 * @note The constructors of all types must be `public`.
 * @returns whether `subclass` is a subclass of `superclass`
 * @public
 */
export function isSubclassOf<
  SuperClass extends new (..._: any[]) => any,
  NonSubClass extends new (..._: any[]) => any,
  SubClass extends new (..._: any[]) => InstanceType<SuperClass>,
>(subclass: SuperClass | SubClass | NonSubClass, superclass: SuperClass): subclass is SubClass | SuperClass {
  return subclass === superclass || isProperSubclassOf(subclass, superclass);
}
