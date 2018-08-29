/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module DragDrop  */

import * as React from "react";
import HTML5Backend from "react-dnd-html5-backend";
import { DragDropContextProvider } from "react-dnd";

export class BeDragDropContextProvider extends React.Component {
  public render(): React.ReactNode {
    return (
      <DragDropContextProvider backend={HTML5Backend}>
        {this.props.children}
      </DragDropContextProvider>
    );
  }
}
