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
import { RelativePosition } from "@itwin/appui-abstract";
import { CommonProps } from "../utils/Props";
import { ContextMenuDirection } from "./ContextMenuDirection";

/** Properties for [[PopupContextMenu]] component
 * @public
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
  /** Indicates whether to use animation for open/close (defaults to true) */
  animate?: boolean;

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
 * @public
 */
export function PopupContextMenu(props: PopupContextMenuProps) {
  const { style, onSelect, onEsc, autoflip, edgeLimit, hotkeySelect, selectedIndex, children, ...popupProps } = props;
  const menuDirection = getContextMenuDirectionFromRelativePosition(popupProps.position);
  return (
    <Popup {...popupProps} closeOnNestedPopupOutsideClick
      showShadow={false} showArrow={false} moveFocus={true}
      style={{ ...style, border: "none" }}>
      <ContextMenu
        opened={true} onSelect={onSelect} onEsc={onEsc}
        autoflip={autoflip} edgeLimit={edgeLimit}
        hotkeySelect={hotkeySelect} selectedIndex={selectedIndex}
        direction={menuDirection}
      >
        {children}
      </ContextMenu>
    </Popup >
  );
}

function getContextMenuDirectionFromRelativePosition(relativePosition?: RelativePosition): ContextMenuDirection {
  let menuDirection = ContextMenuDirection.Bottom;
  switch (relativePosition) {
    case RelativePosition.Top:
      menuDirection = ContextMenuDirection.Top;
      break;
    case RelativePosition.TopLeft:
      menuDirection = ContextMenuDirection.TopRight;
      break;
    case RelativePosition.TopRight:
      menuDirection = ContextMenuDirection.TopLeft;
      break;
    case RelativePosition.Left:
      menuDirection = ContextMenuDirection.Left;
      break;
    case RelativePosition.Right:
      menuDirection = ContextMenuDirection.Right;
      break;
    case RelativePosition.Bottom:
      menuDirection = ContextMenuDirection.Bottom;
      break;
    case RelativePosition.BottomLeft:
      menuDirection = ContextMenuDirection.BottomRight;
      break;
    case RelativePosition.BottomRight:
      menuDirection = ContextMenuDirection.BottomLeft;
      break;
  }
  return menuDirection;
}
