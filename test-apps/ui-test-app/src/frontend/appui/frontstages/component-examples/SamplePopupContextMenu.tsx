/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { ContextMenu, ContextMenuDirection, ContextMenuItem, ContextMenuItemProps, ContextSubMenu, GlobalContextMenu, Icon, Popup, PopupContextMenu, useRefState } from "@itwin/core-react";
import { RelativePosition } from "@itwin/appui-abstract";
import { Popover } from "@itwin/itwinui-react/cjs/core/utils";
import { Button, DropdownMenu, IconButton, Menu, MenuItem } from "@itwin/itwinui-react";
import { SvgMore } from "@itwin/itwinui-icons-react";

export function SamplePopupContextMenu({ label, position }: { label?: string, position?: RelativePosition }) {
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
      {label
        ?
        <Button size="small"
          ref={targetRef}
          onClick={(e) => {
            e.preventDefault();
            toggleMenu();
          }}>
          {label}
        </Button>
        :
        <IconButton size="small"
          ref={targetRef}
          onClick={(e) => {
            e.preventDefault();
            toggleMenu();
          }} ><SvgMore /></IconButton>
      }
      <PopupContextMenu isOpen={isMenuOpen} position={position ?? RelativePosition.BottomLeft} target={target} offset={1}
        onClose={onCloseMenu} onSelect={onCloseMenu} selectedIndex={0} autoflip={false}>
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

export function ButtonWithContextMenu({ label, direction }: { label?: string, direction?: ContextMenuDirection }) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const toggleMenu = React.useCallback(() => {
    const show = !isMenuOpen;
    setIsMenuOpen(show);
  }, [isMenuOpen]);

  return (
    <div>
      {label
        ?
        <Button size="small" onClick={(e) => {
          e.preventDefault();
          toggleMenu();
        }}>
          {label}
        </Button>
        :
        <IconButton size="small" onClick={(e) => {
          e.preventDefault();
          toggleMenu();
        }} ><SvgMore /></IconButton>
      }

      <ContextMenu
        direction={direction}
        style={{ width: "100%" }}
        opened={isMenuOpen}
        edgeLimit={false}
        selectedIndex={0} floating={true} autoflip={false}
        onEsc={() => setIsMenuOpen(false)}
        onOutsideClick={(e) => {
          e.preventDefault();
          setIsMenuOpen(false);
        }}
      >
        {["Item 1", "Item 2", "Item 3", "Item 4", "Item 5"].map((listItem, index) => {
          return (
            <ContextMenuItem
              key={index}
              hideIconContainer
              onSelect={(event) => {
                event.stopPropagation();
                setIsMenuOpen(false);
              }}>
              {listItem}
            </ContextMenuItem>
          );
        })}
      </ContextMenu>
    </div >
  );
}

export function ButtonWithDropdownMenu({ label, placement }: { label?: string, placement?: "top-start" | "top-end" | "bottom-start" | "bottom-end" }) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const toggleMenu = React.useCallback(() => {
    const show = !isMenuOpen;
    setIsMenuOpen(show);
  }, [isMenuOpen]);

  const createMenuItemNodes = React.useCallback((close: () => void): React.ReactElement[] => {
    const itemNodes = ["Item 1", "Item 2", "Item 3", "Item 4", "Item 5"].map((listItem, index) => {
      return (
        <MenuItem
          key={index}
          onClick={() => {
            close();
          }}>
          {listItem}
        </MenuItem>
      );
    });
    return itemNodes;
  }, []);

  return (
    <div>
      <DropdownMenu appendTo="parent" placement={placement ?? "bottom-start"} menuItems={createMenuItemNodes}>
        {label
          ?
          <Button size="small" onClick={(e) => {
            e.preventDefault();
            toggleMenu();
          }}>
            {label}
          </Button>
          :
          <IconButton size="small" onClick={(e) => {
            e.preventDefault();
            toggleMenu();
          }} ><SvgMore /></IconButton>
        }
      </DropdownMenu>
    </div >
  );
}

export function ContextMenuInPopup() {
  const [showPopup, setShowPopup] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const togglePopup = React.useCallback(() => {
    const show = !showPopup;
    setShowPopup(show);
  }, [showPopup]);

  return (
    <div>
      <Button size="small"
        ref={buttonRef}
        onClick={(e) => {
          e.preventDefault();
          togglePopup();
        }}>
        {showPopup ? "Close" : "Open"}
      </Button>
      <Popup isOpen={showPopup} position={RelativePosition.Bottom} target={buttonRef.current}
        onClose={() => setShowPopup(false)} showArrow={true} showShadow={true} closeOnNestedPopupOutsideClick={false}>
        <div style={{ width: "150px", height: "200px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
          <div style={{ display: "flex" }}>
            <ButtonWithContextMenu label="TR" direction={ContextMenuDirection.TopRight} />
            <ButtonWithContextMenu label="TL" direction={ContextMenuDirection.TopLeft} />
          </div>
          <div style={{ display: "flex" }}>
            <ButtonWithContextMenu label="BR" direction={ContextMenuDirection.BottomRight} />
            <ButtonWithContextMenu label="BL" direction={ContextMenuDirection.BottomLeft} />
          </div>
        </div>

      </Popup >

    </div >
  );
}

export function DropdownMenuInPopup() {
  const [showPopup, setShowPopup] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const togglePopup = React.useCallback(() => {
    const show = !showPopup;
    setShowPopup(show);
  }, [showPopup]);

  return (
    <div>
      <Button size="small"
        ref={buttonRef}
        onClick={(e) => {
          e.preventDefault();
          togglePopup();
        }}>
        {showPopup ? "Close" : "Open"}
      </Button>
      <Popup isOpen={showPopup} position={RelativePosition.Bottom} target={buttonRef.current}
        onClose={() => setShowPopup(false)} showArrow={true} showShadow={true} closeOnNestedPopupOutsideClick={false}>
        <div style={{ width: "150px", height: "200px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
          <div style={{ display: "flex" }}>
            <ButtonWithDropdownMenu label="TR" placement="top-end" />
            <ButtonWithDropdownMenu label="TL" placement="top-start" />
          </div>
          <div style={{ display: "flex" }}>
            <ButtonWithDropdownMenu label="BR" placement="bottom-end" />
            <ButtonWithDropdownMenu label="BL" placement="bottom-start" />
          </div>
        </div>

      </Popup >

    </div >
  );
}

export function PopupContextMenuInPopup() {
  const [showPopup, setShowPopup] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const togglePopup = React.useCallback(() => {
    const show = !showPopup;
    setShowPopup(show);
  }, [showPopup]);

  return (
    <div>
      <Button size="small"
        ref={buttonRef}
        onClick={(e) => {
          e.preventDefault();
          togglePopup();
        }}>
        {showPopup ? "Close" : "Open"}
      </Button>

      <Popup isOpen={showPopup} position={RelativePosition.Bottom} target={buttonRef.current}
        onClose={() => setShowPopup(false)} showArrow={true} showShadow={true} closeOnNestedPopupOutsideClick={false}>
        <div style={{ width: "150px", height: "200px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
          <div style={{ display: "flex" }}>

            <SamplePopupContextMenu label="TR" position={RelativePosition.TopRight} />
            <SamplePopupContextMenu label="TL" position={RelativePosition.TopLeft} />
          </div>
          <div style={{ display: "flex" }}>
            <SamplePopupContextMenu label="BR" position={RelativePosition.BottomRight} />
            <SamplePopupContextMenu label="BL" position={RelativePosition.BottomLeft} />
          </div>
        </div>

      </Popup >

    </div >
  );
}

export type ContextMenuItemInfo = ContextMenuItemProps & React.Attributes & { label: string };

export function GlobalItwinContextMenuInPopup() {
  const [showPopup, setShowPopup] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const xRef = React.useRef<number>(0);
  const yRef = React.useRef<number>(0);
  const onSelect = React.useCallback(() => setShowPopup(false), []);

  const togglePopup = React.useCallback(() => {
    const show = !showPopup;
    setShowPopup(show);
  }, [showPopup]);

  return (
    <div>
      <IconButton size="small" onClick={(e) => {
        xRef.current = e.clientX + 10;
        yRef.current = e.clientY + 10;
        e.preventDefault();
        togglePopup();
      }} ref={buttonRef}><SvgMore /></IconButton>

      <Popover
        appendTo={document.body}
        zIndex={99999}
        content={
          <Menu>
            {["Item 1", "Item 2", "Item 3", "Item 4", "Item 5"].map((label, index) =>
              <MenuItem
                key={index}
                onClick={onSelect}
                title={label}
                icon={<Icon className="core-menuitem-icon" iconSpec="icon-placeholder" />}
              >
                {label}
              </MenuItem>
            )}
          </Menu>
        }
        visible={showPopup}
        onClickOutside={() => setShowPopup(false)}
        getReferenceClientRect={() => ({
          width: 0,
          height: 0,
          top: yRef.current,
          bottom: yRef.current,
          left: xRef.current,
          right: xRef.current,
          x: xRef.current,
          y: yRef.current,
          toJSON: () => { },
        })}
        placement="bottom-start"
        onHide={() => setShowPopup(false)}
      />
    </div >
  );
}

export function GlobalContextMenuInPopup() {
  const [showPopup, setShowPopup] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const xRef = React.useRef<number>(0);
  const yRef = React.useRef<number>(0);

  const togglePopup = React.useCallback(() => {
    const show = !showPopup;
    setShowPopup(show);
  }, [showPopup]);

  return (
    <div>
      <IconButton size="small"
        ref={buttonRef}
        onClick={(e) => {
          xRef.current = e.clientX;
          yRef.current = e.clientY;
          e.preventDefault();
          togglePopup();
        }} ><SvgMore /></IconButton>

      <GlobalContextMenu
        opened={showPopup}
        onOutsideClick={() => setShowPopup(false)}
        onEsc={() => setShowPopup(false)}
        identifier="ui-test-app:ComponentExampleMenu"
        x={xRef.current + 10}
        y={yRef.current + 10}
      >
        {["Item 1", "Item 2", "Item 3", "Item 4", "Item 5"].map((listItem, index) => {
          return (
            <ContextMenuItem
              key={index}
              icon="icon-placeholder"
              onSelect={(event) => {
                event.stopPropagation();
                setShowPopup(false);
              }}>
              {listItem}
            </ContextMenuItem>
          );
        })}
      </GlobalContextMenu>

    </div >
  );
}
