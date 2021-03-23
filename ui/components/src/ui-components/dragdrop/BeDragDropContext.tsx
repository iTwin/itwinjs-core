/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DragDrop
 */

import * as React from "react";
import react_dnd from "react-dnd";
const { DndProvider } = react_dnd;
import { HTML5Backend } from "react-dnd-html5-backend";

/**
 * Context component for DragDrop API. All DragSources and DropTargets used in the application must be contained in this component.
 * @beta
 * @deprecated
 */
export function BeDragDropContext(props: { children?: React.ReactNode }) {
  return <DndProvider backend={HTML5Backend}>{props.children}</DndProvider>;
}
