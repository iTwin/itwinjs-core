/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module KeyboardShortcut */

import * as React from "react";
import { GlobalContextMenu, ContextMenuItem, UiEvent, ContextSubMenu } from "@bentley/ui-core";
import { KeyboardShortcut } from "./KeyboardShortcut";

/** State for a [[KeyboardShortcutMenuEvent]] and [[KeyboardShortcutMenu]] component
 * @public
 */
export interface KeyboardShortcutMenuState {
  menuVisible: boolean;
  menuX: number;
  menuY: number;
  shortcuts?: KeyboardShortcut[];
}

/** KeyboardShortcut Menu Event class.
 * @public
 */
export class KeyboardShortcutMenuEvent extends UiEvent<KeyboardShortcutMenuState> { }

/** Widget State Changed Event class.
 * @public
 */
export class KeyboardShortcutMenu extends React.Component<{}, KeyboardShortcutMenuState> {

  /** @internal */
  public readonly state: KeyboardShortcutMenuState = {
    menuVisible: false,
    menuX: 0,
    menuY: 0,
  };

  /** Get KeyboardShortcut Menu Event. */
  public static readonly onKeyboardShortcutMenuEvent = new KeyboardShortcutMenuEvent();

  public componentDidMount() {
    KeyboardShortcutMenu.onKeyboardShortcutMenuEvent.addListener(this._handleKeyboardShortcutMenuEvent);
  }

  public componentWillUnmount() {
    KeyboardShortcutMenu.onKeyboardShortcutMenuEvent.removeListener(this._handleKeyboardShortcutMenuEvent);
  }

  private _handleKeyboardShortcutMenuEvent = (state: KeyboardShortcutMenuState) => {
    this.setState(state);
  }

  public render(): React.ReactNode {
    const { shortcuts, menuX, menuY, menuVisible } = this.state;
    const onClose = this._hideContextMenu;

    if (menuVisible) {
      const items = this.getShortcutMenuItems(shortcuts);

      return (
        <GlobalContextMenu
          identifier="keyboard-shortcut-menu"
          x={menuX}
          y={menuY}
          opened={menuVisible}
          onEsc={onClose}
          onOutsideClick={onClose}
          edgeLimit={false}
          autoflip={true}
        >
          {items}
        </GlobalContextMenu>
      );
    }

    return null;
  }

  private getShortcutMenuItems(shortcuts?: KeyboardShortcut[]): React.ReactNode[] {
    const items: React.ReactNode[] = [];

    if (shortcuts) {
      shortcuts.forEach((shortcut: KeyboardShortcut, index: number) => {
        const item = this.getShortcutMenuItem(shortcut, index);
        if (item)
          items.push(item);
      });
    }

    return items;
  }

  private getShortcutMenuItem(shortcut: KeyboardShortcut, index: number): React.ReactNode {
    const shortcutKey = shortcut.key;

    // Only pure characters go into the context menu
    if (shortcutKey !== shortcut.keyMapKey || shortcut.isFunctionKey || shortcut.isSpecialKey)
      return null;

    let node: React.ReactNode = null;
    let label = shortcut.label;
    const iconSpec = shortcut.iconSpec;

    label = "~" + shortcutKey + " " + label;

    if (shortcut.shortcutContainer.areKeyboardShortcutsAvailable()) {
      const shortcuts = shortcut.shortcutContainer.getAvailableKeyboardShortcuts();
      const items = this.getShortcutMenuItems(shortcuts);

      node = (
        <ContextSubMenu key={index} icon={iconSpec} label={label}>
          {items}
        </ContextSubMenu>
      );
    } else {
      const sel = () => this._itemPicked(shortcut);
      node = (
        <ContextMenuItem key={index}
          onSelect={sel}
          icon={iconSpec} >
          {label}
        </ContextMenuItem>
      );
    }

    return node;
  }

  private _hideContextMenu = () => {
    this.setState({ menuVisible: false, shortcuts: undefined });
  }

  private _itemPicked = (shortcut: KeyboardShortcut): void => {
    this._hideContextMenu();
    shortcut.itemPicked();
  }
}
