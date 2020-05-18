/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Frontstage
 */
import "./Frontstage.scss";
import produce, { castDraft, Draft } from "immer";
import * as React from "react";
import { UiSettingsResult, UiSettingsStatus } from "@bentley/ui-core";
import {
  addPanelWidget, addTab, createNineZoneState, floatingWidgetBringToFront, FloatingWidgets, FloatingWidgetState, NineZoneActionTypes, NineZoneProvider,
  NineZoneState, NineZoneStateReducer, PanelSide, TabState, WidgetPanels, WidgetState,
} from "@bentley/ui-ninezone";
import { useActiveFrontstageDef } from "../frontstage/Frontstage";
import { FrontstageDef } from "../frontstage/FrontstageDef";
import { StagePanelState, StagePanelZoneDefKeys } from "../stagepanels/StagePanelDef";
import { useUiSettingsContext } from "../uisettings/useUiSettings";
import { WidgetDef } from "../widgets/WidgetDef";
import { ZoneState } from "../zones/ZoneDef";
import { WidgetContent } from "./Content";
import { WidgetPanelsFrontstageContent } from "./FrontstageContent";
import { ModalFrontstageComposer, useActiveModalFrontstageInfo } from "./ModalFrontstageComposer";
import { WidgetPanelsStatusBar } from "./StatusBar";
import { WidgetPanelsToolbars } from "./Toolbars";
import { ToolSettingsContent, WidgetPanelsToolSettings } from "./ToolSettings";
import { LayoutManagerDispatchActionEventArgs } from "./LayoutManager";
import { UiFramework } from "../UiFramework";
import { FrontstageManager } from "../frontstage/FrontstageManager";

// istanbul ignore next
const WidgetPanelsFrontstageComponent = React.memo(function WidgetPanelsFrontstageComponent() { // tslint:disable-line: variable-name no-shadowed-variable
  const activeModalFrontstageInfo = useActiveModalFrontstageInfo();
  return (
    <div
      className="uifw-widgetPanels-frontstage"
    >
      <ModalFrontstageComposer stageInfo={activeModalFrontstageInfo} />
      <WidgetPanels
        className="uifw-widgetPanels"
        centerContent={<WidgetPanelsToolbars />}
      >
        <WidgetPanelsFrontstageContent />
      </WidgetPanels>
      <WidgetPanelsToolSettings />
      <WidgetPanelsStatusBar className="uifw-statusBar" />
      <FloatingWidgets />
    </div>
  );
});

const widgetContent = <WidgetContent />;
const toolSettingsContent = <ToolSettingsContent />;
const widgetPanelsFrontstage = <WidgetPanelsFrontstageComponent />;

/** @internal */
export const WidgetPanelsFrontstage = React.memo(function WidgetPanelsFrontstage() { // tslint:disable-line: variable-name no-shadowed-variable
  const frontstageDef = useActiveFrontstageDef();
  const [state, dispatch] = useFrontstageDefNineZone(frontstageDef);
  useSaveFrontstageSettings(state);
  useLayoutManager(state, dispatch);
  if (!frontstageDef)
    return null;
  return (
    <NineZoneProvider
      dispatch={dispatch}
      state={state.setting.nineZone}
      widgetContent={widgetContent}
      toolSettingsContent={toolSettingsContent}
    >
      {widgetPanelsFrontstage}
    </NineZoneProvider >
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

interface InitializeFrontstageStateArgs {
  frontstage: FrontstageDef | undefined;
}

function isFrontstageStateSettingResult(settingsResult: UiSettingsResult): settingsResult is {
  status: UiSettingsStatus.Success;
  setting: FrontstageStateSetting;
} {
  if (settingsResult.status === UiSettingsStatus.Success)
    return true;
  return false;
}

const stateVersion = 1; // this needs to be bumped when NineZoneState is changed (to recreate layout).

/** @internal */
export function initializeFrontstageState({ frontstage }: InitializeFrontstageStateArgs): FrontstageState {
  let nineZone = createNineZoneState();
  nineZone = addPanelWidgets(nineZone, frontstage, "left");
  nineZone = addPanelWidgets(nineZone, frontstage, "right");
  nineZone = addPanelWidgets(nineZone, frontstage, "top");
  nineZone = addPanelWidgets(nineZone, frontstage, "bottom");
  nineZone = produce(nineZone, (stateDraft) => {
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
  return {
    setting: {
      id: getFrontstageId(frontstage),
      nineZone,
      version: getFrontstageVersion(frontstage),
      stateVersion,
    },
    status: "LOADING",
  };
}

/** @internal */
export function isPanelCollapsed(zoneStates: ReadonlyArray<ZoneState | undefined>, panelStates: ReadonlyArray<StagePanelState | undefined>) {
  const openZone = zoneStates.find((zoneState) => zoneState === ZoneState.Open);
  const openPanel = panelStates.find((panelState) => panelState === StagePanelState.Open);
  return !openZone && !openPanel;
}

/** @internal */
export interface FrontstageInitializeAction {
  readonly type: "FRONTSTAGE_INITIALIZE";
  readonly frontstage: FrontstageDef | undefined;
}

/** @internal */
export interface FrontstageStateSettingLoadAction {
  readonly type: "FRONTSTAGE_STATE_SETTING_LOAD";
  readonly setting: FrontstageStateSetting | undefined;
}

/** @internal */
export interface WidgetTabShowAction {
  readonly type: "WIDGET_TAB_SHOW";
  readonly id: string;
}

/** @internal */
export interface WidgetTabExpandAction {
  readonly type: "WIDGET_TAB_EXPAND";
  readonly id: string;
}

/** @internal */
export type FrontstageActionTypes =
  NineZoneActionTypes |
  FrontstageInitializeAction |
  FrontstageStateSettingLoadAction |
  WidgetTabShowAction |
  WidgetTabExpandAction;

/** @internal */
export interface FrontstageState {
  setting: FrontstageStateSetting;
  status: "LOADING" | "DONE";
}

interface FrontstageStateSetting {
  nineZone: NineZoneState;
  id: FrontstageDef["id"];
  version: number;
  stateVersion: number;
}

/** @internal */
export const FrontstageStateReducer: (state: FrontstageState, action: FrontstageActionTypes) => FrontstageState = produce(( // tslint:disable-line: variable-name
  state: Draft<FrontstageState>,
  action: FrontstageActionTypes,
) => {
  switch (action.type) {
    case "FRONTSTAGE_INITIALIZE": {
      return initializeFrontstageState({ frontstage: action.frontstage });
    }
    case "FRONTSTAGE_STATE_SETTING_LOAD": {
      state.setting = castDraft(action.setting) || state.setting;
      state.status = "DONE";
      return;
    }
    case "WIDGET_TAB_SHOW": {
      const nineZone = state.setting.nineZone;
      const location = findTab(nineZone, action.id);
      if (!location)
        return;
      const widget = nineZone.widgets[location.widgetId];
      if ("side" in location) {
        const panel = nineZone.panels[location.side];
        panel.collapsed = false;
        widget.minimized = false;
        widget.activeTabId = action.id;
        return;
      }
      widget.minimized = false;
      floatingWidgetBringToFront(nineZone, location.floatingWidgetId);
      return;
    }
    case "WIDGET_TAB_EXPAND": {
      const nineZone = state.setting.nineZone;
      const location = findTab(nineZone, action.id);
      if (!location)
        return;
      const widget = nineZone.widgets[location.widgetId];
      if ("side" in location) {
        const panel = nineZone.panels[location.side];
        panel.widgets.forEach((wId) => {
          const w = nineZone.widgets[wId];
          w.minimized = true;
        });
        widget.minimized = false;
        return;
      }
      widget.minimized = false;
      return;
    }
    default: {
      state.setting.nineZone = castDraft(NineZoneStateReducer(state.setting.nineZone, action));
      return;
    }
  }
});

const sides: PanelSide[] = ["bottom", "left", "right", "top"];

type FindTabType = undefined |
{ widgetId: WidgetState["id"], side: PanelSide } |
{ widgetId: WidgetState["id"], floatingWidgetId: FloatingWidgetState["id"] };

/** @internal */
export function findTab(state: Draft<NineZoneState>, id: TabState["id"]): FindTabType {
  let widgetId;
  for (const [, widget] of Object.entries(state.widgets)) {
    const index = widget.tabs.indexOf(id);
    if (index >= 0) {
      widgetId = widget.id;
    }
  }
  if (!widgetId)
    return undefined;
  for (const side of sides) {
    const panel = state.panels[side];
    const index = panel.widgets.indexOf(widgetId);
    if (index >= 0) {
      return {
        widgetId,
        side,
      };
    }
  }
  if (widgetId in state.floatingWidgets.byId) {
    return {
      widgetId,
      floatingWidgetId: widgetId,
    };
  }
  return undefined;
}

/** @internal */
export function useFrontstageDefNineZone(frontstage: FrontstageDef | undefined): [FrontstageState, React.Dispatch<FrontstageActionTypes>] {
  const uiSettings = useUiSettingsContext();
  const uiSettingsRef = React.useRef(uiSettings);
  const [nineZone, dispatch] = React.useReducer(FrontstageStateReducer, { frontstage }, initializeFrontstageState);
  React.useEffect(() => {
    uiSettingsRef.current = uiSettings;
  }, [uiSettings]);
  React.useEffect(() => {
    dispatch({
      type: "FRONTSTAGE_INITIALIZE",
      frontstage,
    });
    async function fetchFrontstageState() {
      const id = getFrontstageId(frontstage);
      const version = getFrontstageVersion(frontstage);
      const settingsResult = await uiSettingsRef.current.getSetting(FRONTSTAGE_SETTINGS_NAMESPACE, getFrontstageStateSettingName(id));
      if (isFrontstageStateSettingResult(settingsResult) &&
        settingsResult.setting.version >= version &&
        settingsResult.setting.stateVersion >= stateVersion
      ) {
        dispatch({
          type: "FRONTSTAGE_STATE_SETTING_LOAD",
          setting: settingsResult.setting,
        });
        return;
      }
      dispatch({
        type: "FRONTSTAGE_STATE_SETTING_LOAD",
        setting: undefined,
      });
    }
    fetchFrontstageState(); // tslint:disable-line: no-floating-promises
  }, [frontstage]);
  // TODO: subscribe to WidgetDef state change api and use dispatch to sync the states OR re-initialize
  return [nineZone, dispatch];
}

/** @internal */
// istanbul ignore next
export function useSaveFrontstageSettings(frontstageState: FrontstageState) {
  const uiSettings = useUiSettingsContext();
  const saveSetting = React.useCallback(debounce(async (state: FrontstageState) => {
    await uiSettings.saveSetting(FRONTSTAGE_SETTINGS_NAMESPACE, getFrontstageStateSettingName(state.setting.id), state.setting);
  }, 1000), [uiSettings]);
  React.useEffect(() => {
    return () => {
      saveSetting.cancel();
    };
  }, [saveSetting]);
  React.useEffect(() => {
    if (frontstageState.setting.nineZone.draggedTab || frontstageState.status === "LOADING")
      return;
    saveSetting(frontstageState);
  }, [frontstageState, saveSetting]);
}

const FRONTSTAGE_SETTINGS_NAMESPACE = "uifw-frontstageSettings";

function getFrontstageStateSettingName(frontstageId: FrontstageStateSetting["id"]) {
  return `frontstageState[${frontstageId}]`;
}

// istanbul ignore next
function debounce<T extends (...args: any[]) => any>(func: T, duration: number) {
  let timeout: number | undefined;
  const debounced = (...args: Parameters<T>) => {
    const handler = () => {
      timeout = undefined;
      return func(...args);
    };
    window.clearTimeout(timeout);
    timeout = window.setTimeout(handler, duration);
  };
  debounced.cancel = () => {
    window.clearTimeout(timeout);
  };
  return debounced;
}

function getFrontstageId(frontstage: FrontstageDef | undefined) {
  return frontstage ? frontstage.id : "";
}

function getFrontstageVersion(frontstage: FrontstageDef | undefined) {
  return frontstage ? frontstage.version : 0;
}

/** @internal */
export function useLayoutManager(state: FrontstageState, dispatch: React.Dispatch<FrontstageActionTypes>) {
  const uiSettings = useUiSettingsContext();
  React.useEffect(() => {
    const listener = (args: LayoutManagerDispatchActionEventArgs) => {
      switch (args.type) {
        case "show": {
          dispatch({
            type: "WIDGET_TAB_SHOW",
            id: args.widgetId,
          });
          break;
        }
        case "expand": {
          dispatch({
            type: "WIDGET_TAB_EXPAND",
            id: args.widgetId,
          });
          break;
        }
        case "restore": {
          // TODO: track restoring frontstages to support workflows:  i.e. prevent loading frontstage OR saving layout when delete is pending
          uiSettings.deleteSetting(FRONTSTAGE_SETTINGS_NAMESPACE, getFrontstageStateSettingName(args.frontstageId)); // tslint:disable-line: no-floating-promises
          if (state.setting.id === args.frontstageId) {
            const frontstage = FrontstageManager.findFrontstageDef(args.frontstageId);
            dispatch({
              type: "FRONTSTAGE_INITIALIZE",
              frontstage,
            });
            dispatch({
              type: "FRONTSTAGE_STATE_SETTING_LOAD",
              setting: undefined,
            });
          }
        }
      }
    };
    UiFramework.layoutManager.onLayoutManagerDispatchActionEvent.addListener(listener);
    return () => {
      UiFramework.layoutManager.onLayoutManagerDispatchActionEvent.removeListener(listener);
    };
  }, [dispatch, uiSettings, state]);
}
