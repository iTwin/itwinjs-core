/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module KeyboardShortcut
 */

import { ConditionalBooleanValue, UiSyncEventArgs } from "@itwin/appui-abstract";
import { CursorInformation } from "../cursor/CursorInformation";
import { KeyboardShortcutProps } from "../framework/FrameworkKeyboardShortcuts";
import { UiFramework } from "../UiFramework";
import { KeyboardShortcutMenu } from "./KeyboardShortcutMenu";
import { KeyboardShortcut, KeyboardShortcutContainer } from "./KeyboardShortcut";

type OnShortcutFunc = (shortcut: KeyboardShortcut) => void;

/** Keyboard Shortcut Manager
 * @internal
 */
export class InternalKeyboardShortcutManager {

  private static _shortcuts: KeyboardShortcutContainer = new KeyboardShortcutContainer();

  /** Initialize the Keyboard Shortcut manager
   * @internal
  */
  public static initialize(): void {
    UiFramework.events.onSyncUiEvent.addListener(InternalKeyboardShortcutManager._handleSyncUiEvent);
  }

  /** Loads Keyboard Shortcuts into the managed list */
  public static loadShortcuts(shortcutList: KeyboardShortcutProps[]) {
    shortcutList.forEach((shortcutProps: KeyboardShortcutProps) => {
      this.loadShortcut(shortcutProps);
    });
  }

  /** Loads a Keyboard Shortcut into the managed list */
  public static loadShortcut(shortcutProps: KeyboardShortcutProps) {
    const shortcut = new KeyboardShortcut(shortcutProps);
    this._shortcuts.registerKey(shortcut.keyMapKey, shortcut);
  }

  /** Processes a keystroke and invokes a matching Keyboard Shortcut */
  public static processKey(keyboardKey: string, isAltKeyPressed: boolean = false, isCtrlKeyPressed: boolean = false, isShiftKeyPressed: boolean = false): boolean {
    const keyMapKey = KeyboardShortcutContainer.generateKeyMapKey(keyboardKey, isAltKeyPressed, isCtrlKeyPressed, isShiftKeyPressed);

    const shortcut = this.getShortcut(keyMapKey);
    if (shortcut) {
      shortcut.itemPicked();
      return true;
    }

    return false;
  }

  /** Returns the managed list of Keyboard Shortcuts */
  public static get shortcutContainer(): KeyboardShortcutContainer {
    return this._shortcuts;
  }

  /** Returns a Keyboard Shortcut from the managed lists */
  public static getShortcut(keyMapKey: string): KeyboardShortcut | undefined {
    return this._shortcuts.findKey(keyMapKey);
  }

  /** Determines if focus is set to Home */
  public static get isFocusOnHome(): boolean {
    const element = document.activeElement as HTMLElement;
    return element && element === document.body;
  }

  /** Sets focus to Home */
  public static setFocusToHome(): void {
    const element = document.activeElement as HTMLElement;
    if (element && element !== document.body) {
      element.blur();
      document.body.focus();
    }
  }

  /** Displays the Keyboard Shortcuts menu at the cursor */
  public static displayMenu(): void {
    if (this._shortcuts.areKeyboardShortcutsAvailable()) {
      this._shortcuts.showShortcutsMenu();
    }
  }

  /** Closes the Keyboard Shortcuts menu */
  public static closeMenu(): void {
    KeyboardShortcutMenu.onKeyboardShortcutMenuEvent.emit({
      menuVisible: false,
      menuX: 0,
      menuY: 0,
      shortcuts: undefined,
    });
  }

  /** Returns the cursor X position, which is mouseEvent.pageX. */
  public static get cursorX(): number { return CursorInformation.cursorX; }
  /** Returns the cursor Y position, which is mouseEvent.pageY. */
  public static get cursorY(): number { return CursorInformation.cursorY; }

  private static _handleSyncUiEvent = (args: UiSyncEventArgs) => {
    const updateBooleanValue = (booleanValue: ConditionalBooleanValue) => {
      if (UiFramework.events.hasEventOfInterest(args.eventIds, booleanValue.syncEventIds))
        booleanValue.refresh();
    };
    const handleForSyncIds = (shortcut: KeyboardShortcut) => {
      if (shortcut.isDisabled instanceof ConditionalBooleanValue)
        updateBooleanValue(shortcut.isDisabled);
      if (shortcut.isHidden instanceof ConditionalBooleanValue)
        updateBooleanValue(shortcut.isHidden);
    };

    InternalKeyboardShortcutManager._traverseShortcuts(InternalKeyboardShortcutManager._shortcuts.getAvailableKeyboardShortcuts(), handleForSyncIds);
  };

  private static _traverseShortcuts = (shortcuts: KeyboardShortcut[], callback: OnShortcutFunc) => {
    shortcuts.forEach((shortcut: KeyboardShortcut) => {
      callback(shortcut);

      if (shortcut.shortcutContainer.areKeyboardShortcutsAvailable()) {
        const childShortcuts = shortcut.shortcutContainer.getAvailableKeyboardShortcuts();
        InternalKeyboardShortcutManager._traverseShortcuts(childShortcuts, callback);
      }
    });
  };

}
