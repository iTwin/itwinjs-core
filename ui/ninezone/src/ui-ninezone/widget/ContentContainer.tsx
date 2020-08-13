/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import "./ContentContainer.scss";
import classnames from "classnames";
import * as React from "react";
import { assert } from "../base/assert";
import { WidgetContentManagerContext } from "./ContentManager";
import { WidgetStateContext } from "./Widget";

/** @internal */
export const WidgetContentContainer = React.memo(function WidgetContentContainer() { // eslint-disable-line no-shadow, @typescript-eslint/naming-convention
  const widget = React.useContext(WidgetStateContext);
  const widgetContentManager = React.useContext(WidgetContentManagerContext);
  assert(widget);
  if (!widget.activeTabId)
    return null;
  const ref = widgetContentManager.getWidgetContentContainerRef(widget.activeTabId);
  const className = classnames(
    "nz-widget-content-container",
    widget.minimized && "nz-minimized",
  );
  return (
    <div
      className={className}
      ref={ref as React.Ref<HTMLDivElement>}
    />
  );
});
