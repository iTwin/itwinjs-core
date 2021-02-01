# ContextMenu

The [ContextMenu]($ui-core) React component displays a context menu populated with [ContextMenuItem]($ui-core) components.
Items can be nested using the [ContextSubMenu]($ui-core) component.
The [ContextMenuDivider]($ui-core) component shows a divider line between items.

The [GlobalContextMenu]($ui-core) React component is used to display a ContextMenu at the cursor.

The [PopupContextMenu]($ui-core) React component displays a ContextMenu within a Popup component, allowing the target element to be specified.

## UiAdmin.showContextMenu Example

These lower level components can be used to display a context menu.
However, there is an easier API to use: IModelApp.uiAdmin.showContextMenu.
UiAdmin.showContextMenu will show a context menu at a particular location.
[UiAdmin]($ui-abstract) controls various UI components and is callable from IModelApp.uiAdmin in the imodeljs-frontend package.
UiAdmin.showContextMenu uses the [ContextMenu]($ui-core:ContextMenu) components to display the context menu.

### Menu Items

The application builds an array of `AbstractMenuItemProps` objects.
These objects contain a menu item using the `item` member
or a submenu item using the `submenu` member.

```tsx
import { AbstractMenuItemProps } from "@bentley/ui-abstract";

private _myMenuItems: AbstractMenuItemProps[] = [
  {
    id: "Item1", label: "Item ~1", icon: "icon-placeholder",
    submenu: [
      { id: "0", item: { label: "SubMenu Item ~1", icon: "icon-placeholder", execute: () => { } } },
      { id: "1", item: { label: "SubMenu Item ~2", icon: "icon-placeholder", execute: () => { } } },
    ],
  },
  {
    id: "Item2", item: { label: "Item ~2", icon: "icon-placeholder", execute: () => { } },
  },
  {
    id: "Item3", item: { label: "Item ~3", icon: "icon-placeholder", execute: () => { } },
  },
];
```

### Show Context Menu

The `IModelApp.uiAdmin.showContextMenu` method will be called in response to an
event, such as a right-click.

```tsx
import { IModelApp } from "@bentley/imodeljs-frontend";

public showContextMenu() {
  IModelApp.uiAdmin.showContextMenu(this._myMenuItems, IModelApp.uiAdmin.cursorPosition);
}
```

## PopupContextMenu Example

The PopupContextMenu component can be used to display a ContextMenu within a Popup component  relative to a target element.
In the example below, the PopupContextMenu is displayed below the `button` element.

```tsx
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
};
```

## API Reference

- [ContextMenu]($ui-core:ContextMenu)
