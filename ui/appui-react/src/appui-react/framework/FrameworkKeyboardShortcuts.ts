/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { FunctionKey, SpecialKey } from "@itwin/appui-abstract";
import { ActionButtonItemDef } from "../shared/ActionButtonItemDef";
import { ItemDefBase } from "../shared/ItemDefBase";
import { ItemProps } from "../shared/ItemProps";

/** Properties for a Keyboard Shortcut
 * @public
 */
export interface KeyboardShortcutProps extends ItemProps {
  /** The key that invokes the shortcut.
   * This is either an alphanumeric key, a function key or a special key.
   */
  key: string | FunctionKey | SpecialKey;

  /** The item to execute when this shortcut is invoked. Either 'item' or 'shortcuts' must be specified. */
  item?: ActionButtonItemDef;
  /** Nested array of shortcut props. Either 'item' or 'shortcuts' must be specified. */
  shortcuts?: KeyboardShortcutProps[];

  /** Indicates whether the Alt key required. Default - false */
  isAltKeyRequired?: boolean;
  /** Indicates whether the Ctrl key required. Default - false */
  isCtrlKeyRequired?: boolean;
  /** Indicates whether the Shift key required. Default - false */
  isShiftKeyRequired?: boolean;
}

/** Keyboard Shortcut used to execute an action
 * @public
 */
export interface FrameworkKeyboardShortcut extends ItemDefBase {
  /** Returns the id for this shortcut */
  readonly id: string;

  /** Returns the shortcut container */
  readonly shortcutContainer: FrameworkKeyboardShortcutContainer;

  /** Finds a shortcut with a given key in the shortcut's container */
  getShortcut(mapKey: string): FrameworkKeyboardShortcut | undefined;

  /** Returns the shortcut's key map key used as the id */
  readonly keyMapKey: string;

  /** Returns the [[ActionButtonItemDef]] associated with this shortcut */
  readonly item: ActionButtonItemDef | undefined;

  /** Called when the [[ActionButtonItemDef]] associated with this shortcut is invoked */
  itemPicked(): void;

  /** Gets the keyboard key */
  readonly key: string;
  /** Gets whether the Alt key required. */
  readonly isAltKeyRequired: boolean;
  /** Gets whether the Ctrl key required. */
  readonly isCtrlKeyRequired: boolean;
  /** Gets whether the Shift key required. */
  readonly isShiftKeyRequired: boolean;
  /** Gets whether this is a Function key. */
  readonly isFunctionKey: boolean;
  /** Gets whether this is a Special key. */
  readonly isSpecialKey: boolean;

}

/** Keyboard Shortcut Container
 * @public
 */
export interface FrameworkKeyboardShortcutContainer {
  /** Registers a Keyboard Shortcut associated with a given key in the managed list */
  registerKey(keyMapKey: string, inShortcut: FrameworkKeyboardShortcut): FrameworkKeyboardShortcut | undefined;

  /** Finds a Keyboard Shortcut associated with a given key */
  findKey(keyMapKey: string): FrameworkKeyboardShortcut | undefined;

  /** Determines if any Keyboard Shortcuts are available in this container */
  areKeyboardShortcutsAvailable(): boolean;

  /** Empties any Keyboard Shortcuts from this container */
  emptyData(): void;

  getAvailableKeyboardShortcuts(): FrameworkKeyboardShortcut[];

  /** Displays a menu for the Keyboard Shortcuts in this container */
  showShortcutsMenu(): void;
}

/**
 * [[UiFramework.keyboardShortcuts]] interface
 * @beta
 */
export interface FrameworkKeyboardShortcuts {
  /** Initialize the Keyboard Shortcut manager
   * @internal
  */
  initialize(): void;

  /** Loads Keyboard Shortcuts into the managed list */
  loadKeyboardShortcuts(shortcutList: KeyboardShortcutProps[]): void;

  /** Loads a Keyboard Shortcut into the managed list */
  loadKeyboardShortcut(shortcutProps: KeyboardShortcutProps): void;

  /** Processes a keystroke and invokes a matching Keyboard Shortcut */
  processKey(keyboardKey: string, isAltKeyPressed?: boolean, isCtrlKeyPressed?: boolean, isShiftKeyPressed?: boolean): boolean;

  /** Returns the managed list of Keyboard Shortcuts */
  readonly shortcutContainer: FrameworkKeyboardShortcutContainer;

  /** Returns a Keyboard Shortcut from the managed lists */
  getShortcut(keyMapKey: string): FrameworkKeyboardShortcut | undefined;

  /** Determines if focus is set to Home */
  readonly isFocusOnHome: boolean;

  /** Sets focus to Home */
  setFocusToHome(): void;

  /** Displays the Keyboard Shortcuts menu at the cursor */
  displayShortcutsMenu(): void;

  /** Closes the Keyboard Shortcuts menu */
  closeShortcutsMenu(): void;

  /** Returns the cursor X position, which is mouseEvent.pageX. */
  readonly cursorX: number;
  /** Returns the cursor Y position, which is mouseEvent.pageY. */
  readonly cursorY: number;
}
