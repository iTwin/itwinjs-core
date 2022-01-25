/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp } from "@itwin/core-frontend";
import { AbstractMenuItemProps } from "@itwin/appui-abstract";

export class SampleContextMenu {
  private static _myMenuItems: AbstractMenuItemProps[] = [
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

  public static showContextMenu() {
    IModelApp.uiAdmin.showContextMenu(this._myMenuItems, IModelApp.uiAdmin.cursorPosition);
  }

}
