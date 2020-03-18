/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WidgetPanels
 */

import classnames from "classnames";
import * as React from "react";
import { CursorTypeContext } from "../base/NineZone";
import "./CursorOverlay.scss";

/** @internal */
export type CursorType = "ew-resize" | "ns-resize" | "grabbing";

/** Renders cursor overlay to control cursor type of the application.
 * I.e. when dragging widget around "grabbing" cursor should be displayed until user releases the widget.
 * @internal
 */
export function CursorOverlay() {
  const type = React.useContext(CursorTypeContext);
  if (!type)
    return null;
  const cursorClassName = getCursorClassName(type);
  const className = classnames(
    "nz-widgetPanels-cursorOverlay",
    cursorClassName,
  );
  return (
    <div
      className={className}
    />
  );
}

/** @internal */
export function getCursorClassName(type: CursorType) {
  return `nz-widgetPanels-cursorOverlay_cursor nz-${type}`;
}
