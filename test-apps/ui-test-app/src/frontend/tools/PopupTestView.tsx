/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { IModelApp } from "@itwin/core-frontend";
import { AbstractMenuItemProps } from "@itwin/appui-abstract";
import { useActiveIModelConnection } from "@itwin/appui-react";
import ViewportContentComponent from "../appui/childwindows/ViewportContentControl";

import "./PopupTestView.scss";

export function PopupTestView() {
  const menuItems: AbstractMenuItemProps[] = React.useMemo(() => {
    return [
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
  }, []);

  const activeIModelConnection = useActiveIModelConnection();
  const divRef = React.useRef<HTMLDivElement>(null);

  const handleContextMenu = React.useCallback((e: React.MouseEvent): boolean => {
    e.preventDefault();
    // eslint-disable-next-line no-console
    IModelApp.uiAdmin.showContextMenu(menuItems, { x: e.pageX, y: e.pageY }, e.target as HTMLElement);
    return false;
  }, [menuItems]);

  return (
    <div className="test-popup-test-view" ref={divRef}>
      {activeIModelConnection &&
        <ViewportContentComponent imodel={activeIModelConnection} onContextMenu={handleContextMenu} />
      }
    </div>
  );
}
