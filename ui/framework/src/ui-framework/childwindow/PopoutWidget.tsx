/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ChildWindowManager
 */

import * as React from "react";
import { WidgetDef } from "../widgets/WidgetDef";

interface PopoutWidgetProps {
  widgetContainerId: string;
  widgetDef: WidgetDef;
}

/** Component used to wrap a widget for use is a child window.
 * @internal
 */
export function PopoutWidget({ widgetContainerId, widgetDef }: PopoutWidgetProps) {
  return (
    <div data-widget-id={widgetContainerId}>
      {widgetDef.reactNode}
    </div>
  );
}
