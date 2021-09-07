/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ContentLayoutProps } from "./ContentLayoutProps";

/** @packageDocumentation
 * @module ContentView
 */
export const uifwSingleView: ContentLayoutProps =
 {
   id: "uifw:singleView",
   description: "Single Content View",
 };

export const uifwFourQuadrants: ContentLayoutProps =
 {
   id: "uifw:fourQuadrants",
   description: "Four Views, two stacked on the left, two stacked on the right",
   verticalSplit: {
     id: "uifw:fourQuadrantVerticalSplit",
     percentage: 0.50,
     lock: true,
     minSizeLeft: 100,
     minSizeRight: 100,
     left: { horizontalSplit: { id: "uifw:fourQuadrantsLeftHorizontal", percentage: 0.50, top: 0, bottom: 1, lock: true, minSizeTop: 50, minSizeBottom: 50 } },
     right: { horizontalSplit: { id: "uifw:fourQuadrantsRightHorizontal", percentage: 0.50, top: 2, bottom: 3, lock: true, minSizeTop: 50, minSizeBottom: 50 } },
   },
 };
export const uifwTwoVerticalSplit: ContentLayoutProps =
 {
   id: "uifw:twoVerticalSplit",
   description: "Two Views, side by side",
   verticalSplit: {
     id: "uifw:twoViewsVerticalSplit",
     percentage: 0.50,
     left: 0,
     right: 1,
   },
 };
export const uifwTwoHorizontalSplit: ContentLayoutProps =
 {
   id: "uifw:twoHorizontalSplit",
   description: "Two views, stack one on top of the other",
   horizontalSplit: {
     id: "uifw:twoViewsHorizontalSplit",
     percentage: 0.50,
     lock: true,
     top: 0,
     bottom: 1,
   },
 };

export const uifwThreeViewsTwoOnLeft: ContentLayoutProps =
 {
   id: "uifw:threeViewsTwoOnLeft",
   description: "Three views, one on the right with the two on the left stacked one of top of the other",
   verticalSplit: {
     id: "uifw:twoViewsOnLeftSplit",
     percentage: 0.50,
     left: { horizontalSplit: { id: "uifw:twoViewsOnLeftHorizontal", percentage: 0.50, top: 0, bottom: 1, lock: true, minSizeTop: 50, minSizeBottom: 50 } },
     right: 2,
   },
 };

export const uifwThreeViewsTwoOnRight: ContentLayoutProps =
 {
   id: "uifw:threeViewsTwoOnRight",
   description: "Three views, one on the left with the two on the right stacked one of top of the other",
   verticalSplit: {
     id: "uifw:twoViewsOnRightSplit",
     percentage: 0.50,
     left: 0,
     right: { horizontalSplit: { id: "uifw:twoViewsOnRightHorizontal", percentage: 0.50, top: 1, bottom: 2, lock: true, minSizeTop: 50, minSizeBottom: 50 } },
   },
 };

export const uifwThreeViewsTwoOnBottom: ContentLayoutProps =
 {
   id: "uifw:threeViewsTwoOnBottom",
   description: "Three Views, one on top and two side by side on the bottom",
   horizontalSplit: {
     id: "uifw:threeViewsTwoOnBottomHorizontal",
     percentage: 0.50,
     lock: true,
     top: 0,
     bottom: { verticalSplit: { id: "uifw:twoViewsOnBottomVertical", percentage: 0.50, left: 1, right: 2, lock: true, minSizeLeft: 50, minSizeRight: 50 } },
   },
 };

export const uifwThreeViewsTwoOnTop: ContentLayoutProps =
 {
   id: "uifw:threeViewsTwoOnTop",
   description: "Three Views, two side by side on top and one on the bottom",
   horizontalSplit: {
     id: "uifw:twoViewsOnTopHorizontal",
     percentage: 0.50,
     lock: true,
     top: { verticalSplit: { id: "uifw:twoViewsOnTopVertical", percentage: 0.50, left: 0, right: 1, lock: true, minSizeLeft: 50, minSizeRight: 50 } },
     bottom: 2,
   },
 };

export const standardViewLayouts: ContentLayoutProps[] = [
  uifwSingleView,
  uifwFourQuadrants,
  uifwTwoVerticalSplit,
  uifwTwoHorizontalSplit,
  uifwThreeViewsTwoOnLeft,
  uifwThreeViewsTwoOnRight,
  uifwThreeViewsTwoOnBottom,
  uifwThreeViewsTwoOnTop,
];
