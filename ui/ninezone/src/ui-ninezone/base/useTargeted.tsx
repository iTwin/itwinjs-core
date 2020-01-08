/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Base */

import * as React from "react";

/** Returns a stateful value that indicates if the component is targeted/hovered.
 * @internal
 */
export const useTargeted = (elementRef: React.RefObject<Element>) => {
  const [targeted, setTargeted] = React.useState(false);
  React.useEffect(() => {
    const handleDocumentPointerMove = (e: PointerEvent) => {
      setTargeted(!!elementRef.current && !!e.target && (e.target instanceof Node) && elementRef.current.contains(e.target));
    };
    document.addEventListener("pointermove", handleDocumentPointerMove);
    return () => {
      document.removeEventListener("pointermove", handleDocumentPointerMove);
    };
  }, [elementRef]);
  return targeted;
};
