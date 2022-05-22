/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Common
 */

/** Selection mode flags for Table and Tree row selection
 * @public
 */
export enum SelectionModeFlags {
  SelectionLimitOne = 1 << 0,
  DragEnabled = 1 << 1,
  ToggleEnabled = 1 << 2,
  KeysEnabled = 1 << 3,
  None = 1 << 4,
}

/** Selection modes for Table and Tree row selection
 * @public
 */
export enum SelectionMode {
  /** Only one item selected at a time. */
  Single = SelectionModeFlags.SelectionLimitOne,
  /** Toggles items; drag only applies to desktop. */
  Multiple = SelectionModeFlags.DragEnabled | SelectionModeFlags.ToggleEnabled,
  /** Allows the use of Ctrl & Shift Keys in a desktop environment. */
  Extended = SelectionModeFlags.KeysEnabled | SelectionModeFlags.ToggleEnabled,
  /** Only one item selected at a time; also allows deselecting. */
  SingleAllowDeselect = SelectionModeFlags.SelectionLimitOne | SelectionModeFlags.ToggleEnabled,
  /** Do not allow (disable) selection */
  None = SelectionModeFlags.None,
}

/** Determines if a SelectionMode is active
 * @public
 */
export const hasSelectionModeFlag = (selectionMode: SelectionMode, flag: SelectionModeFlags): boolean => {
  return (selectionMode & flag) !== 0;
};
