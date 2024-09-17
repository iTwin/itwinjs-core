/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ContentView
 */

/* eslint-disable deprecation/deprecation */

/** Base interface for layout split properties
 * @public
 * @deprecated in 4.10.x. Use `LayoutSplitPropsBase` from `@itwin/appui-react`.
 */
export interface LayoutSplitPropsBase {
  /** The id used to save the current state of the splitter */
  id: string;
  /** The percentage of this layout that should be occupied by the top/left fragment by default */
  percentage: number;
  /** Used to lock splitter into fixed position. Defaults to false. */
  lock?: boolean;
}

/** Properties for a layout fragment
 * @public
 * @deprecated in 4.10.x. Use `LayoutFragmentProps` from `@itwin/appui-react`.
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
 * @deprecated in 4.10.x. Use `LayoutVerticalSplitProps` from `@itwin/appui-react`.
 */
export interface LayoutVerticalSplitProps extends LayoutSplitPropsBase {
  /** Left layout fragment properties. */
  left: LayoutFragmentProps | number;
  /** Right layout fragment properties. */
  right: LayoutFragmentProps | number;

  /** Minimum size of the left fragment. */
  minSizeLeft?: number;
  /** Minimum size of the right fragment. */
  minSizeRight?: number;
}

/** Properties for a horizontal layout split
 * When a member is a [[LayoutFragmentProps]], it creates a nested split pane.
 * When a number, it represents an index into a [[ContentGroup]].
 * @public
 * @deprecated in 4.10.x. Use `LayoutHorizontalSplitProps` from `@itwin/appui-react`.
 */
export interface LayoutHorizontalSplitProps extends LayoutSplitPropsBase {
  /** Top layout fragment properties. */
  top: LayoutFragmentProps | number;
  /** Bottom layout fragment properties. */
  bottom: LayoutFragmentProps | number;

  /** Minimum size of the top fragment. */
  minSizeTop?: number;
  /** Minimum size of the bottom fragment. */
  minSizeBottom?: number;
}

/** Properties for a [[ContentLayoutDef]]
 * @deprecated in 4.10.x. Use `ContentLayoutProps` from `@itwin/appui-react`.
 */
export interface ContentLayoutProps extends LayoutFragmentProps {
  /** ID for this Content Layout */
  id: string;
  /** Description of the layout*/
  description?: string;
}
