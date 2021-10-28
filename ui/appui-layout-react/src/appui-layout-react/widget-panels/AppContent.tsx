/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WidgetPanels
 */

import * as React from "react";
import { NineZoneDispatchContext, PanelsStateContext } from "../base/NineZone";
import { WidgetPanelsContent } from "./Content";
import { ContentNodeContext } from "./Panels";
import { panelSides } from "./Panel";
import { useRefEffect } from "@itwin/core-react";

/** Main app content (i.e. viewport) that will change bounds based on panel pinned settings.
 * @internal
 */
export const AppContent = React.memo(function AppContent() { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const panels = React.useContext(PanelsStateContext);
  const content = React.useContext(ContentNodeContext);
  const ref = usePanelsAutoCollapse<HTMLDivElement>();
  return (
    <WidgetPanelsContent
      className="nz-widgetPanels-appContent"
      ref={ref}
      pinnedLeft={panels.left.pinned}
      pinnedRight={panels.right.pinned}
      pinnedTop={panels.top.pinned}
      pinnedBottom={panels.bottom.pinned}
    >
      {content}
    </WidgetPanelsContent>
  );
});

/** @internal */
export function usePanelsAutoCollapse<T extends Element>(): React.Ref<T> {
  const panels = React.useContext(PanelsStateContext);
  const dispatch = React.useContext(NineZoneDispatchContext);
  const setRef = useRefEffect<T>((instance) => {
    if (!instance)
      return;
    const listener = () => {
      for (const side of panelSides) {
        const panel = panels[side];
        if (panel.collapsed || panel.pinned)
          continue;
        dispatch({
          type: "PANEL_SET_COLLAPSED",
          collapsed: true,
          side: panel.side,
        });
      }
    };
    instance.addEventListener("mousedown", listener, true);
    return () => {
      instance.removeEventListener("mousedown", listener, true);
    };
  }, [panels]);
  return setRef;
}
