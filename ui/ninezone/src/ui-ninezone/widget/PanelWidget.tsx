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
import { assert } from "@bentley/bentleyjs-core";
import { PanelsStateContext, TabsStateContext, ToolSettingsStateContext, WidgetsStateContext } from "../base/NineZone";
import { isHorizontalPanelState, TabsState, WidgetsState, WidgetState } from "../base/NineZoneState";
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
      assert(!!panel);
      const widgets = React.useContext(WidgetsStateContext);
      const widget = widgets[widgetId];
      const horizontal = isHorizontalPanelSide(panel.side);
      const r = React.useRef<WidgetComponent>(null);
      const refs = useRefs(ref, r);
      const mode = useMode(widgetId);
      const borders = useBorders(widgetId);
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
        borders,
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
            <WidgetTabBar separator={isHorizontalPanelSide(panel.side) ? true : !widget.minimized} />
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
  assert(!!panel);
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

/** @internal */
export function useBorders(widgetId: WidgetState["id"]) {
  const panel = React.useContext(PanelStateContext);
  const panels = React.useContext(PanelsStateContext);
  const toolSettings = React.useContext(ToolSettingsStateContext);
  assert(!!panel);
  let top = true;
  let bottom = true;
  let left = true;
  let right = true;
  const isHorizontal = isHorizontalPanelSide(panel.side);
  const isVertical = !isHorizontal;
  const isFirst = panel.widgets[0] === widgetId;
  const isLast = panel.widgets[panel.widgets.length - 1] === widgetId;
  const isTopMostPanelBorder = panel.side === "top" ||
    (isVertical && !panels.top.span) ||
    (isVertical && panels.top.span && panels.top.collapsed) ||
    (isVertical && panels.top.widgets.length === 0);
  if (panel.side === "bottom") {
    bottom = false;
  }
  if (isVertical && isLast) {
    bottom = false;
  }
  if (isTopMostPanelBorder && toolSettings.type === "docked") {
    top = false;
  }
  if (isVertical && !isFirst) {
    top = false;
  }
  if (isVertical && panels.top.span && !panels.top.collapsed && panels.top.widgets.length > 0) {
    top = false;
  }
  if (isHorizontal && !isFirst) {
    left = false;
  }
  if (isHorizontalPanelState(panel) && !panel.span && isFirst && !panels.left.collapsed && panels.left.widgets.length > 0) {
    left = false;
  }
  if (isHorizontalPanelState(panel) && !panel.span && isLast && !panels.right.collapsed && panels.right.widgets.length > 0) {
    right = false;
  }
  return {
    "nz-border-top": top,
    "nz-border-bottom": bottom,
    "nz-border-left": left,
    "nz-border-right": right,
  };
}
