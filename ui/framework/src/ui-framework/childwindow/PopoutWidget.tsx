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

/** Component used to wrap a widget for use is a child window.
 * @internal
 */
export function PopoutWidget({ widgetDef, frontstageDef }: { widgetDef: WidgetDef, frontstageDef: FrontstageDef }) {
  const divRef = React.useRef<HTMLDivElement>(null);
  const owningWindowRef = React.useRef<any>(null);

  React.useEffect(() => {
    const triggerDockWidgetProcessing = () => {
      frontstageDef.dockPopoutWidget(widgetDef.id);
    };

    owningWindowRef.current = divRef.current!.ownerDocument.defaultView;
    if (owningWindowRef.current)
      owningWindowRef.current.addEventListener("beforeunload", triggerDockWidgetProcessing);
    return () => {
      if (owningWindowRef.current)
        owningWindowRef.current.removeEventListener("beforeunload", triggerDockWidgetProcessing);
    };
  }, [widgetDef, frontstageDef]);

  return (
    <div ref={divRef}>
      {widgetDef.reactNode}
    </div>
  );
}
