/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ContentView */

/** Base interface for layout split properties
 * @public
 */
export interface LayoutSplitPropsBase {
  /** The id used to save the current state of the splitter */
  id?: string;
  /** The percentage of this layout that should be occupied by the left/top fragment by default */
  percentage: number;
  /** Used to lock splitter into fixed position. Defaults to false. */
  lock?: boolean;
}

/** Properties for a layout fragment
 * @public
 */
export interface LayoutFragmentProps {
  /** Vertical split layout properties */
  verticalSplit?: LayoutVerticalSplitProps;
  /** Horizontal split layout properties */
  horizontalSplit?: LayoutHorizontalSplitProps;
}

/** Properties for a vertical layout split.
 * When a member is a [[LayoutFragmentProps]], it creates a nested split pane.
 * When a number, it represents an index into a [[ContentGroup]].
 * @public
 */
export interface LayoutVerticalSplitProps extends LayoutSplitPropsBase {
  /** Left layout properties. */
  left: LayoutFragmentProps | number;
  /** Right layout properties. */
  right: LayoutFragmentProps | number;
}

/** Properties for a horizontal layout split
 * When a member is a [[LayoutFragmentProps]], it creates a nested split pane.
 * When a number, it represents an index into a [[ContentGroup]].
 * @public
 */
export interface LayoutHorizontalSplitProps extends LayoutSplitPropsBase {
  /** Top layout properties. */
  top: LayoutFragmentProps | number;
  /** Bottom layout properties. */
  bottom: LayoutFragmentProps | number;
}

/** Properties for a [[ContentLayoutDef]]
 * @public
 */
export interface ContentLayoutProps extends LayoutFragmentProps {
  /** ID for this Content Layout */
  id?: string;
  /** Localization key for a description. */
  descriptionKey?: string;
  /** The priority for the layout. Determines its position in menus. Higher numbers appear first. */
  priority?: number;
}
