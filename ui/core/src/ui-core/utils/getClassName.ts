/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utilities */

/** Gets the class name for an object.
 * @internal
 */
export const getClassName = (obj: any): string => {
  let className = "";

  if (obj) {
    if (obj.name)
      className = obj.name;
    else if (obj.constructor && obj.constructor.name)
      className = obj.constructor.name;
  }

  return className;
};
