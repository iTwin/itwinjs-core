/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ContextMenu
 */

import * as React from "react";
import * as ReactDOM from "react-dom";
import { ContextMenu, ContextMenuProps } from "./ContextMenu";

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
  /** required when context menu can be shown in a pop-out window. */
  sourceDocument?: Document;
}

/** GlobalContextMenu React component used to display a [[ContextMenu]] at the cursor
 * @public
 */
export class GlobalContextMenu extends React.PureComponent<GlobalContextMenuProps> {

  constructor(props: GlobalContextMenuProps) {
    super(props);
  }

  public render(): React.ReactNode {
    const { x, y, identifier, contextMenuComponent, ...props } = this.props; // eslint-disable-line @typescript-eslint/no-unused-vars
    const positioningStyle: React.CSSProperties = {
      left: x,
      top: y,
    };

    const CtxMenu = contextMenuComponent || ContextMenu; // eslint-disable-line @typescript-eslint/naming-convention
    const parentDocument = this.props.sourceDocument ?? document;

    return ReactDOM.createPortal(
      <div className="core-context-menu-global" style={positioningStyle}>
        <CtxMenu
          {...props} />
      </div >
      , parentDocument.body);
  }
}
