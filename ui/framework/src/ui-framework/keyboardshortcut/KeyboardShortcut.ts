/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module KeyboardShortcut */

import { ItemProps } from "../shared/ItemProps";
import { ActionButtonItemDef } from "../shared/ActionButtonItemDef";
import { ItemDefBase } from "../shared/ItemDefBase";
import { KeyboardShortcutMenu } from "./KeyboardShortcutMenu";

/** Enumeration for Function Keys
 * @public
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
 * @public
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
  Space = " ",
  Backspace = "Backspace",
}

/** Properties for a Keyboard Shortcut
 * @public
 */
export interface KeyboardShortcutProps extends ItemProps {
  /** The key that invokes the shortcut.
   * This is either an alphanumeric key, a function key or a special key.
   */
  key: string | FunctionKey | SpecialKey;

  /** The item to execute when this shortcut is invoked. Either 'items' or 'shortcuts' must be specified. */
  item?: ActionButtonItemDef;
  /** Nested array of shortcut props. Either 'items' or 'shortcuts' must be specified. */
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
export class KeyboardShortcut extends ItemDefBase {

  private _key: string;
  private _item?: ActionButtonItemDef;
  private _shortcuts: KeyboardShortcutContainer;

  private _isAltKeyRequired: boolean = false;
  private _isCtrlKeyRequired: boolean = false;
  private _isShiftKeyRequired: boolean = false;
  private _isFunctionKey: boolean = false;
  private _isSpecialKey: boolean = false;

  constructor(props: KeyboardShortcutProps) {
    super(props);

    this._key = props.key;

    if (Object.values(FunctionKey).includes(this._key))
      this._isFunctionKey = true;
    if (Object.values(SpecialKey).includes(this._key))
      this._isSpecialKey = true;

    this._shortcuts = new KeyboardShortcutContainer();

    if (props.item) {
      this._item = props.item;

      // Copy over icon, label & tooltip from the item
      if (!this.iconSpec)
        this.iconSpec = this._item.iconSpec;
      if (!this.label)
        this.setLabel(this._item.label);
      if (!this.tooltip)
        this.setTooltip(this._item.tooltip);
    } else if (props.shortcuts) {
      props.shortcuts.forEach((childProps: KeyboardShortcutProps) => {
        const shortcut = new KeyboardShortcut(childProps);
        this._shortcuts.registerKey(shortcut.keyMapKey, shortcut);
      });
    } else {
      throw Error("KeyboardShortcut: Either 'item' or 'shortcuts' must be specified for '" + props.key + "' key.");
    }

    if (props.isAltKeyRequired !== undefined)
      this._isAltKeyRequired = props.isAltKeyRequired;
    if (props.isCtrlKeyRequired !== undefined)
      this._isCtrlKeyRequired = props.isCtrlKeyRequired;
    if (props.isShiftKeyRequired !== undefined)
      this._isShiftKeyRequired = props.isShiftKeyRequired;
  }

  public get id(): string { return this.keyMapKey; }

  public get shortcutContainer(): KeyboardShortcutContainer {
    return this._shortcuts;
  }

  public getShortcut(mapKey: string): KeyboardShortcut | undefined {
    return this._shortcuts.findKey(mapKey);
  }

  public get keyMapKey(): string {
    const keyMapKey = KeyboardShortcutContainer.generateKeyMapKey(this.key, this._isAltKeyRequired, this._isCtrlKeyRequired, this._isShiftKeyRequired);
    return keyMapKey;
  }

  public get item(): ActionButtonItemDef | undefined {
    return this._item;
  }

  public itemPicked(): void {
    if (this._shortcuts.areKeyboardShortcutsAvailable()) {
      this._shortcuts.showShortcutsMenu();
    } else {
      setTimeout(() => {
        // istanbul ignore else
        if (this._item)
          this._item.execute();
      });
    }
  }

  /** Gets the keyboard key */
  public get key(): string { return this._key; }
  /** Gets whether the Alt key required. */
  public get isAltKeyRequired(): boolean { return this._isAltKeyRequired; }
  /** Gets whether the Ctrl key required. */
  public get isCtrlKeyRequired(): boolean { return this._isCtrlKeyRequired; }
  /** Gets whether the Shift key required. */
  public get isShiftKeyRequired(): boolean { return this._isShiftKeyRequired; }
  /** Gets whether this is a Function key. */
  public get isFunctionKey(): boolean { return this._isFunctionKey; }
  /** Gets whether this is a Special key. */
  public get isSpecialKey(): boolean { return this._isSpecialKey; }

}

/** Keyboard Shortcut Container
 * @public
 */
export class KeyboardShortcutContainer {
  private _keyMap: Map<string, KeyboardShortcut> = new Map<string, KeyboardShortcut>();
  private _keyArray: KeyboardShortcut[] = new Array<KeyboardShortcut>();

  public registerKey(keyMapKey: string, inShortcut: KeyboardShortcut): KeyboardShortcut | undefined {
    let shortcut: KeyboardShortcut | undefined;

    if ((shortcut = this.findKey(keyMapKey)) === undefined) {
      shortcut = inShortcut;
      this._keyArray.push(shortcut);
    } else {
      const index = this._keyArray.findIndex((value: KeyboardShortcut) => {
        return value.keyMapKey === keyMapKey;
      });
      // istanbul ignore else
      if (index >= 0) {
        shortcut = inShortcut;
        this._keyArray[index] = shortcut;
      }
    }

    // istanbul ignore else
    if (shortcut)
      this._keyMap.set(keyMapKey, shortcut);

    return shortcut;
  }

  public findKey(keyMapKey: string): KeyboardShortcut | undefined {
    return this._keyMap.get(keyMapKey);
  }

  public areKeyboardShortcutsAvailable(): boolean {
    return this._keyMap.size !== 0;
  }

  public emptyData(): void {
    this._keyMap.clear();
    this._keyArray.length = 0;
  }

  public getAvailableKeyboardShortcuts(): KeyboardShortcut[] {
    return this._keyArray.slice();
  }

  public static generateKeyMapKey(keyboardKey: string, isAltKeyRequired: boolean, isCtrlKeyRequired: boolean, isShiftKeyRequired: boolean): string {
    let keyMapKey = keyboardKey;

    if (isAltKeyRequired)
      keyMapKey = "Alt+" + keyMapKey;
    if (isShiftKeyRequired)
      keyMapKey = "Shift+" + keyMapKey;
    if (isCtrlKeyRequired)
      keyMapKey = "Ctrl+" + keyMapKey;

    return keyMapKey;
  }

  public showShortcutsMenu() {
    const offset = 8;
    KeyboardShortcutMenu.onKeyboardShortcutMenuEvent.emit({
      menuVisible: true,
      menuX: KeyboardShortcutManager.cursorX - offset,
      menuY: KeyboardShortcutManager.cursorY - offset,
      shortcuts: this.getAvailableKeyboardShortcuts(),
    });
  }
}

/** Keyboard Shortcut Manager
 * @public
 */
export class KeyboardShortcutManager {

  private static _shortcuts: KeyboardShortcutContainer = new KeyboardShortcutContainer();
  private static _cursorX = 0;
  private static _cursorY = 0;

  public static loadKeyboardShortcuts(shortcutList: KeyboardShortcutProps[]) {
    shortcutList.forEach((shortcutProps: KeyboardShortcutProps) => {
      this.loadKeyboardShortcut(shortcutProps);
    });
  }

  public static loadKeyboardShortcut(shortcutProps: KeyboardShortcutProps) {
    const shortcut = new KeyboardShortcut(shortcutProps);
    this._shortcuts.registerKey(shortcut.keyMapKey, shortcut);
  }

  public static processKey(keyboardKey: string, isAltKeyPressed: boolean = false, isCtrlKeyPressed: boolean = false, isShiftKeyPressed: boolean = false): boolean {
    const keyMapKey = KeyboardShortcutContainer.generateKeyMapKey(keyboardKey, isAltKeyPressed, isCtrlKeyPressed, isShiftKeyPressed);

    const shortcut = this.getShortcut(keyMapKey);
    if (shortcut) {
      shortcut.itemPicked();
      return true;
    }

    return false;
  }

  public static get shortcutContainer(): KeyboardShortcutContainer {
    return this._shortcuts;
  }

  public static getShortcut(keyMapKey: string): KeyboardShortcut | undefined {
    return this._shortcuts.findKey(keyMapKey);
  }

  public static get isFocusOnHome(): boolean {
    const element = document.activeElement as HTMLElement;
    return element && element === document.body;
  }

  public static setFocusToHome(): void {
    const element = document.activeElement as HTMLElement;
    if (element && element !== document.body) {
      element.blur();
      document.body.focus();
    }
  }

  public static displayShortcutsMenu(): void {
    if (this._shortcuts.areKeyboardShortcutsAvailable()) {
      this._shortcuts.showShortcutsMenu();
    }
  }

  public static closeShortcutsMenu(): void {
    KeyboardShortcutMenu.onKeyboardShortcutMenuEvent.emit({
      menuVisible: true,
      menuX: 0,
      menuY: 0,
      shortcuts: undefined,
    });
  }

  public static get cursorX(): number { return this._cursorX; }
  public static set cursorX(x: number) { this._cursorX = x; }

  public static get cursorY(): number { return this._cursorY; }
  public static set cursorY(y: number) { this._cursorY = y; }

}
