/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

/** Enumeration for Function Keys
 * @public @deprecated in 4.3. Please use the `ts-key-enum` npm package or string literals.
 */
export enum FunctionKey {
  F1 = "F1",
  F2 = "F2",
  F3 = "F3",
  F4 = "F4",
  F5 = "F5",
  F6 = "F6",
  F7 = "F7",
  F8 = "F8",
  F9 = "F9",
  F10 = "F10",
  F11 = "F11",
  F12 = "F12",
}

/** Enumeration for Special Keys
 * @public @deprecated in 4.3. Please use the `ts-key-enum` npm package or string literals.
 */
export enum SpecialKey {
  Home = "Home",
  End = "End",
  PageUp = "PageUp",
  PageDown = "PageDown",
  Escape = "Escape",
  Delete = "Delete",
  Insert = "Insert",
  Tab = "Tab",
  ArrowLeft = "ArrowLeft",
  ArrowRight = "ArrowRight",
  ArrowUp = "ArrowUp",
  ArrowDown = "ArrowDown",
  Enter = "Enter",
  Return = "Enter",
  Space = " ",
  Backspace = "Backspace",
  Clear = "Clear",
  Divide = "Divide",
  Multiply = "Multiply",
  Subtract = "Subtract",
  Add = "Add",
  Decimal = "Decimal",
}

/** Determines if a KeyboardEvent.key is an Arrow key
 * @public @deprecated in 4.3. Please use a custom implementation moving forward.
 */
export function isArrowKey(key: string): boolean {
  // eslint-disable-next-line deprecation/deprecation
  return (key === SpecialKey.ArrowLeft || key === SpecialKey.ArrowRight || key === SpecialKey.ArrowUp || key === SpecialKey.ArrowDown);
}
