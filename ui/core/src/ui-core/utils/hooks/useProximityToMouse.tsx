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
export const calculateProximityScale = (proximity: number, threshold = PROXIMITY_THRESHOLD_DEFAULT): number => {
  const scale = ((proximity < threshold) ? threshold - proximity : 0) / threshold;
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
