/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module DragDrop  */

import * as React from "react";
import HTML5Backend from "react-dnd-html5-backend";
import { DragDropContext, ContextComponent } from "react-dnd";

/**
 * React component for DragDrop API.
 * This component should not be used directly. Instead, should be used.
 * @beta
 */
export class BeDragDropContextComponent extends React.Component {
  public render(): React.ReactNode {
    return (
      <>
        {this.props.children}
      </>
    );
  }
}

/**
 * Context component for DragDrop API. All DragSources and DropTargets used in the application must be contained in this component.
 * @beta
 */
export const BeDragDropContext: typeof BeDragDropContextComponent & ContextComponent<any> = DragDropContext(HTML5Backend)(BeDragDropContextComponent); // tslint:disable-line:variable-name
