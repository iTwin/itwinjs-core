/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module KeyboardShortcut */

/** Enumeration for Function Keys */
export enum FunctionKey {
  F1,
  F2,
  F3,
  F4,
  F5,
  F6,
  F7,
  F8,
  F9,
  F10,
  F11,
  F12,
}

/** Enumeration for Special Keys */
export enum SpecialKey {
  Home,
  End,
  PageUp,
  PageDown,
  Escape,
  Delete,
  Insert,
  Tab,
  Left,
  Right,
  Up,
  Down,
  Return,
  Space,
  Back,
}

/** Definition for a Keyboard Shortcut */
export interface KeyboardShortcutDef {
  // oneOf the following 3 required
  key?: string;                       // The key that invokes the shortcut
  functionKey?: FunctionKey;          // The function key that invokes the shortcut. Valid value is F1 through F12
  specialKey?: SpecialKey;            // The special key that invokes the shortcut

  // oneOf the following 3 required
  itemId?: string;                    // The item to execute when this shortcut is invoked
  itemIdExpr?: string;                // An expression for a item to execute when this shortcut is invoked
  shortcuts?: KeyboardShortcutDef[];  // Nested array of shortcut definitions

  featureId?: string;
  isVisible?: boolean;    // Default - true
  itemSyncMsg?: string[];
  icon: string;           // TODO
  label: string;          // TODO

  isAltKeyRequired?: boolean;   // Default - false
  isCtrlKeyRequired?: boolean;  // Default - false
  isShiftKeyRequired?: boolean; // Default - false
}

// export default KeyboardShortcutDef;
