/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import * as React from "react";

/** Returns a stateful value that indicates if the component is targeted/hovered.
 * @internal
 */
export const useTargeted = (ref: React.RefObject<Element>) => {
  const [targeted, setTargeted] = React.useState(false);
  React.useEffect(() => {
    const handleDocumentPointerMove = (e: PointerEvent) => {
      setTargeted(!!ref.current && !!e.target && (e.target instanceof Node) && ref.current.contains(e.target));
    };
    document.addEventListener("pointermove", handleDocumentPointerMove);
    return () => {
      document.removeEventListener("pointermove", handleDocumentPointerMove);
    };
  }, [ref]);
  return targeted;
};
