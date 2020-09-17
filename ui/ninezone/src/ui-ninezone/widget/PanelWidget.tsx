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
import { TabsStateContext, WidgetsStateContext } from "../base/NineZone";
import { WidgetState } from "../base/NineZoneState";
import { isHorizontalPanelSide, PanelStateContext } from "../widget-panels/Panel";
import { WidgetContentContainer } from "./ContentContainer";
import { WidgetTabBar } from "./TabBar";
import { Widget, WidgetComponent, WidgetProvider } from "./Widget";
import { SizeProps } from "@bentley/ui-core";
import { useTabTransientState } from "./ContentRenderer";
import { assert } from "../base/assert";

/** @internal */
export interface PanelWidgetProps {
  widgetId: WidgetState["id"];
}

/** @internal */
export const PanelWidget = React.memo<PanelWidgetProps>(function PanelWidget({ widgetId }) { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const panelState = React.useContext(PanelStateContext);
  assert(panelState);
  const widgets = React.useContext(WidgetsStateContext);
  const widget = widgets[widgetId];
  const preferredSize = usePreferredPanelWidgetSize(widgetId);
  const [maxSize, setMaxSize] = React.useState<number>();
  const [transition, setTransition] = React.useState<"prepared" | "transitioning">();
  const animateFrom = React.useRef<number>();
  const animateTo = React.useRef<number>();
  const lastSize = React.useRef<SizeProps>();
  const widgetRef = React.useRef<WidgetComponent>(null);
  const currentActiveTabId = React.useRef(widget.activeTabId);
  const lastActiveTabId = React.useRef<WidgetState["activeTabId"]>();
  const currentHorizontal = React.useRef(false);
  currentActiveTabId.current = widget.activeTabId;
  const horizontal = isHorizontalPanelSide(panelState.side);
  currentHorizontal.current = horizontal;
  const forceFill = useForceFill();
  const mode = getPanelWidgetMode({
    forceFill,
    minimized: widget.minimized,
    fitContent: !!preferredSize,
  });
  const onSave = React.useCallback(() => {
    assert(widgetRef.current);
    // Measure current widget size (before other tab content is rendered).
    const measured = widgetRef.current.measure();
    animateFrom.current = getSize(horizontal, measured);
  }, [horizontal]);
  const onRestore = React.useCallback(() => {
    assert(widgetRef.current);
    const measured = widgetRef.current.measure();
    animateTo.current = getSize(horizontal, measured);

    if (animateFrom.current === undefined || animateFrom.current === animateTo.current)
      return;

    // Prepare transition.
    setMaxSize(animateFrom.current);
    setTransition("prepared");
  }, [horizontal]);
  useTabTransientState(widget.activeTabId, onSave, onRestore);
  React.useLayoutEffect(() => {
    assert(widgetRef.current);
    if (lastActiveTabId.current !== currentActiveTabId.current) {
      // Widget id changed, need to fallback to transient state logic (for new tab content to be rendered OR transition will flicker).
      return;
    }

    const measured = widgetRef.current.measure();
    const from = lastSize.current && getSize(currentHorizontal.current, lastSize.current);
    animateTo.current = getSize(currentHorizontal.current, measured);
    if (from === undefined || from === animateTo.current)
      return;

    // Prepare transition.
    setMaxSize(from);
    setTransition("prepared");
  }, [mode]);
  React.useLayoutEffect(() => {
    if (transition === "prepared") {
      setMaxSize(animateTo.current);
      setTransition("transitioning");
    }
  }, [transition, widget.id]);
  React.useLayoutEffect(() => {
    lastActiveTabId.current = widget.activeTabId;
  }, [widget.activeTabId]);
  const handleTransitionEnd = React.useCallback(() => {
    setTransition(undefined);
    setMaxSize(undefined);
  }, []);
  if (widgetRef.current) {
    const measured = widgetRef.current.measure();
    lastSize.current = measured;
  }

  const style = React.useMemo(() => {
    if (maxSize) {
      return getMaxSize(horizontal, maxSize);
    } else if (mode === "nz-fit") {
      return getMaxSize(horizontal, `${100 / panelState.widgets.length}%`);
    }
    return undefined;
  }, [horizontal, maxSize, mode, panelState.widgets]);
  const className = classnames(
    "nz-widget-panelWidget",
    horizontal && "nz-horizontal",
    !transition && mode,
    !!transition && "nz-transition",
    transition === "transitioning" && "nz-transitioning",
  );
  return (
    <WidgetProvider
      widget={widget}
    >
      <Widget
        className={className}
        onTransitionEnd={handleTransitionEnd}
        style={style}
        ref={widgetRef}
      >
        <WidgetTabBar />
        <WidgetContentContainer />
      </Widget>
    </WidgetProvider>
  );
});

/** @internal */
export function usePreferredPanelWidgetSize(widgetId: WidgetState["id"]) {
  const widgets = React.useContext(WidgetsStateContext);
  const tabs = React.useContext(TabsStateContext);
  const widget = widgets[widgetId];
  const tab = tabs[widget.activeTabId];
  return tab.preferredPanelWidgetSize;
}

/** Returns `true` when there are no widgets that will fill the panel.
 * @internal
 */
export function useForceFill() {
  const panelState = React.useContext(PanelStateContext);
  const widgetsState = React.useContext(WidgetsStateContext);
  const tabsState = React.useContext(TabsStateContext);
  assert(panelState);
  for (const widgetId of panelState.widgets) {
    const widget = widgetsState[widgetId];
    if (widget.minimized)
      continue;
    const tabId = widget.activeTabId;
    const tab = tabId && tabsState[tabId];
    if (tab && tab.preferredPanelWidgetSize === "fit-content")
      continue;
    return false;
  }
  return true;
}

interface GetPanelWidgetModeArgs {
  forceFill: boolean;
  minimized: boolean;
  fitContent: boolean;
}

type PanelWidgetMode = "nz-fit" | "nz-fill" | "nz-minimized";

function getPanelWidgetMode({ forceFill, minimized, fitContent }: GetPanelWidgetModeArgs): PanelWidgetMode {
  if (minimized)
    return "nz-minimized";
  if (forceFill)
    return "nz-fill";
  if (fitContent)
    return "nz-fit";
  return "nz-fill";
}

function getMaxSize(horizontal: boolean, size: string | number | undefined) {
  if (horizontal)
    return {
      maxWidth: size,
    };
  return {
    maxHeight: size,
  };
}

function getSize(horizontal: boolean, size: SizeProps) {
  if (horizontal)
    return size.width;
  return size.height;
}
