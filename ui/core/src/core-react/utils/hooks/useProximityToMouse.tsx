/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import * as React from "react";
import { Point } from "../Point";
import { Rectangle } from "../Rectangle";

/** @internal */
export class WidgetElementSet extends Set<React.RefObject<Element>> { }

/** Returns the proximity scale associated with the shortest distance from the element(s) to the mouse.
 * @internal
 */
export const useProximityToMouse = (elementSet: WidgetElementSet, snap: boolean = false, threshold = PROXIMITY_THRESHOLD_DEFAULT) => {
  const [proximityScale, setProximityScale] = React.useState(1.0);

  React.useEffect(() => {
    const handleDocumentPointerMove = (e: PointerEvent) => {
      let shortestProximity = Number.MAX_SAFE_INTEGER;

      for (const ref of elementSet) {
        // istanbul ignore else
        if (ref.current) {
          const clientRect = ref.current.getBoundingClientRect();
          const rectangle = Rectangle.create(clientRect);
          const point = new Point(e.pageX, e.pageY);
          shortestProximity = Math.min(rectangle.getShortestDistanceToPoint(point), shortestProximity);
        }
      }

      const scale = calculateProximityScale(shortestProximity, snap, threshold);
      if (scale !== proximityScale)
        setProximityScale(scale);
    };

    document.addEventListener("pointermove", handleDocumentPointerMove);

    return () => {
      document.removeEventListener("pointermove", handleDocumentPointerMove);
    };
  }, [elementSet, proximityScale, snap, threshold]);

  return proximityScale;
};

/** Default proximity threshold.
 * @internal
 */
export const PROXIMITY_THRESHOLD_DEFAULT = 100;

/** Default toolbar opacity.
 * @internal
 */
export const TOOLBAR_OPACITY_DEFAULT = 0.5;

/** Default toolbar box-shadow opacity.
 * @internal
 */
export const TOOLBAR_BOX_SHADOW_OPACITY_DEFAULT = 0.35;

/** Default toolbar backdrop-filter blur.
 * @internal
 */
export const TOOLBAR_BACKDROP_FILTER_BLUR_DEFAULT = 10;

/** Calculates a proximity scale for further calculations given the proximity and threshold.
 * @internal
 */
export const calculateProximityScale = (proximity: number, snap: boolean = false, threshold = PROXIMITY_THRESHOLD_DEFAULT): number => {
  let scale = ((proximity < threshold) ? threshold - proximity : 0) / threshold;
  if (snap && scale > 0)
    scale = 1.0;
  return scale;
};

/** Calculates a toolbar opacity based on a given proximity scale.
 * @internal
 */
export const calculateToolbarOpacity = (proximityScale: number): number => {
  return TOOLBAR_OPACITY_DEFAULT * proximityScale;
};

/** Calculates a box-shadow opacity based on a given proximity scale.
 * @internal
 */
export const calculateBoxShadowOpacity = (proximityScale: number): number => {
  return TOOLBAR_BOX_SHADOW_OPACITY_DEFAULT * proximityScale;
};

/** Calculates a backdrop-filter blur based on a given proximity scale.
 * @internal
 */
export const calculateBackdropFilterBlur = (proximityScale: number): number => {
  return TOOLBAR_BACKDROP_FILTER_BLUR_DEFAULT * proximityScale;
};

/** Gets the Toolbar background-color based on a given opacity.
 * @internal
 */
export const getToolbarBackgroundColor = (opacity: number): string => {
  return `rgba(var(--buic-background-2-rgb), ${opacity})`;
};

/** Gets the Toolbar box-shadow based on a given opacity.
 * @internal
 */
export const getToolbarBoxShadow = (opacity: number): string => {
  return `0 1px 3px 0 rgba(0, 0, 0, ${opacity})`;
};

/** Gets the Toolbar backdrop-filter based on a given blur amount.
 * @internal
 */
export const getToolbarBackdropFilter = (filterBlur: number): string => {
  return `blur(${filterBlur}px)`;
};
