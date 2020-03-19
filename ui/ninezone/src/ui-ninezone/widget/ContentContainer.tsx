/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as React from "react";
import { WidgetStateContext } from "./Widget";
import { assert } from "../base/assert";
import { WidgetContentManagerContext } from "./ContentManager";
import "./ContentContainer.scss";

/** @internal */
export const WidgetContentContainer = React.memo(function WidgetContentContainer() { // tslint:disable-line: no-shadowed-variable variable-name
  const widget = React.useContext(WidgetStateContext);
  const widgetContentManager = React.useContext(WidgetContentManagerContext);
  assert(widget);
  if (!widget.activeTabId)
    return null;
  const ref = widgetContentManager.getWidgetContentContainerRef(widget.activeTabId);
  return (
    <div
      className="nz-widget-content-container"
      ref={ref as React.Ref<HTMLDivElement>}
    />
  );
});
