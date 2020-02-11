/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Frontstage
 */
import * as React from "react";
import produce from "immer";
import { WidgetPanels, NineZoneStateReducer, createNineZoneState, NineZoneProvider, NineZoneState, addPanelWidget, addTab, WidgetPanelSide, NineZoneActionTypes } from "@bentley/ui-ninezone";
import { useActiveFrontstageDef } from "../frontstage/Frontstage";
import { WidgetPanelsStatusBar } from "./StatusBar";
import { FrontstageDef } from "../frontstage/FrontstageDef";
import { WidgetPanelsToolbars } from "./Toolbars";
import { WidgetPanelsToolSettings } from "./ToolSettings";
import { WidgetPanelsFrontstageContent } from "./FrontstageContent";
import { WidgetContent } from "./Content";
import { WidgetDef } from "../widgets/WidgetDef";
import { ZoneState } from "../zones/ZoneDef";
import { StagePanelState } from "../stagepanels/StagePanelDef";
import "./Frontstage.scss";

/** @internal */
export function WidgetPanelsFrontstage() {
  const frontstageDef = useActiveFrontstageDef();
  const frontstage = frontstageDef?.frontstageProvider?.frontstage;
  const [nineZone, nineZoneDispatch] = useFrontstageDefNineZone(frontstageDef);
  if (!frontstage)
    return null;
  return (
    <NineZoneProvider
      dispatch={nineZoneDispatch}
      state={nineZone}
    >
      <div
        className="uifw-widgetPanels-frontstage"
      >
        <WidgetPanelsStatusBar />
        <WidgetPanels className="uifw-widgetPanels"
          centerContent={<WidgetPanelsToolbars />}
          widgetContent={<WidgetContent />}
        >
          <WidgetPanelsFrontstageContent />
        </WidgetPanels>
        <WidgetPanelsToolSettings />
      </div>
    </NineZoneProvider>
  );
}

/** @internal */
export function addWidget(state: NineZoneState, widgets: ReadonlyArray<WidgetDef>, side: WidgetPanelSide, widgetId: string): NineZoneState {
  if (widgets.length > 0) {
    const activeWidget = widgets.find((widget) => widget.isActive);
    const minimized = !activeWidget;
    state = addPanelWidget(state, side, widgetId, {
      activeTabId: activeWidget?.id,
      minimized,
    });
  }

  for (const widget of widgets) {
    const label = widget.label === "" ? "Panel" : widget.label;
    state = addTab(state, widgetId, widget.id, {
      label,
    });
  }
  return state;
}

/** @internal */
export function initializeNineZoneState(frontstage: FrontstageDef | undefined): NineZoneState {
  let state = createNineZoneState();
  state = addWidget(state, frontstage?.centerLeft?.widgetDefs || [], "left", "leftStart");
  state = addWidget(state, frontstage?.bottomLeft?.widgetDefs || [], "left", "leftMiddle");
  state = addWidget(state, frontstage?.leftPanel?.widgetDefs || [], "left", "leftEnd");
  state = addWidget(state, frontstage?.centerRight?.widgetDefs || [], "right", "rightStart");
  state = addWidget(state, frontstage?.bottomRight?.widgetDefs || [], "right", "rightMiddle");
  state = addWidget(state, frontstage?.rightPanel?.widgetDefs || [], "right", "rightEnd");
  state = addWidget(state, frontstage?.topPanel?.widgetDefs || [], "top", "topLeft");
  state = addWidget(state, frontstage?.topMostPanel?.widgetDefs || [], "top", "topRight");
  state = addWidget(state, frontstage?.bottomPanel?.widgetDefs || [], "bottom", "bottomLeft");
  state = addWidget(state, frontstage?.bottomMostPanel?.widgetDefs || [], "bottom", "bottomRight");
  state = produce(state, (stateDraft) => {
    for (const [, panel] of Object.entries(stateDraft.panels)) {
      const widgetWithActiveTab = panel.widgets.find((widgetId) => stateDraft.widgets[widgetId].activeTabId !== undefined);
      const firstWidget = panel.widgets.length > 0 ? stateDraft.widgets[panel.widgets[0]] : undefined;
      if (!widgetWithActiveTab && firstWidget) {
        firstWidget.activeTabId = firstWidget.tabs[0];
        firstWidget.minimized = false;
      }
    }
    stateDraft.panels.left.collapsed = isPanelCollapsed([
      frontstage?.centerLeft?.zoneState,
      frontstage?.bottomLeft?.zoneState,
    ], [frontstage?.leftPanel?.panelState]);
    stateDraft.panels.right.collapsed = isPanelCollapsed([
      frontstage?.centerRight?.zoneState,
      frontstage?.bottomRight?.zoneState,
    ], [frontstage?.rightPanel?.panelState]);
    stateDraft.panels.top.collapsed = isPanelCollapsed([], [
      frontstage?.topPanel?.panelState,
      frontstage?.topMostPanel?.panelState,
    ]);
    stateDraft.panels.bottom.collapsed = isPanelCollapsed([], [
      frontstage?.bottomPanel?.panelState,
      frontstage?.bottomMostPanel?.panelState,
    ]);
  });
  return state;
}

/** @internal */
export function isPanelCollapsed(zoneStates: ReadonlyArray<ZoneState | undefined>, panelStates: ReadonlyArray<StagePanelState | undefined>) {
  const openZone = zoneStates.find((zoneState) => zoneState === ZoneState.Open);
  const openPanel = panelStates.find((panelState) => panelState === StagePanelState.Open);
  return !openZone && !openPanel;
}

/** @internal future */
export const NINE_ZONE_INITIALIZE = "NINE_ZONE_INITIALIZE";

/** @internal future */
export interface InitializeNineZoneAction {
  readonly type: typeof NINE_ZONE_INITIALIZE;
  readonly frontstage: FrontstageDef | undefined;
}

/** @internal future */
export type FrontstageDefNineZoneActionTypes =
  NineZoneActionTypes |
  InitializeNineZoneAction;

/** @internal */
export function useFrontstageDefNineZone(frontstage?: FrontstageDef): [NineZoneState, React.Dispatch<FrontstageDefNineZoneActionTypes>] {
  const reducerCallback = React.useCallback((state: NineZoneState, action: FrontstageDefNineZoneActionTypes) => {
    if (action.type === NINE_ZONE_INITIALIZE)
      return initializeNineZoneState(action.frontstage);
    // TODO: update WidgetDef state here
    return NineZoneStateReducer(state, action);
  }, []);
  const [nineZone, dispatch] = React.useReducer(reducerCallback, frontstage, initializeNineZoneState);
  React.useEffect(() => {
    dispatch({
      type: NINE_ZONE_INITIALIZE,
      frontstage,
    });
  }, [frontstage]);
  // TODO: subscribe to WidgetDef state change api and use dispatch to sync the states OR re-initialize
  return [nineZone, dispatch];
}
