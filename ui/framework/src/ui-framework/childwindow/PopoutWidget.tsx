/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module ChildWindow
 */

import * as React from "react";
import { WidgetDef } from "../widgets/WidgetDef";
import { FrontstageDef } from "../frontstage/FrontstageDef";

// cSpell:ignore popout
interface PopoutWidgetProps {
  widgetPanelId: string;
  widgetDefs: WidgetDef[];
  activeWidgetId: string;
  frontstageDef: FrontstageDef;
}

/** Component used to wrap a widget for use is a child window.
 * @internal
 */
export function PopoutWidget({ widgetPanelId, widgetDefs, activeWidgetId, frontstageDef }: PopoutWidgetProps) {
  const divRef = React.useRef<HTMLDivElement>(null);
  const owningWindowRef = React.useRef<any>(null);

  React.useEffect(() => {
    const triggerDockWidgetProcessing = () => {
      frontstageDef.processChildWindowClose(widgetPanelId);
    };

    owningWindowRef.current = divRef.current!.ownerDocument.defaultView;
    if (owningWindowRef.current)
      owningWindowRef.current.addEventListener("beforeunload", triggerDockWidgetProcessing);
    return () => {
      if (owningWindowRef.current)
        owningWindowRef.current.removeEventListener("beforeunload", triggerDockWidgetProcessing);
    };
  }, [frontstageDef, widgetPanelId]);

  const index = widgetDefs.findIndex((def) => def.id === activeWidgetId);

  // TODO: Currently we only render first widget
  return (
    <div ref={divRef}>
      {widgetDefs.length > 0 && widgetDefs[index >= 0 && index < widgetDefs.length ? index : 0].reactNode}
    </div>
  );
}
