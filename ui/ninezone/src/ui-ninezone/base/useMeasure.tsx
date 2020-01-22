/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */

import * as React from "react";

/** First value in returned array is a ref to element that should be measured. Second value is measure function.
 * @internal
 */
export function useMeasure<T extends Element>(): [React.RefObject<T>, () => number] {
  const ref = React.useRef<T>(null);
  const measure = React.useCallback(() => {
    if (!ref.current)
      return 0;
    const rect = ref.current.getBoundingClientRect();
    return rect.width;
  }, []);
  return [ref, measure];
}
