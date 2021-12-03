/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ChildWindowManager
 */

import "./PopoutWidget.scss";
import * as React from "react";
import { WidgetDef } from "../widgets/WidgetDef";
import { ExternalContentHost } from "../widget-panels/Content";

interface PopoutWidgetProps {
  widgetContainerId: string;
  widgetDef: WidgetDef;
}

/** Component used to wrap a widget for use is a child window.
 * @internal
 */
export function PopoutWidget({ widgetContainerId, widgetDef }: PopoutWidgetProps) {
  const reactNode = widgetDef.reactNode;
  const attachToDom = widgetDef.attachToDom;

  // istanbul ignore next
  const children = React.useMemo(() => {
    if (attachToDom) {
      return <ExternalContentHost widgetContainerId={widgetContainerId} attachToDom={attachToDom} />;
    } else {
      return reactNode;
    }
  }, [attachToDom, widgetContainerId, reactNode]);
  return (
    <div className="uifw-popout-widget-filled-container" data-widget-id={widgetContainerId}>
      {children}
    </div>
  );
}
