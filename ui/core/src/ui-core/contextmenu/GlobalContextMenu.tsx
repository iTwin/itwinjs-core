/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ContextMenu
 */

import * as React from "react";
import * as ReactDOM from "react-dom";
import { ContextMenu, ContextMenuProps } from "./ContextMenu.js";

/** Properties for the [[GlobalContextMenu]] component
 * @public
 */
export interface GlobalContextMenuProps extends ContextMenuProps {
  /** Unique identifier, to distinguish from other GlobalContextMenu components. Needed only if multiple GlobalContextMenus are used simultaneously. */
  identifier?: string;
  /** Specifies the x/horizontal position on the viewport. */
  x: number | string;
  /** Specifies the y/vertical position on the viewport. */
  y: number | string;
  /** Context menu element. Default: ContextMenu */
  contextMenuComponent?: React.ComponentType<ContextMenuProps>;
}

/** GlobalContextMenu React component used to display a [[ContextMenu]] at the cursor
 * @public
 */
export class GlobalContextMenu extends React.PureComponent<GlobalContextMenuProps> {
  private _container: HTMLDivElement;

  constructor(props: GlobalContextMenuProps) {
    super(props);

    this._container = document.createElement("div");
    this._container.id = props.identifier !== undefined ? `core-context-menu-${props.identifier}` : "core-context-menu";
    let rt = document.getElementById("core-context-menu-root") as HTMLDivElement;

    // istanbul ignore else
    if (!rt) {
      rt = document.createElement("div");
      rt.id = "core-context-menu-root";
      document.body.appendChild(rt);
    }

    rt.appendChild(this._container);
  }

  public componentWillUnmount() {
    // istanbul ignore else
    if (this._container.parentElement) { // cleanup
      this._container.parentElement.removeChild(this._container);
    }

    const rt = document.getElementById("core-context-menu-root") as HTMLDivElement;

    // istanbul ignore else
    if (rt && rt.parentElement !== null && rt.children.length === 0) {
      rt.parentElement.removeChild(rt);
    }
  }

  public render(): React.ReactNode {
    const { x, y, identifier, contextMenuComponent, ...props } = this.props; // eslint-disable-line @typescript-eslint/no-unused-vars
    const positioningStyle: React.CSSProperties = {
      left: x,
      top: y,
    };

    const CtxMenu = contextMenuComponent || ContextMenu; // eslint-disable-line @typescript-eslint/naming-convention

    return ReactDOM.createPortal(
      <div className="core-context-menu-global" style={positioningStyle}>
        <CtxMenu
          {...props} />
      </div >
      , this._container);
  }
}
