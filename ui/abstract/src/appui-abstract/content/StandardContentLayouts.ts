/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ContentLayoutProps } from "./ContentLayoutProps";

/** @packageDocumentation
 * @module ContentView
 */

/**
 * Class that define Standard Content Layouts that can be used to specify how the content is arranged in a frontstage.
 * @public
 */
export class StandardContentLayouts {
  public static readonly singleView: ContentLayoutProps = {
    id: "uia:singleView",
    description: "Single Content View",
  };

  public static readonly fourQuadrants: ContentLayoutProps = {
    id: "uia:fourQuadrants",
    description: "Four Views, two stacked on the left, two stacked on the right",
    verticalSplit: {
      id: "uia:fourQuadrantVerticalSplit",
      percentage: 0.50,
      lock: false,
      minSizeLeft: 100,
      minSizeRight: 100,
      left: { horizontalSplit: { id: "uia:fourQuadrantsLeftHorizontal", percentage: 0.50, top: 0, bottom: 1, lock: false, minSizeTop: 50, minSizeBottom: 50 } },
      right: { horizontalSplit: { id: "uia:fourQuadrantsRightHorizontal", percentage: 0.50, top: 2, bottom: 3, lock: false, minSizeTop: 50, minSizeBottom: 50 } },
    },
  };

  public static readonly twoVerticalSplit: ContentLayoutProps = {
    id: "uia:twoVerticalSplit",
    description: "Two Views, side by side",
    verticalSplit: {
      id: "uia:twoViewsVerticalSplit",
      percentage: 0.50,
      left: 0,
      right: 1,
    },
  };
  public static readonly twoHorizontalSplit: ContentLayoutProps = {
    id: "uia:twoHorizontalSplit",
    description: "Two views, stack one on top of the other",
    horizontalSplit: {
      id: "uia:twoViewsHorizontalSplit",
      percentage: 0.50,
      lock: false,
      top: 0,
      bottom: 1,
    },
  };

  public static readonly threeViewsTwoOnLeft: ContentLayoutProps = {
    id: "uia:threeViewsTwoOnLeft",
    description: "Three views, one on the right with the two on the left stacked one of top of the other",
    verticalSplit: {
      id: "uia:twoViewsOnLeftSplit",
      percentage: 0.50,
      left: { horizontalSplit: { id: "uia:twoViewsOnLeftHorizontal", percentage: 0.50, top: 0, bottom: 1, lock: false, minSizeTop: 50, minSizeBottom: 50 } },
      right: 2,
    },
  };

  public static readonly threeViewsTwoOnRight: ContentLayoutProps = {
    id: "uia:threeViewsTwoOnRight",
    description: "Three views, one on the left with the two on the right stacked one of top of the other",
    verticalSplit: {
      id: "uia:twoViewsOnRightSplit",
      percentage: 0.50,
      left: 0,
      right: { horizontalSplit: { id: "uia:twoViewsOnRightHorizontal", percentage: 0.50, top: 1, bottom: 2, lock: false, minSizeTop: 50, minSizeBottom: 50 } },
    },
  };

  public static readonly threeViewsTwoOnBottom: ContentLayoutProps = {
    id: "uia:threeViewsTwoOnBottom",
    description: "Three Views, one on top and two side by side on the bottom",
    horizontalSplit: {
      id: "uia:threeViewsTwoOnBottomHorizontal",
      percentage: 0.50,
      lock: false,
      top: 0,
      bottom: { verticalSplit: { id: "uia:twoViewsOnBottomVertical", percentage: 0.50, left: 1, right: 2, lock: false, minSizeLeft: 50, minSizeRight: 50 } },
    },
  };

  public static readonly threeViewsTwoOnTop: ContentLayoutProps = {
    id: "uia:threeViewsTwoOnTop",
    description: "Three Views, two side by side on top and one on the bottom",
    horizontalSplit: {
      id: "uia:twoViewsOnTopHorizontal",
      percentage: 0.50,
      lock: false,
      top: { verticalSplit: { id: "uia:twoViewsOnTopVertical", percentage: 0.50, left: 0, right: 1, lock: false, minSizeLeft: 50, minSizeRight: 50 } },
      bottom: 2,
    },
  };

  // provides and iterable list of standard content layouts
  public static readonly availableLayouts: ContentLayoutProps[] = [
    StandardContentLayouts.singleView,
    StandardContentLayouts.fourQuadrants,
    StandardContentLayouts.twoVerticalSplit,
    StandardContentLayouts.twoHorizontalSplit,
    StandardContentLayouts.threeViewsTwoOnLeft,
    StandardContentLayouts.threeViewsTwoOnRight,
    StandardContentLayouts.threeViewsTwoOnBottom,
    StandardContentLayouts.threeViewsTwoOnTop,
  ];

}
