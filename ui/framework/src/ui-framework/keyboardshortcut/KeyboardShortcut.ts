/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module KeyboardShortcut
 */

import { ConditionalBooleanValue, FunctionKey, SpecialKey, UiError } from "@bentley/ui-abstract";
import { CursorInformation } from "../cursor/CursorInformation";
import { ActionButtonItemDef } from "../shared/ActionButtonItemDef";
import { ItemDefBase } from "../shared/ItemDefBase";
import { ItemProps } from "../shared/ItemProps";
import { UiFramework } from "../UiFramework";
import { KeyboardShortcutMenu } from "./KeyboardShortcutMenu";
import { SyncUiEventArgs, SyncUiEventDispatcher } from "../syncui/SyncUiEventDispatcher";

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

    if (this._key in FunctionKey)
      this._isFunctionKey = true;
    if (this._key in SpecialKey)
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
      if (this.isDisabled === undefined)
        this.isDisabled = this._item.isDisabled;
      if (this.isHidden === undefined)
        this.isHidden = this._item.isHidden;
    } else if (props.shortcuts) {
      props.shortcuts.forEach((childProps: KeyboardShortcutProps) => {
        const shortcut = new KeyboardShortcut(childProps);
        this._shortcuts.registerKey(shortcut.keyMapKey, shortcut);
      });
    } else {
      throw new UiError(UiFramework.loggerCategory(this), `Either 'item' or 'shortcuts' must be specified for '${props.key}' key.`);
    }

    if (props.isAltKeyRequired !== undefined)
      this._isAltKeyRequired = props.isAltKeyRequired;
    if (props.isCtrlKeyRequired !== undefined)
      this._isCtrlKeyRequired = props.isCtrlKeyRequired;
    if (props.isShiftKeyRequired !== undefined)
      this._isShiftKeyRequired = props.isShiftKeyRequired;
  }

  /** Returns the id for this shortcut */
  public get id(): string { return this.keyMapKey; }

  /** Returns the shortcut container */
  public get shortcutContainer(): KeyboardShortcutContainer {
    return this._shortcuts;
  }

  /** Finds a shortcut with a given key in the shortcut's container */
  public getShortcut(mapKey: string): KeyboardShortcut | undefined {
    return this._shortcuts.findKey(mapKey);
  }

  /** Returns the shortcut's key map key used as the id */
  public get keyMapKey(): string {
    const keyMapKey = KeyboardShortcutContainer.generateKeyMapKey(this.key, this._isAltKeyRequired, this._isCtrlKeyRequired, this._isShiftKeyRequired);
    return keyMapKey;
  }

  /** Returns the [[ActionButtonItemDef]] associated with this shortcut */
  public get item(): ActionButtonItemDef | undefined {
    return this._item;
  }

  /** Called when the [[ActionButtonItemDef]] associated with this shortcut is invoked */
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

  /** Registers a Keyboard Shortcut associated with a given key in the managed list */
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

  /** Finds a Keyboard Shortcut associated with a given key */
  public findKey(keyMapKey: string): KeyboardShortcut | undefined {
    return this._keyMap.get(keyMapKey);
  }

  /** Determines if any Keyboard Shortcuts are available in this container */
  public areKeyboardShortcutsAvailable(): boolean {
    return this._keyMap.size !== 0;
  }

  /** Empties any Keyboard Shortcuts from this container */
  public emptyData(): void {
    this._keyMap.clear();
    this._keyArray.length = 0;
  }

  public getAvailableKeyboardShortcuts(): KeyboardShortcut[] {
    return this._keyArray.slice();
  }

  /** Generates a key used for storing and finding the Keyboard Shortcuts in this container */
  public static generateKeyMapKey(keyboardKey: string, isAltKeyRequired: boolean, isCtrlKeyRequired: boolean, isShiftKeyRequired: boolean): string {
    let keyMapKey = keyboardKey;

    if (isAltKeyRequired)
      keyMapKey = `Alt+${keyMapKey}`;
    if (isShiftKeyRequired)
      keyMapKey = `Shift+${keyMapKey}`;
    if (isCtrlKeyRequired)
      keyMapKey = `Ctrl+${keyMapKey}`;

    return keyMapKey;
  }

  /** Displays a menu for the Keyboard Shortcuts in this container */
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

type OnShortcutFunc = (shortcut: KeyboardShortcut) => void;

/** Keyboard Shortcut Manager
 * @public
 */
export class KeyboardShortcutManager {

  private static _shortcuts: KeyboardShortcutContainer = new KeyboardShortcutContainer();

  /** Initialize the Keyboard Shortcut manager */
  public static initialize(): void {
    SyncUiEventDispatcher.onSyncUiEvent.addListener(KeyboardShortcutManager._handleSyncUiEvent);
  }

  /** Loads Keyboard Shortcuts into the managed list */
  public static loadKeyboardShortcuts(shortcutList: KeyboardShortcutProps[]) {
    shortcutList.forEach((shortcutProps: KeyboardShortcutProps) => {
      this.loadKeyboardShortcut(shortcutProps);
    });
  }

  /** Loads a Keyboard Shortcut into the managed list */
  public static loadKeyboardShortcut(shortcutProps: KeyboardShortcutProps) {
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
  public static displayShortcutsMenu(): void {
    if (this._shortcuts.areKeyboardShortcutsAvailable()) {
      this._shortcuts.showShortcutsMenu();
    }
  }

  /** Closes the Keyboard Shortcuts menu */
  public static closeShortcutsMenu(): void {
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

  private static _handleSyncUiEvent = (args: SyncUiEventArgs) => {
    const updateBooleanValue = (booleanValue: ConditionalBooleanValue) => {
      if (SyncUiEventDispatcher.hasEventOfInterest(args.eventIds, booleanValue.syncEventIds))
        booleanValue.refresh();
    };
    const handleForSyncIds = (shortcut: KeyboardShortcut) => {
      if (shortcut.isDisabled instanceof ConditionalBooleanValue)
        updateBooleanValue(shortcut.isDisabled);
      if (shortcut.isHidden instanceof ConditionalBooleanValue)
        updateBooleanValue(shortcut.isHidden);
    };

    KeyboardShortcutManager._traverseShortcuts(KeyboardShortcutManager._shortcuts.getAvailableKeyboardShortcuts(), handleForSyncIds);
  };

  private static _traverseShortcuts = (shortcuts: KeyboardShortcut[], callback: OnShortcutFunc) => {
    shortcuts.forEach((shortcut: KeyboardShortcut) => {
      callback(shortcut);

      if (shortcut.shortcutContainer.areKeyboardShortcutsAvailable()) {
        const childShortcuts = shortcut.shortcutContainer.getAvailableKeyboardShortcuts();
        KeyboardShortcutManager._traverseShortcuts(childShortcuts, callback);
      }
    });
  };

}
