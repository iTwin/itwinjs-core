/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

/** Widget state enum.
 * @public
 */
export enum WidgetState {
  /** Widget tab is visible and active and its contents are visible */
  Open,
  /** Widget tab is visible but its contents are not visible */
  Closed,
  /** Widget tab nor its contents are visible */
  Hidden,
  /** Widget tab is in a 'floating' state and is not docked in zone's tab stack */
  Floating,
  /** Widget tab is visible but its contents are not loaded */
  Unloaded,
}
