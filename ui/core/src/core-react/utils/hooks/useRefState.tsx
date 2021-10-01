/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import * as React from "react";

/** Hook used to store an HTMLElement in state by using ref callback returned from hook.
 * *Example:*
 * ``` tsx
 *  const [divElementRef, divElement] = useRefState<HTMLDivElement>();
 *  const ownerDoc = divElement?.ownerDocument ?? document;
 *
 *  return (
 *    <div ref={divElementRef} >
 *      ....
 *    </div>
 *  );
 * ```
 * }

 * @internal
 */
export function useRefState<T>(): [React.Ref<T>, T | undefined] {
  const [element, setElement] = React.useState<T>();
  const ref = React.useCallback((instance: T | null) => {
    setElement(instance || undefined);
  }, []);
  return [ref, element];
}
