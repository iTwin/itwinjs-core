/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WidgetPanels
 */

import "./CursorOverlay.scss";
import * as React from "react";
import { CursorTypeContext } from "../base/NineZone";

/** @internal */
export type CursorType = "nwse-resize" | "nesw-resize" | "ew-resize" | "ns-resize" | "grabbing";

/** Controls cursor type of the application.
 * I.e. when dragging a widget "grabbing" cursor should be displayed until user drops the widget.
 * @internal
 */
export function useCursor() {
  const type = React.useContext(CursorTypeContext);
  React.useEffect(() => {
    const cursor = type ? `nz-${type}` : undefined;
    cursor && document.body.classList.add(cursor);
    return () => {
      cursor && document.body.classList.remove(cursor);
    };
  }, [type]);
}

/** @internal */
export function getCursorClassName(type: CursorType) {
  return `nz-widgetPanels-cursorOverlay_cursor nz-${type}`;
}
