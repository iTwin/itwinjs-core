/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

/** Enum for AppUi 1 `Zone` locations that can have widgets added to them at run-time via [[UiItemsProvider]].
 * @public @deprecated in 3.x.
 */
export enum AbstractZoneLocation {
  CenterLeft = 4,
  CenterRight = 6,
  BottomLeft = 7,
  BottomRight = 9,
}

/** Available Stage Panel locations.
 * @public
 */
export enum StagePanelLocation {
  Top = 101,
  TopMost,
  Left,
  Right,
  Bottom,
  BottomMost,
}

/** Enum for Stage Panel Sections
 * @public
 */
export enum StagePanelSection {
  Start,
  /** @deprecated in 3.x. - all widgets that a targeted for Middle will be placed in `End` section */
  Middle,
  End,
}
