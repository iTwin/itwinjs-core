/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

/** Gets the class name for an object.
 * @internal
 * @deprecated in 4.3. Please use your own implementation in the future.  Though internal, this requires deprecation due to known public usage in @itwin/core-react.
 */
export const getClassName = (obj: any): string => {
  let className = "";

  if (obj) {
    if (obj.name)
      className = obj.name;
    else {
      // istanbul ignore else
      if (obj.constructor && obj.constructor.name)
        className = obj.constructor.name;
    }
  }

  return className;
};

