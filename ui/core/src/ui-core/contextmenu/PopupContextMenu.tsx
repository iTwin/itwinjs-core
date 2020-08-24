/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ContextMenu
 */

import * as React from "react";
import { Popup } from "../popup/Popup";
import { ContextMenu } from "./ContextMenu";
import { RelativePosition } from "@bentley/ui-abstract";
import { CommonProps } from "../utils/Props";

/** Properties for [[PopupContextMenu]] component
 * @alpha
 */
export interface PopupContextMenuProps extends CommonProps {
  /** Indicates whether the popup is shown or not (defaults to false) */
  isOpen: boolean;
  /** Direction (relative to the target) to which the popup is expanded (defaults to Bottom) */
  position?: RelativePosition;
  /** Target element to position popup */
  target?: HTMLElement | null;
  /** Function called when the popup is opened */
  onOpen?: () => void;
  /** Function called when user clicks outside the popup  */
  onOutsideClick?: (e: MouseEvent) => void;
  /** Function called when the popup is closed */
  onClose?: () => void;
  /** Function called when the popup is closed on Enter */
  onEnter?: () => void;
  /** Top position (absolute positioning - defaults to 0) */
  top?: number;
  /** Left position (absolute positioning - defaults to 0) */
  left?: number;
  /** Offset from the parent (defaults to 4) */
  offset?: number;
  /** accessibility label */
  ariaLabel?: string;

  /** When list item or submenu is selected */
  onSelect?: (event: React.MouseEvent | undefined) => void;
  /** when Escape button is pressed */
  onEsc?: (event: React.KeyboardEvent) => void;
  /** Whether menu flips directions based on screen edge. Default: true */
  autoflip?: boolean;
  /** Whether menu hugs screen edge when autoflip is off. Default: true */
  edgeLimit?: boolean;
  /** Whether Hotkey press selects item, or just highlights item. Default: true */
  hotkeySelect?: boolean;
  /** starting menu item selected index Default: -1 */
  selectedIndex?: number;

  /** ContextMenu items */
  children?: React.ReactNode;
}

/** Component that displays a ContextMenu within a Popup component, allowing the target element to be specified.
 * @alpha
 */
export function PopupContextMenu(props: PopupContextMenuProps) {
  const { style, onSelect, onEsc, autoflip, edgeLimit, hotkeySelect, selectedIndex, children, ...popupProps } = props;
  return (
    <Popup {...popupProps}
      showShadow={false} showArrow={false} moveFocus={true}
      style={{ ...style, border: "none" }}>
      <ContextMenu
        opened={true} onSelect={onSelect} onEsc={onEsc}
        autoflip={autoflip} edgeLimit={edgeLimit}
        hotkeySelect={hotkeySelect} selectedIndex={selectedIndex}
      >
        {children}
      </ContextMenu>
    </Popup >
  );
}
