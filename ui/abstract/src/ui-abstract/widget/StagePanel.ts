/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

/** Enum for [[Zone]] Location used to specify zone location using AppUi 1.0 designations.
 * @public
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
  Middle,
  End,
}
