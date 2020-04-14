/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import * as React from "react";
import { Rectangle } from "../Rectangle";
import { Point } from "../Point";

/** Returns the shortest distance from the element to the mouse.
 * @internal
 */
export const useProximityToMouse = (elementRef: React.RefObject<Element>) => {
  const [proximity, setProximity] = React.useState(0);
  React.useEffect(() => {
    const handleDocumentPointerMove = (e: PointerEvent) => {
      if (elementRef.current) {
        const clientRect = elementRef.current.getBoundingClientRect();
        const rectangle = Rectangle.create(clientRect);
        const point = new Point(e.pageX, e.pageY);
        setProximity(rectangle.getShortestDistanceToPoint(point));
      }
    };
    document.addEventListener("pointermove", handleDocumentPointerMove);
    return () => {
      document.removeEventListener("pointermove", handleDocumentPointerMove);
    };
  }, [elementRef]);
  return proximity;
};
