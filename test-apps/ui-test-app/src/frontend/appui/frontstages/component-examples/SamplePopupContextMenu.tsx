/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { ContextMenuItem, ContextSubMenu, PopupContextMenu, useRefState } from "@bentley/ui-core";
import { RelativePosition } from "@bentley/ui-abstract";

export function SamplePopupContextMenu() {
  const [targetRef, target] = useRefState<HTMLButtonElement>();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const toggleMenu = React.useCallback(() => {
    const show = !isMenuOpen;
    setIsMenuOpen(show);
  }, [isMenuOpen]);

  const onCloseMenu = React.useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  return (
    <div>
      <button onClick={toggleMenu} ref={targetRef}>
        Button with Menu
      </button>
      <PopupContextMenu isOpen={isMenuOpen} position={RelativePosition.BottomLeft} target={target} offset={1}
        onClose={onCloseMenu} onSelect={onCloseMenu} selectedIndex={0}>
        <ContextSubMenu label="Item ~1" icon="icon-placeholder">
          <ContextMenuItem icon="icon-placeholder" iconRight="icon-checkmark">SubMenu Item ~1</ContextMenuItem>
          <ContextMenuItem icon="icon-placeholder">SubMenu Item ~2</ContextMenuItem>
        </ContextSubMenu>
        <ContextMenuItem icon="icon-placeholder" iconRight="icon-checkmark">Item ~2</ContextMenuItem>
        <ContextMenuItem>Item ~3</ContextMenuItem>
        <ContextSubMenu label="Item ~4">
          <ContextMenuItem icon="icon-placeholder">SubMenu Item ~1</ContextMenuItem>
          <ContextMenuItem icon="icon-placeholder">SubMenu Item ~2</ContextMenuItem>
        </ContextSubMenu>
      </PopupContextMenu>
    </div>
  );
}
