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
import { assert } from "@itwin/core-bentley";
import { WidgetContentManagerContext } from "./ContentManager";
import { WidgetStateContext } from "./Widget";
import { PanelSideContext } from "../widget-panels/Panel";

/** @internal */
export interface WidgetContentContainerProps {
  children?: React.ReactNode;
}

/** @internal */
export const WidgetContentContainer = React.memo(function WidgetContentContainer(props: WidgetContentContainerProps) { // eslint-disable-line @typescript-eslint/no-shadow, @typescript-eslint/naming-convention
  const widget = React.useContext(WidgetStateContext);
  const widgetContentManager = React.useContext(WidgetContentManagerContext);
  const side = React.useContext(PanelSideContext);

  assert(!!widget);
  const ref = React.useCallback((instance: HTMLDivElement | null) => {
    widgetContentManager.setContainer(widget.activeTabId, instance);
  }, [widget.activeTabId, widgetContentManager]);
  const className = classnames(
    "nz-widget-contentContainer",
    undefined === side && widget.minimized && "nz-minimized",
  );
  return (
    <div
      className={className}
    >
      <div
        className="nz-content"
        ref={ref}
      />
      {props.children}
    </div>
  );
});
