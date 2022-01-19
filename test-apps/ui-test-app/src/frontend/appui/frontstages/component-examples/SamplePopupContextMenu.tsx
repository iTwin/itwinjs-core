/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { ContextMenu, ContextMenuDirection, ContextMenuItem, ContextSubMenu, GlobalContextMenu, Popup, PopupContextMenu, useRefState } from "@itwin/core-react";
import { RelativePosition } from "@itwin/appui-abstract";

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
      <button onClick={toggleMenu} ref={targetRef}>
        {label ?? "..."}
      </button>
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
      <button onClick={(e) => {
        e.preventDefault();
        toggleMenu();
      }}>
        {label ?? "..."}
      </button>
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

export function ContextMenuInPopup() {
  const [showPopup, setShowPopup] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const togglePopup = React.useCallback(() => {
    const show = !showPopup;
    setShowPopup(show);
  }, [showPopup]);

  return (
    <div>
      <button onClick={(e) => {
        e.preventDefault();
        togglePopup();
      }} ref={buttonRef}>{showPopup ? "Close" : "Open"}</button>

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

export function PopupContextMenuInPopup() {
  const [showPopup, setShowPopup] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const togglePopup = React.useCallback(() => {
    const show = !showPopup;
    setShowPopup(show);
  }, [showPopup]);

  return (
    <div>
      <button onClick={(e) => {
        e.preventDefault();
        togglePopup();
      }} ref={buttonRef}>{showPopup ? "Close" : "Open"}</button>

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
      <button onClick={(e) => {
        xRef.current = e.clientX;
        yRef.current = e.clientY;
        e.preventDefault();
        togglePopup();
      }} ref={buttonRef}>{"..."}</button>

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
              hideIconContainer
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
