/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ContentLayoutProps } from "./ContentLayoutProps";

/** @packageDocumentation
 * @module ContentView
 */
export const singleView: ContentLayoutProps =
 {
   id: "uia:singleView",
   description: "Single Content View",
 };

export const fourQuadrants: ContentLayoutProps =
 {
   id: "uia:fourQuadrants",
   description: "Four Views, two stacked on the left, two stacked on the right",
   verticalSplit: {
     id: "uia:fourQuadrantVerticalSplit",
     percentage: 0.50,
     lock: true,
     minSizeLeft: 100,
     minSizeRight: 100,
     left: { horizontalSplit: { id: "uia:fourQuadrantsLeftHorizontal", percentage: 0.50, top: 0, bottom: 1, lock: true, minSizeTop: 50, minSizeBottom: 50 } },
     right: { horizontalSplit: { id: "uia:fourQuadrantsRightHorizontal", percentage: 0.50, top: 2, bottom: 3, lock: true, minSizeTop: 50, minSizeBottom: 50 } },
   },
 };
export const twoVerticalSplit: ContentLayoutProps =
 {
   id: "uia:twoVerticalSplit",
   description: "Two Views, side by side",
   verticalSplit: {
     id: "uia:twoViewsVerticalSplit",
     percentage: 0.50,
     left: 0,
     right: 1,
   },
 };
export const twoHorizontalSplit: ContentLayoutProps =
 {
   id: "uia:twoHorizontalSplit",
   description: "Two views, stack one on top of the other",
   horizontalSplit: {
     id: "uia:twoViewsHorizontalSplit",
     percentage: 0.50,
     lock: true,
     top: 0,
     bottom: 1,
   },
 };

export const threeViewsTwoOnLeft: ContentLayoutProps =
 {
   id: "uia:threeViewsTwoOnLeft",
   description: "Three views, one on the right with the two on the left stacked one of top of the other",
   verticalSplit: {
     id: "uia:twoViewsOnLeftSplit",
     percentage: 0.50,
     left: { horizontalSplit: { id: "uia:twoViewsOnLeftHorizontal", percentage: 0.50, top: 0, bottom: 1, lock: true, minSizeTop: 50, minSizeBottom: 50 } },
     right: 2,
   },
 };

export const threeViewsTwoOnRight: ContentLayoutProps =
 {
   id: "uia:threeViewsTwoOnRight",
   description: "Three views, one on the left with the two on the right stacked one of top of the other",
   verticalSplit: {
     id: "uia:twoViewsOnRightSplit",
     percentage: 0.50,
     left: 0,
     right: { horizontalSplit: { id: "uia:twoViewsOnRightHorizontal", percentage: 0.50, top: 1, bottom: 2, lock: true, minSizeTop: 50, minSizeBottom: 50 } },
   },
 };

export const threeViewsTwoOnBottom: ContentLayoutProps =
 {
   id: "uia:threeViewsTwoOnBottom",
   description: "Three Views, one on top and two side by side on the bottom",
   horizontalSplit: {
     id: "uia:threeViewsTwoOnBottomHorizontal",
     percentage: 0.50,
     lock: true,
     top: 0,
     bottom: { verticalSplit: { id: "uia:twoViewsOnBottomVertical", percentage: 0.50, left: 1, right: 2, lock: true, minSizeLeft: 50, minSizeRight: 50 } },
   },
 };

export const threeViewsTwoOnTop: ContentLayoutProps =
 {
   id: "uia:threeViewsTwoOnTop",
   description: "Three Views, two side by side on top and one on the bottom",
   horizontalSplit: {
     id: "uia:twoViewsOnTopHorizontal",
     percentage: 0.50,
     lock: true,
     top: { verticalSplit: { id: "uia:twoViewsOnTopVertical", percentage: 0.50, left: 0, right: 1, lock: true, minSizeLeft: 50, minSizeRight: 50 } },
     bottom: 2,
   },
 };

export const standardViewLayouts: ContentLayoutProps[] = [
  singleView,
  fourQuadrants,
  twoVerticalSplit,
  twoHorizontalSplit,
  threeViewsTwoOnLeft,
  threeViewsTwoOnRight,
  threeViewsTwoOnBottom,
  threeViewsTwoOnTop,
];
