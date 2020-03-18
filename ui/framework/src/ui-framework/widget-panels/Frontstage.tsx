/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Frontstage
 */
import * as React from "react";
import produce from "immer";
import { WidgetPanels, NineZoneStateReducer, createNineZoneState, NineZoneProvider, NineZoneState, addPanelWidget, addTab, PanelSide, NineZoneActionTypes } from "@bentley/ui-ninezone";
import { useActiveFrontstageDef } from "../frontstage/Frontstage";
import { WidgetPanelsStatusBar } from "./StatusBar";
import { FrontstageDef } from "../frontstage/FrontstageDef";
import { WidgetPanelsToolbars } from "./Toolbars";
import { WidgetPanelsToolSettings } from "./ToolSettings";
import { WidgetPanelsFrontstageContent } from "./FrontstageContent";
import { WidgetContent } from "./Content";
import { WidgetDef } from "../widgets/WidgetDef";
import { ZoneState } from "../zones/ZoneDef";
import { StagePanelState, StagePanelZoneDefKeys } from "../stagepanels/StagePanelDef";
import { ModalFrontstageComposer, useActiveModalFrontstageInfo } from "./ModalFrontstageComposer";
import "./Frontstage.scss";

/** @internal */
export const WidgetPanelsFrontstage = React.memo(function WidgetPanelsFrontstage() { // tslint:disable-line: variable-name no-shadowed-variable
  const frontstageDef = useActiveFrontstageDef();
  const [nineZone, nineZoneDispatch] = useFrontstageDefNineZone(frontstageDef);
  if (!frontstageDef)
    return null;
  return (
    <NineZoneProvider
      dispatch={nineZoneDispatch}
      state={nineZone}
    >
      <WidgetPanelsFrontstageComponent />
    </NineZoneProvider >
  );
});

const WidgetPanelsFrontstageComponent = React.memo(function WidgetPanelsFrontstageComponent() { // tslint:disable-line: variable-name no-shadowed-variable
  const activeModalFrontstageInfo = useActiveModalFrontstageInfo();
  return (
    <div
      className="uifw-widgetPanels-frontstage"
    >
      <ModalFrontstageComposer stageInfo={activeModalFrontstageInfo} />
      <WidgetPanelsToolSettings />
      <WidgetPanels className="uifw-widgetPanels"
        centerContent={<WidgetPanelsToolbars />}
        widgetContent={<WidgetContent />}
      >
        <WidgetPanelsFrontstageContent />
      </WidgetPanels>
      <WidgetPanelsStatusBar />
    </div>
  );
});

/** @internal */
export function addWidgets(state: NineZoneState, widgets: ReadonlyArray<WidgetDef>, side: PanelSide, widgetId: WidgetIdTypes): NineZoneState {
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

type FrontstagePanelDefs = Pick<FrontstageDef, "leftPanel" | "rightPanel" | "topPanel" | "bottomPanel">;
type FrontstagePanelDefKeys = keyof FrontstagePanelDefs;

type WidgetIdTypes = "leftStart" |
  "leftMiddle" |
  "leftEnd" |
  "rightStart" |
  "rightMiddle" |
  "rightEnd" |
  "top" |
  "bottom";

function getPanelDefKey(side: PanelSide): FrontstagePanelDefKeys {
  switch (side) {
    case "bottom":
      return "bottomPanel";
    case "left":
      return "leftPanel";
    case "right":
      return "rightPanel";
    case "top":
      return "topPanel";
  }
}

/** @internal */
export function getWidgetId(side: PanelSide, key: StagePanelZoneDefKeys): WidgetIdTypes {
  switch (side) {
    case "left": {
      if (key === "start") {
        return "leftStart";
      } else if (key === "middle") {
        return "leftMiddle";
      }
      return "leftEnd";
    }
    case "right": {
      if (key === "start") {
        return "rightStart";
      } else if (key === "middle") {
        return "rightMiddle";
      }
      return "rightEnd";
    }
    case "top": {
      return "top";
    }
    case "bottom": {
      return "bottom";
    }
  }
}

/** @internal */
export function addPanelWidgets(
  state: NineZoneState,
  frontstage: FrontstageDef | undefined,
  side: PanelSide,
): NineZoneState {
  const panelDefKey = getPanelDefKey(side);
  const panelDef = frontstage?.[panelDefKey];
  const panelZones = panelDef?.panelZones;
  if (!panelZones) {
    switch (side) {
      case "left": {
        state = addWidgets(state, frontstage?.centerLeft?.widgetDefs || [], side, "leftStart");
        state = addWidgets(state, frontstage?.bottomLeft?.widgetDefs || [], side, "leftMiddle");
        state = addWidgets(state, frontstage?.leftPanel?.widgetDefs || [], side, "leftEnd");
        break;
      }
      case "right": {
        state = addWidgets(state, frontstage?.centerRight?.widgetDefs || [], side, "rightStart");
        state = addWidgets(state, frontstage?.bottomRight?.widgetDefs || [], side, "rightMiddle");
        state = addWidgets(state, frontstage?.rightPanel?.widgetDefs || [], side, "rightEnd");
        break;
      }
      case "top": {
        const widgets = [
          ...(frontstage?.topPanel?.widgetDefs || []),
          ...(frontstage?.topMostPanel?.widgetDefs || []),
        ];
        state = addWidgets(state, widgets, side, "top");
        break;
      }
      case "bottom": {
        const widgets = [
          ...(frontstage?.bottomPanel?.widgetDefs || []),
          ...(frontstage?.bottomMostPanel?.widgetDefs || []),
        ];
        state = addWidgets(state, widgets, side, "bottom");
        break;
      }
    }
    return state;
  }

  for (const [key, panelZone] of panelZones) {
    const widgetId = getWidgetId(side, key);
    panelZone.widgetDefs;
    state = addWidgets(state, panelZone.widgetDefs, side, widgetId);
  }
  return state;
}

/** @internal */
export function initializeNineZoneState(frontstage: FrontstageDef | undefined): NineZoneState {
  let state = createNineZoneState();
  state = addPanelWidgets(state, frontstage, "left");
  state = addPanelWidgets(state, frontstage, "right");
  state = addPanelWidgets(state, frontstage, "top");
  state = addPanelWidgets(state, frontstage, "bottom");
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
