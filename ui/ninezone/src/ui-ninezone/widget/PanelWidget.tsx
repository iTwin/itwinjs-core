/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import "./PanelWidget.scss";
import classnames from "classnames";
import * as React from "react";
import { useRefs } from "@bentley/ui-core";
import { assert } from "../base/assert";
import { TabsStateContext, WidgetsStateContext } from "../base/NineZone";
import { TabsState, WidgetsState, WidgetState } from "../base/NineZoneState";
import { isHorizontalPanelSide, PanelStateContext } from "../widget-panels/Panel";
import { WidgetContentContainer } from "./ContentContainer";
import { useTabTransientState } from "./ContentRenderer";
import { WidgetTabBar } from "./TabBar";
import { Widget, WidgetComponent, WidgetProvider } from "./Widget";

/** @internal */
export interface PanelWidgetProps {
  widgetId: WidgetState["id"];
  onBeforeTransition(): void;
  onPrepareTransition(): void;
  onTransitionEnd(): void;
  size: number | undefined;
  transition: "init" | "transition" | undefined;
}

/** @internal */
export const PanelWidget = React.memo( // eslint-disable-line react/display-name
  React.forwardRef<WidgetComponent, PanelWidgetProps>(
    function PanelWidget({
      widgetId,
      onBeforeTransition,
      onPrepareTransition,
      onTransitionEnd,
      size,
      transition,
    }, ref) { // eslint-disable-line @typescript-eslint/naming-convention
      const panel = React.useContext(PanelStateContext);
      assert(panel);
      const widgets = React.useContext(WidgetsStateContext);
      const widget = widgets[widgetId];
      const horizontal = isHorizontalPanelSide(panel.side);
      const r = React.useRef<WidgetComponent>(null);
      const refs = useRefs(ref, r);
      const mode = useMode(widgetId);
      const [prevMode, setPrevMode] = React.useState(mode);
      const lastOnPrepareTransition = React.useRef(onPrepareTransition);
      lastOnPrepareTransition.current = onPrepareTransition;
      if (prevMode !== mode) {
        onBeforeTransition();
        setPrevMode(mode);
      }
      React.useLayoutEffect(() => {
        lastOnPrepareTransition.current();
      }, [mode]);
      const onSave = React.useCallback(() => {
        onBeforeTransition();
      }, [onBeforeTransition]);
      const onRestore = React.useCallback(() => {
        onPrepareTransition();
      }, [onPrepareTransition]);
      useTabTransientState(widget.activeTabId, onSave, onRestore);
      const style = React.useMemo<React.CSSProperties | undefined>(() => {
        if (size !== undefined) {
          return { flexBasis: size };
        } else if (mode === "fit") {
          return getMaxSize(horizontal, `${100 / panel.widgets.length}%`);
        }
        return undefined;
      }, [horizontal, size, mode, panel.widgets.length]);
      const className = classnames(
        "nz-widget-panelWidget",
        horizontal && "nz-horizontal",
        size === undefined && `nz-${mode}`,
        transition !== undefined && `nz-${transition}`,
      );
      return (
        <WidgetProvider
          widget={widget}
        >
          <Widget
            className={className}
            onTransitionEnd={onTransitionEnd}
            style={style}
            ref={refs}
          >
            <WidgetTabBar />
            <WidgetContentContainer />
          </Widget>
        </WidgetProvider>
      );
    }),
);

function getMaxSize(horizontal: boolean, size: string | number) {
  if (horizontal)
    return {
      maxWidth: size,
    };
  return {
    maxHeight: size,
  };
}

function findFillWidget(panelWidgets: ReadonlyArray<string>, widgets: WidgetsState, tabs: TabsState) {
  return panelWidgets.find((widgetId) => {
    const widget = widgets[widgetId];
    if (widget.minimized)
      return false;
    const tabId = widget.activeTabId;
    const tab = tabs[tabId];
    if (!tab.preferredPanelWidgetSize)
      return true;
    return false;
  });
}

/** @internal */
export function useMode(widgetId: string): "fit" | "fill" | "minimized" {
  const panel = React.useContext(PanelStateContext);
  const widgets = React.useContext(WidgetsStateContext);
  const tabs = React.useContext(TabsStateContext);
  assert(panel);
  const fillWidget = findFillWidget(panel.widgets, widgets, tabs);

  // Force `fill` for last panel widget that is not minimized.
  if (!fillWidget) {
    for (let i = panel.widgets.length - 1; i >= 0; i--) {
      const wId = panel.widgets[i];
      const w = widgets[wId];
      if (w.minimized)
        continue;
      if (wId === widgetId)
        return "fill";
      break;
    }
  }

  const widget = widgets[widgetId];
  if (widget.minimized)
    return "minimized";
  const tabId = widget.activeTabId;
  const tab = tabs[tabId];
  return tab.preferredPanelWidgetSize ? "fit" : "fill";
}
