# ContextMenu

The [ContextMenu]($ui-core) React component displays a context menu populated with [ContextMenuItem]($ui-core) components.
Items can be nested using the [ContextSubMenu]($ui-core) component.
The [ContextMenuDivider]($ui-core) component shows a divider line between items.

The [GlobalContextMenu]($ui-core) React component is used to display a ContextMenu at the cursor.

## Example

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

## API Reference

* [ContextMenu]($ui-core:ContextMenu)
