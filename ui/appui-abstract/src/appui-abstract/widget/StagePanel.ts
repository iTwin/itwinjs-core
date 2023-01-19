/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

/** Enum for AppUi 1 `Zone` locations that can have widgets added to them at run-time via [[UiItemsProvider]].
 * @public @deprecated
 */
export enum AbstractZoneLocation {
  CenterLeft = 4,
  CenterRight = 6,
  BottomLeft = 7,
  BottomRight = 9,
}

/** Available Stage Panel locations.
 * @deprecated in 3.6. Use [StagePanelLocation]($appui-react) instead.
 * @public
 */
export enum StagePanelLocation {
  Top = 101,
  /** @deprecated Used in UI1.0 only. */
  TopMost,
  Left,
  Right,
  Bottom,
  /** @deprecated Used in UI1.0 only. */
  BottomMost,
}

/** Enum for Stage Panel Sections
 * @deprecated in 3.6. Use [StagePanelSection]($appui-react) instead.
 * @public
 */
export enum StagePanelSection {
  Start,
  /** @deprecated - all widgets that a targeted for Middle will be placed in `End` section */
  Middle,
  End,
}
