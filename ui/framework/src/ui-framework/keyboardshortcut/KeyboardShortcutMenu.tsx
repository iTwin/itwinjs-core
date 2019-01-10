/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module KeyboardShortcut */

import * as React from "react";
import { GlobalContextMenu, ContextMenuItem, UiEvent, ContextSubMenu } from "@bentley/ui-core";
import { KeyboardShortcut } from "./KeyboardShortcut";

export interface KeyboardShortcutMenuState {
  menuVisible: boolean;
  menuX: number;
  menuY: number;
  shortcuts?: KeyboardShortcut[];
}

/** KeyboardShortcut Menu Event class.
 */
export class KeyboardShortcutMenuEvent extends UiEvent<KeyboardShortcutMenuState> { }

/** Widget State Changed Event class.
 */
export class KeyboardShortcutMenu extends React.Component<{}, KeyboardShortcutMenuState> {

  /** @hidden */
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
          {shortcuts && shortcuts.map((shortcut: KeyboardShortcut, index: number) => {
            return this.getShortcutMenuItem(shortcut, index);
          })}
        </GlobalContextMenu>
      );
    }

    return null;
  }

  private getShortcutMenuItem(shortcut: KeyboardShortcut, index: number): React.ReactNode {
    let node: React.ReactNode = null;
    const label = shortcut.label;
    const iconSpec = shortcut.iconSpec;
    // const shortcutKey = item.key;

    if (shortcut.shortcutContainer.areKeyboardShortcutsAvailable()) {
      const shortcuts = shortcut.shortcutContainer.getAvailableKeyboardShortcuts();
      node = (
        <ContextSubMenu key={index} icon={iconSpec} label={label}>
          {shortcuts && shortcuts.map((childShortcut: KeyboardShortcut, childIndex: number) => {
            return this.getShortcutMenuItem(childShortcut, childIndex);
          })}
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
