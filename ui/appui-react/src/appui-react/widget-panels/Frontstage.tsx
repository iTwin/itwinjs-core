/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */

/** @packageDocumentation
 * @module Frontstage
 */

// cSpell:ignore popout

import "./Frontstage.scss";
import produce, { castDraft, Draft } from "immer";
import * as React from "react";
import { assert, Logger, ProcessDetector } from "@itwin/core-bentley";
import { StagePanelLocation, UiItemsManager, WidgetState } from "@itwin/appui-abstract";
import { Size, SizeProps, UiStateStorageResult, UiStateStorageStatus } from "@itwin/core-react";
import { ToolbarPopupAutoHideContext } from "@itwin/components-react";
import {
  addPanelWidget, addTab, addWidgetTabToFloatingPanel, convertAllPopupWidgetContainersToFloating, createNineZoneState, createTabsState, createTabState,
  createWidgetState, findTab, findWidget, floatingWidgetBringToFront, FloatingWidgetHomeState, FloatingWidgets, getUniqueId, isFloatingLocation,
  isHorizontalPanelSide, NineZone, NineZoneActionTypes, NineZoneDispatch, NineZoneLabels, NineZoneState,
  NineZoneStateReducer, PanelSide, panelSides, PanelState, removeTab, TabState, toolSettingsTabId, WidgetPanels,
} from "@itwin/appui-layout-react";
import { useActiveFrontstageDef } from "../frontstage/Frontstage";
import { FrontstageDef, FrontstageEventArgs, FrontstageNineZoneStateChangedEventArgs } from "../frontstage/FrontstageDef";
import { FrontstageManager } from "../frontstage/FrontstageManager";
import { StagePanelMaxSizeSpec } from "../stagepanels/StagePanel";
import { StagePanelState, StagePanelZoneDefKeys } from "../stagepanels/StagePanelDef";
import { UiFramework } from "../UiFramework";
import { useUiStateStorageHandler } from "../uistate/useUiStateStorage";
import { WidgetDef, WidgetEventArgs, WidgetStateChangedEventArgs } from "../widgets/WidgetDef";
import { ZoneState } from "../zones/ZoneDef";
import { WidgetContent } from "./Content";
import { WidgetPanelsFrontstageContent } from "./FrontstageContent";
import { ModalFrontstageComposer, useActiveModalFrontstageInfo } from "./ModalFrontstageComposer";
import { WidgetPanelsStatusBar } from "./StatusBar";
import { WidgetPanelsTab } from "./Tab";
import { WidgetPanelsToolbars } from "./Toolbars";
import { ToolSettingsContent, WidgetPanelsToolSettings } from "./ToolSettings";
import { useEscapeSetFocusToHome } from "../hooks/useEscapeSetFocusToHome";
import { FrameworkRootState } from "../redux/StateManager";
import { useSelector } from "react-redux";
import { useUiVisibility } from "../hooks/useUiVisibility";

const panelZoneKeys: StagePanelZoneDefKeys[] = ["start", "middle", "end"];

// istanbul ignore next
const WidgetPanelsFrontstageComponent = React.memo(function WidgetPanelsFrontstageComponent() { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const activeModalFrontstageInfo = useActiveModalFrontstageInfo();
  const uiIsVisible = useUiVisibility();

  return (
    <>
      <ToolbarPopupAutoHideContext.Provider value={!uiIsVisible}>
        <ModalFrontstageComposer stageInfo={activeModalFrontstageInfo} />
        <WidgetPanelsToolSettings />
        <WidgetPanels
          className="uifw-widgetPanels"
          centerContent={<WidgetPanelsToolbars />}
        >
          <WidgetPanelsFrontstageContent />
        </WidgetPanels>
        <WidgetPanelsStatusBar />
        <FloatingWidgets />
      </ToolbarPopupAutoHideContext.Provider>
    </>
  );
});

const widgetContent = <WidgetContent />;
const toolSettingsContent = <ToolSettingsContent />;
const widgetPanelsFrontstage = <WidgetPanelsFrontstageComponent />;

/** @internal */
export function useNineZoneState(frontstageDef: FrontstageDef) {
  const lastFrontstageDef = React.useRef(frontstageDef);
  const [nineZone, setNineZone] = React.useState(frontstageDef.nineZoneState);
  React.useEffect(() => {
    setNineZone(frontstageDef.nineZoneState);
    lastFrontstageDef.current = frontstageDef;
  }, [frontstageDef]);
  React.useEffect(() => {
    const listener = (args: FrontstageNineZoneStateChangedEventArgs) => {
      if (args.frontstageDef !== frontstageDef || frontstageDef.isStageClosing || frontstageDef.isApplicationClosing)
        return;
      setNineZone(args.state);
    };
    return FrontstageManager.onFrontstageNineZoneStateChangedEvent.addListener(listener);
  }, [frontstageDef]);
  return lastFrontstageDef.current === frontstageDef ? nineZone : frontstageDef.nineZoneState;
}

/** @returns Defined NineZoneState with fallback to last defined and default NineZoneState.
 * @internal
 */
function useCachedNineZoneState(nineZone: NineZoneState | undefined): NineZoneState {
  const cached = React.useRef<NineZoneState>(nineZone || defaultNineZone);
  React.useEffect(() => {
    if (nineZone)
      cached.current = nineZone;
  }, [nineZone]);
  return nineZone || cached.current;
}

/** Update in-memory NineZoneState of newly activated frontstage with up to date size.
 * @internal
 */
export function useUpdateNineZoneSize(frontstageDef: FrontstageDef) {
  React.useEffect(() => {
    const size = FrontstageManager.nineZoneSize;
    let state = frontstageDef.nineZoneState;
    if (!size || !state)
      return;
    state = FrameworkStateReducer(state, {
      type: "RESIZE",
      size: {
        height: size.height,
        width: size.width,
      },
    }, frontstageDef);
    frontstageDef.nineZoneState = state;
  }, [frontstageDef]);
}

function FrameworkStateReducer(state: NineZoneState, action: NineZoneActionTypes, frontstageDef: FrontstageDef) {
  state = NineZoneStateReducer(state, action);
  if (action.type === "RESIZE") {
    state = produce(state, (draft) => {
      for (const panelSide of panelSides) {
        const panel = draft.panels[panelSide];
        const location = toStagePanelLocation(panelSide);
        const panelDef = frontstageDef.getStagePanelDef(location);
        if (panelDef?.maxSizeSpec) {
          panel.maxSize = getPanelMaxSize(panelDef.maxSizeSpec, panelSide, action.size);
          if (panel.size) {
            panel.size = Math.min(Math.max(panel.size, panel.minSize), panel.maxSize);
          }
        }
      }
    });
  }
  return state;
}

/** @internal */
export function useNineZoneDispatch(frontstageDef: FrontstageDef) {
  const dispatch = React.useCallback<NineZoneDispatch>((action) => {
    if (action.type === "RESIZE") {
      FrontstageManager.nineZoneSize = Size.create(action.size);
    }
    // istanbul ignore if
    if (action.type === "TOOL_SETTINGS_DRAG_START") {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      UiFramework.postTelemetry("Tool Settings Undocking", "28B04E07-AE73-4533-A0BA-8E2A8DC99ADF");
    }
    // istanbul ignore if
    if (action.type === "TOOL_SETTINGS_DOCK") {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      UiFramework.postTelemetry("Tool Settings Docking to Settings Bar", "BEDE684B-B3DB-4637-B3AF-DC3CBA223F94");
    }
    if (action.type === "WIDGET_TAB_POPOUT") {
      const tabId = action.id;
      frontstageDef.popoutWidget(tabId);
      return;
    }
    if (action.type === "FLOATING_WIDGET_SET_BOUNDS") {
      frontstageDef.setFloatingWidgetBoundsInternal(action.id, action.bounds, true);
      return;
    }
    const nineZoneState = frontstageDef.nineZoneState;
    if (!nineZoneState)
      return;
    frontstageDef.nineZoneState = FrameworkStateReducer(nineZoneState, action, frontstageDef);
  }, [frontstageDef]);
  return dispatch;
}

/** @internal */
export const WidgetPanelsFrontstage = React.memo(function WidgetPanelsFrontstage() { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const frontstageDef = useActiveFrontstageDef();

  React.useEffect(() => {
    const triggerWidowCloseProcessing = () => {
      frontstageDef && frontstageDef.setIsApplicationClosing(true);
    };

    frontstageDef && frontstageDef.setIsApplicationClosing(false);

    window.addEventListener("beforeunload", triggerWidowCloseProcessing);
    return () => {
      window.removeEventListener("beforeunload", triggerWidowCloseProcessing);
    };
  }, [frontstageDef]);

  if (!frontstageDef)
    return null;
  return (
    <ActiveFrontstageDefProvider frontstageDef={frontstageDef} />
  );
});

const defaultNineZone = createNineZoneState();
const tabElement = <WidgetPanelsTab />;

/** @internal */
export function ActiveFrontstageDefProvider({ frontstageDef }: { frontstageDef: FrontstageDef }) {
  let nineZone = useNineZoneState(frontstageDef);
  nineZone = useCachedNineZoneState(nineZone);
  const dispatch = useNineZoneDispatch(frontstageDef);
  useUpdateNineZoneSize(frontstageDef);
  useSavedFrontstageState(frontstageDef);
  useSaveFrontstageSettings(frontstageDef);
  useFrontstageManager(frontstageDef);
  useItemsManager(frontstageDef);
  const labels = useLabels();
  const showWidgetIcon = useSelector((state: FrameworkRootState) => {
    const frameworkState = (state as any)[UiFramework.frameworkStateKey];
    return !!frameworkState.configurableUiState.showWidgetIcon;
  });

  const handleKeyDown = useEscapeSetFocusToHome();
  return (
    <div
      className="uifw-widgetPanels-frontstage"
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <NineZone
        dispatch={dispatch}
        labels={labels}
        state={nineZone}
        tab={tabElement}
        showWidgetIcon={showWidgetIcon}
        toolSettingsContent={toolSettingsContent}
        widgetContent={widgetContent}
      >
        {widgetPanelsFrontstage}
      </NineZone>
    </div>
  );
}

/** @internal */
export function useLabels() {
  return React.useMemo<NineZoneLabels>(() => ({
    dockToolSettingsTitle: UiFramework.translate("widget.tooltips.dockToolSettings"),
    moreWidgetsTitle: UiFramework.translate("widget.tooltips.moreWidgets"),
    moreToolSettingsTitle: UiFramework.translate("widget.tooltips.moreToolSettings"),
    pinPanelTitle: UiFramework.translate("widget.tooltips.pinPanel"),
    resizeGripTitle: UiFramework.translate("widget.tooltips.resizeGrip"),
    sendWidgetHomeTitle: UiFramework.translate("widget.tooltips.sendHome"),
    toolSettingsHandleTitle: UiFramework.translate("widget.tooltips.toolSettingsHandle"),
    unpinPanelTitle: UiFramework.translate("widget.tooltips.unpinPanel"),
    popoutActiveTab: UiFramework.translate("widget.tooltips.popoutActiveTab"),
  }), []);
}

/** @internal */
export function addWidgets(state: NineZoneState, widgets: ReadonlyArray<WidgetDef>, side: PanelSide, widgetId: WidgetIdTypes): NineZoneState {
  const visibleWidgets = widgets.filter((w) => w.isVisible && (w.defaultState !== WidgetState.Floating));
  if (visibleWidgets.length === 0)
    return state;

  const tabs = new Array<string>();
  for (const widget of visibleWidgets) {
    const label = getWidgetLabel(widget.label);
    state = addTab(state, widget.id, {
      label,
      iconSpec: widget.iconSpec,
      preferredPanelWidgetSize: widget.preferredPanelSize,
      canPopout: widget.canPopout,
      isFloatingStateWindowResizable: widget.isFloatingStateWindowResizable,
    });
    tabs.push(widget.id);
  }

  const activeWidget = visibleWidgets.find((widget) => widget.isActive);
  const minimized = !activeWidget;
  // istanbul ignore else
  if (activeWidget?.defaultState !== WidgetState.Floating) {
    state = addPanelWidget(state, side, widgetId, tabs, {
      activeTabId: activeWidget ? activeWidget.id : tabs[0],
      minimized,
    });
  }

  return state;
}

/** @internal */
// istanbul ignore next
export function appendWidgets(state: NineZoneState, widgetDefs: ReadonlyArray<WidgetDef>, side: PanelSide, preferredWidgetIndex: number): NineZoneState {
  if (widgetDefs.length === 0)
    return state;

  // Add new tabs.
  const tabs = new Array<string>();
  for (const widgetDef of widgetDefs) {
    const label = getWidgetLabel(widgetDef.label);
    const saveTab = state.tabs[widgetDef.id];
    const preferredPanelWidgetSize = saveTab ? saveTab.preferredPanelWidgetSize : widgetDef.preferredPanelSize;
    const preferredFloatingWidgetSize = saveTab ? saveTab.preferredFloatingWidgetSize : undefined;
    const preferredPopoutWidgetSize = saveTab ? saveTab.preferredPopoutWidgetSize : undefined;
    const userSized = saveTab ? saveTab.userSized : undefined;
    state = addTab(state, widgetDef.id, {
      label,
      iconSpec: widgetDef.iconSpec,
      canPopout: widgetDef.canPopout,
      preferredPanelWidgetSize,
      preferredFloatingWidgetSize,
      preferredPopoutWidgetSize,
      userSized,
      isFloatingStateWindowResizable: widgetDef.isFloatingStateWindowResizable,
    });
    if (widgetDef.isFloatingStateSupported && widgetDef.defaultState === WidgetState.Floating) {
      const floatingContainerId = widgetDef.floatingContainerId ?? getUniqueId();
      const widgetContainerId = getWidgetId(side, panelZoneKeys[preferredWidgetIndex]);
      const homePanelInfo: FloatingWidgetHomeState = { side, widgetId: widgetContainerId, widgetIndex: 0 };
      const preferredPosition = widgetDef.defaultFloatingPosition;
      state = addWidgetTabToFloatingPanel(state, floatingContainerId, widgetDef.id, homePanelInfo, preferredFloatingWidgetSize, preferredPosition, userSized, widgetDef.isFloatingStateWindowResizable);
    } else {
      tabs.push(widgetDef.id);
    }
  }

  if (tabs.length) {
    const panel = state.panels[side];
    preferredWidgetIndex = preferredWidgetIndex >= panel.maxWidgetCount ? panel.maxWidgetCount - 1 : preferredWidgetIndex;

    if (preferredWidgetIndex < panel.widgets.length) {
      // Append tabs to existing widget.
      const widgetId = panel.widgets[preferredWidgetIndex];
      state = produce(state, (draft) => {
        const widget = draft.widgets[widgetId];
        for (const tab of tabs) {
          widget.tabs.push(tab);
        }
      });
    } else {
      const newWidgetId = getNextAvailablePanelWidgetId(panel);
      const widget = createWidgetState(newWidgetId, tabs);
      state = produce(state, (draft) => {
        draft.panels[side].widgets.push(widget.id);
        draft.widgets[widget.id] = castDraft(widget);
      });
    }
  }

  return state;
}

function processPopoutWidgets(initialState: NineZoneState, frontstageDef: FrontstageDef): NineZoneState {
  // istanbul ignore next
  if (!initialState.popoutWidgets)
    return initialState;

  // istanbul ignore next - not unit testing electron case that reopens popout windows
  if (initialState.popoutWidgets && ProcessDetector.isElectronAppFrontend) {
    if (initialState.popoutWidgets.allIds.length && ProcessDetector.isElectronAppFrontend) {
      for (const widgetContainerId of initialState.popoutWidgets.allIds) {
        frontstageDef.openPopoutWidgetContainer(initialState, widgetContainerId);
      }
    }
    return initialState;
  }

  return convertAllPopupWidgetContainersToFloating(initialState);
}

/** Adds frontstageDef widgets that are missing in NineZoneState.
 * @internal
 */
export function addMissingWidgets(frontstageDef: FrontstageDef, initialState: NineZoneState): NineZoneState {
  let state = initialState;

  state = appendWidgets(state, determineNewWidgets(frontstageDef.centerLeft?.widgetDefs, initialState), "left", 0);
  state = appendWidgets(state, determineNewWidgets(frontstageDef.leftPanel?.panelZones.start.widgetDefs, initialState), "left", 0);
  state = appendWidgets(state, determineNewWidgets(frontstageDef.bottomLeft?.widgetDefs, initialState), "left", 1);
  state = appendWidgets(state, determineNewWidgets(frontstageDef.leftPanel?.panelZones.middle.widgetDefs, initialState), "left", 1);
  state = appendWidgets(state, determineNewWidgets(frontstageDef.leftPanel?.panelWidgetDefs, initialState), "left", 2);
  state = appendWidgets(state, determineNewWidgets(frontstageDef.leftPanel?.panelZones.end.widgetDefs, initialState), "left", 2);

  state = appendWidgets(state, determineNewWidgets(frontstageDef.centerRight?.widgetDefs, initialState), "right", 0);
  state = appendWidgets(state, determineNewWidgets(frontstageDef.rightPanel?.panelZones.start.widgetDefs, initialState), "right", 0);
  state = appendWidgets(state, determineNewWidgets(frontstageDef.bottomRight?.widgetDefs, initialState), "right", 1);
  state = appendWidgets(state, determineNewWidgets(frontstageDef.rightPanel?.panelZones.middle.widgetDefs, initialState), "right", 1);
  state = appendWidgets(state, determineNewWidgets(frontstageDef.rightPanel?.panelWidgetDefs, initialState), "right", 2);
  state = appendWidgets(state, determineNewWidgets(frontstageDef.rightPanel?.panelZones.end.widgetDefs, initialState), "right", 2);

  state = appendWidgets(state, determineNewWidgets(frontstageDef.topPanel?.panelWidgetDefs, initialState), "top", 0);
  state = appendWidgets(state, determineNewWidgets(frontstageDef.topPanel?.panelZones.start.widgetDefs, initialState), "top", 0);
  state = appendWidgets(state, determineNewWidgets(frontstageDef.topMostPanel?.panelWidgetDefs, initialState), "top", 1); // eslint-disable-line deprecation/deprecation
  state = appendWidgets(state, determineNewWidgets(frontstageDef.topPanel?.panelZones.end.widgetDefs, initialState), "top", 1);

  state = appendWidgets(state, determineNewWidgets(frontstageDef.bottomPanel?.panelWidgetDefs, initialState), "bottom", 0);
  state = appendWidgets(state, determineNewWidgets(frontstageDef.bottomPanel?.panelZones.start.widgetDefs, initialState), "bottom", 0);
  state = appendWidgets(state, determineNewWidgets(frontstageDef.bottomMostPanel?.panelWidgetDefs, initialState), "bottom", 1); // eslint-disable-line deprecation/deprecation
  state = appendWidgets(state, determineNewWidgets(frontstageDef.bottomPanel?.panelZones.end.widgetDefs, initialState), "bottom", 1);

  return state;
}

/** Removes widgets with Hidden defaultState. */
function removeHiddenWidgets(state: NineZoneState, frontstageDef: FrontstageDef): NineZoneState {
  const tabs = Object.values(state.tabs);
  for (const tab of tabs) {
    const widgetDef = frontstageDef.findWidgetDef(tab.id);
    if (!widgetDef)
      continue;

    if (widgetDef.defaultState === WidgetState.Hidden) {
      state = produce(state, (draft) => {
        hideWidget(draft, widgetDef);
      });
    }
  }

  return state;
}

/** Removes NineZoneState widgets that are missing in frontstageDef.
 * @internal
 */
export function removeMissingWidgets(frontstageDef: FrontstageDef, initialState: NineZoneState): NineZoneState {
  const state = produce(initialState, (draft) => {
    for (const [, tab] of Object.entries(draft.tabs)) {
      if (tab.id === toolSettingsTabId)
        continue;
      const widgetDef = frontstageDef.findWidgetDef(tab.id);
      if (widgetDef)
        continue;
      removeTab(draft, tab.id);
    }
  });
  return state;
}

function getWidgetLabel(label: string) {
  return label === "" ? "Widget" : label;
}

type WidgetIdTypes =
  "leftStart" |
  "leftMiddle" |
  "leftEnd" |
  "rightStart" |
  "rightMiddle" |
  "rightEnd" |
  "topStart" |
  "topEnd" |
  "bottomStart" |
  "bottomEnd";

function toStagePanelLocation(side: PanelSide): StagePanelLocation {
  switch (side) {
    case "bottom":
      return StagePanelLocation.Bottom;
    case "left":
      return StagePanelLocation.Left;
    case "right":
      return StagePanelLocation.Right;
    case "top":
      return StagePanelLocation.Top;
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
      if (key === "start") {
        return "topStart";
      }
      return "topEnd";
    }
    case "bottom": {
      if (key === "start")
        return "bottomStart";
      return "bottomEnd";
    }
  }
}

/** @internal */
function getNextAvailablePanelWidgetId(panel: PanelState) {
  const index = panel.widgets.length;
  return getWidgetId(panel.side, panelZoneKeys[index]);
}

function isVerticalPanelSide(side: PanelSide) { return !isHorizontalPanelSide(side); }

/** @internal */
export function getPanelZoneWidgets(frontstageDef: FrontstageDef, panelZone: WidgetIdTypes): WidgetDef[] {
  switch (panelZone) {
    case "leftStart": {
      return [
        ...frontstageDef.centerLeft?.widgetDefs || [],
        ...frontstageDef.leftPanel?.panelZones.start.widgetDefs || [],
      ];
    }
    case "leftMiddle": {
      return [
        ...frontstageDef.bottomLeft?.widgetDefs || [],
        ...frontstageDef.leftPanel?.panelZones.middle.widgetDefs || [],
      ];
    }
    case "leftEnd": {
      return [
        ...frontstageDef.leftPanel?.panelWidgetDefs || [],
        ...frontstageDef.leftPanel?.panelZones.end.widgetDefs || [],
      ];
    }
    case "rightStart": {
      return [
        ...frontstageDef.centerRight?.widgetDefs || [],
        ...frontstageDef.rightPanel?.panelZones.start.widgetDefs || [],
      ];
    }
    case "rightMiddle": {
      return [
        ...frontstageDef.bottomRight?.widgetDefs || [],
        ...frontstageDef.rightPanel?.panelZones.middle.widgetDefs || [],
      ];
    }
    case "rightEnd": {
      return [
        ...frontstageDef.rightPanel?.panelWidgetDefs || [],
        ...frontstageDef.rightPanel?.panelZones.end.widgetDefs || [],
      ];
    }
    case "topStart": {
      return [
        ...frontstageDef.topPanel?.panelWidgetDefs || [],
        ...frontstageDef.topPanel?.panelZones.start.widgetDefs || [],
      ];
    }
    case "topEnd": {
      return [
        ...frontstageDef.topMostPanel?.panelWidgetDefs || [], // eslint-disable-line deprecation/deprecation
        ...frontstageDef.topPanel?.panelZones.end.widgetDefs || [],
      ];
    }
    case "bottomStart": {
      return [
        ...frontstageDef.bottomPanel?.panelWidgetDefs || [],
        ...frontstageDef.bottomPanel?.panelZones.start.widgetDefs || [],
      ];
    }
    case "bottomEnd": {
      return [
        ...frontstageDef.bottomMostPanel?.panelWidgetDefs || [], // eslint-disable-line deprecation/deprecation
        ...frontstageDef.bottomPanel?.panelZones.end.widgetDefs || [],
      ];
    }
  }
}

/** @internal */
export function addPanelWidgets(
  state: NineZoneState,
  frontstageDef: FrontstageDef,
  side: PanelSide,
): NineZoneState {
  const start = getWidgetId(side, "start");
  const startWidgets = getPanelZoneWidgets(frontstageDef, start);
  state = addWidgets(state, startWidgets, side, start);

  if (isVerticalPanelSide(side)) {
    const middle = getWidgetId(side, "middle");
    const middleWidgets = getPanelZoneWidgets(frontstageDef, middle);
    state = addWidgets(state, middleWidgets, side, middle);
  }

  const end = getWidgetId(side, "end");
  const endWidgets = getPanelZoneWidgets(frontstageDef, end);
  state = addWidgets(state, endWidgets, side, end);
  return state;
}

/** @internal */
export function isFrontstageStateSettingResult(settingsResult: UiStateStorageResult): settingsResult is { // eslint-disable-line deprecation/deprecation
  status: UiStateStorageStatus.Success;
  setting: WidgetPanelsFrontstageState;
} {
  if (settingsResult.status === UiStateStorageStatus.Success)
    return true;
  return false;
}

/** @internal */
export function initializePanel(nineZone: NineZoneState, frontstageDef: FrontstageDef, panelSide: PanelSide) {
  nineZone = addPanelWidgets(nineZone, frontstageDef, panelSide);
  const location = toStagePanelLocation(panelSide);
  const panelDef = frontstageDef.getStagePanelDef(location);
  nineZone = produce(nineZone, (draft) => {
    const panel = draft.panels[panelSide];
    panel.minSize = panelDef?.minSize ?? panel.minSize;
    panel.pinned = panelDef?.pinned ?? panel.pinned;
    panel.resizable = panelDef?.resizable ?? panel.resizable;
    if (panelDef?.maxSizeSpec) {
      panel.maxSize = getPanelMaxSize(panelDef.maxSizeSpec, panelSide, nineZone.size);
    }

    const size = panelDef?.size;
    panel.size = size === undefined ? size : Math.min(Math.max(size, panel.minSize), panel.maxSize);
  });
  return nineZone;
}

function getPanelMaxSize(maxSizeSpec: StagePanelMaxSizeSpec, panel: PanelSide, nineZoneSize: SizeProps) {
  if (typeof maxSizeSpec === "number") {
    return maxSizeSpec;
  }
  const size = isHorizontalPanelSide(panel) ? nineZoneSize.height : nineZoneSize.width;
  return maxSizeSpec.percentage / 100 * size;
}

const stateVersion = 11; // this needs to be bumped when NineZoneState is changed (to recreate layout).

/** @internal */
export function initializeNineZoneState(frontstageDef: FrontstageDef): NineZoneState {
  let nineZone = defaultNineZone;
  nineZone = produce(nineZone, (stateDraft) => {
    // istanbul ignore next
    if (!FrontstageManager.nineZoneSize)
      return;
    stateDraft.size = {
      height: FrontstageManager.nineZoneSize.height,
      width: FrontstageManager.nineZoneSize.width,
    };
  });

  nineZone = initializePanel(nineZone, frontstageDef, "left");
  nineZone = initializePanel(nineZone, frontstageDef, "right");
  nineZone = initializePanel(nineZone, frontstageDef, "top");
  nineZone = initializePanel(nineZone, frontstageDef, "bottom");
  nineZone = produce(nineZone, (stateDraft) => {
    for (const [, panel] of Object.entries(stateDraft.panels)) {
      const expanded = panel.widgets.find((widgetId) => stateDraft.widgets[widgetId].minimized === false);
      const firstWidget = panel.widgets.length > 0 ? stateDraft.widgets[panel.widgets[0]] : undefined;
      if (!expanded && firstWidget) {
        firstWidget.minimized = false;
      }
    }
    stateDraft.panels.left.collapsed = isPanelCollapsed([
      frontstageDef.centerLeft?.zoneState,
      frontstageDef.bottomLeft?.zoneState,
    ], [frontstageDef.leftPanel?.panelState]);
    stateDraft.panels.right.collapsed = isPanelCollapsed([
      frontstageDef.centerRight?.zoneState,
      frontstageDef.bottomRight?.zoneState,
    ], [frontstageDef.rightPanel?.panelState]);
    stateDraft.panels.top.collapsed = isPanelCollapsed([], [
      // istanbul ignore next - ignore topMostPanel if topPanel is defined
      frontstageDef.topPanel ? frontstageDef.topPanel?.panelState : frontstageDef.topMostPanel?.panelState,// eslint-disable-line deprecation/deprecation
    ]);
    stateDraft.panels.bottom.collapsed = isPanelCollapsed([], [
      // istanbul ignore next - ignore bottomMostPanel if bottomPanel is defined
      frontstageDef.bottomPanel ? frontstageDef.bottomPanel?.panelState : frontstageDef.bottomMostPanel?.panelState, // eslint-disable-line deprecation/deprecation
    ]);

    const topCenterDef = frontstageDef.topCenter;
    const toolSettingsWidgetDef = topCenterDef?.getSingleWidgetDef();
    if (toolSettingsWidgetDef) {
      const toolSettingsTab = stateDraft.tabs[toolSettingsTabId];
      toolSettingsTab.preferredPanelWidgetSize = toolSettingsWidgetDef.preferredPanelSize;
    }
  });
  nineZone = addMissingWidgets(frontstageDef, nineZone);
  nineZone = removeHiddenWidgets(nineZone, frontstageDef);
  nineZone = processPopoutWidgets(nineZone, frontstageDef);

  return nineZone;
}

/** Converts from saved NineZoneState to NineZoneState.
 * @note Restores toolSettings tab.
 * @note Restores tab labels.
 * @internal
 */
export function restoreNineZoneState(frontstageDef: FrontstageDef, saved: SavedNineZoneState): NineZoneState {
  let restored: NineZoneState = {
    ...saved,
    tabs: createTabsState(),
  };
  restored = produce(restored, (draft) => {
    for (const [, tab] of Object.entries(saved.tabs)) {
      const widgetDef = frontstageDef.findWidgetDef(tab.id);
      if (!widgetDef) {
        Logger.logInfo(UiFramework.loggerCategory(restoreNineZoneState), "WidgetDef is not found for saved tab.", () => ({
          frontstageId: frontstageDef.id,
          tabId: tab.id,
        }));
        removeTab(draft, tab.id);
        // let fall through so we preserve preferred sizes of widgets load via UiItemsProvider
      }
      draft.tabs[tab.id] = {
        ...tab,
        label: getWidgetLabel(widgetDef?.label ?? "undefined"),
        iconSpec: widgetDef?.iconSpec,
        canPopout: widgetDef?.canPopout,
        isFloatingStateWindowResizable: widgetDef?.isFloatingStateWindowResizable,
      };
    }
    return;
  });
  if (FrontstageManager.nineZoneSize && (0 !== FrontstageManager.nineZoneSize.height || 0 !== FrontstageManager.nineZoneSize.width)) {
    restored = FrameworkStateReducer(restored, {
      type: "RESIZE",
      size: {
        height: FrontstageManager.nineZoneSize.height,
        width: FrontstageManager.nineZoneSize.width,
      },
    }, frontstageDef);
  }
  return restored;
}

/** Prepares NineZoneState to be saved.
 * @note Removes toolSettings tab.
 * @note Removes tab labels and iconSpec.
 * @internal
 */
export function packNineZoneState(state: NineZoneState): SavedNineZoneState {
  let packed: SavedNineZoneState = {
    ...state,
    tabs: {},
  };
  packed = produce(packed, (draft) => {
    for (const [, tab] of Object.entries(state.tabs)) {
      if (tab.id === toolSettingsTabId)
        continue;
      draft.tabs[tab.id] = {
        id: tab.id,
        preferredFloatingWidgetSize: tab.preferredFloatingWidgetSize,
        preferredPopoutWidgetSize: tab.preferredPopoutWidgetSize,
        allowedPanelTargets: tab.allowedPanelTargets,
        userSized: tab.userSized,
      };
    }
  });
  return packed;
}

/** @internal */
export function isPanelCollapsed(zoneStates: ReadonlyArray<ZoneState | undefined>, panelStates: ReadonlyArray<StagePanelState | undefined>) {
  const openZone = zoneStates.find((zoneState) => zoneState === ZoneState.Open);
  const openPanel = panelStates.find((panelState) => panelState === StagePanelState.Open);
  return !openZone && !openPanel;
}

/** FrontstageState is saved in UiStateStorage.
 * @internal
 */
export interface WidgetPanelsFrontstageState {
  nineZone: SavedNineZoneState;
  id: FrontstageDef["id"];
  version: number;
  stateVersion: number;
}

// We don't save tab labels or if widget is allowed to "pop-out".
type SavedTabState = Omit<TabState, "label" | "canPopout" | "isFloatingStateWindowResizable" | "iconSpec">;

interface SavedTabsState {
  readonly [id: string]: SavedTabState;
}

// // We don't save if widget is allowed to "pop-out" or if floating widget can be resized.
// type SavedWidgetState = Omit<WidgetState, | "canPopout" | "isFloatingStateWindowResizable">;
//
// interface SavedWidgetsState {
//   readonly [id: string]: SavedWidgetState;
// }

interface SavedNineZoneState extends Omit<NineZoneState, "tabs"> {
  readonly tabs: SavedTabsState;
  //  readonly widgets: SavedWidgetsState;
}

function addRemovedTab(nineZone: Draft<NineZoneState>, widgetDef: WidgetDef) {
  const newTab = createTabState(widgetDef.id, {
    label: getWidgetLabel(widgetDef.label),
    canPopout: widgetDef.canPopout,
    preferredPanelWidgetSize: widgetDef.preferredPanelSize,
    isFloatingStateWindowResizable: widgetDef.isFloatingStateWindowResizable,
  });
  nineZone.tabs[newTab.id] = newTab;
  if (widgetDef.tabLocation.widgetId in nineZone.widgets) {
    // Add to existing widget (by widget id).
    const widgetId = widgetDef.tabLocation.widgetId;
    const newTabWidget = nineZone.widgets[widgetId];
    newTabWidget.tabs.splice(widgetDef.tabLocation.tabIndex, 0, newTab.id);
  } else {
    const newTabPanel = nineZone.panels[widgetDef.tabLocation.side];
    if (newTabPanel.maxWidgetCount === newTabPanel.widgets.length) {
      // Add to existing panel widget.
      const widgetIndex = Math.min(newTabPanel.maxWidgetCount - 1, widgetDef.tabLocation.widgetIndex);
      const newTabWidgetId = newTabPanel.widgets[widgetIndex];
      const newTabWidget = nineZone.widgets[newTabWidgetId];
      newTabWidget.tabs.splice(widgetDef.tabLocation.tabIndex, 0, newTab.id);
    } else {
      // Create a new panel widget.
      const newWidget = createWidgetState(getUniqueId(), [newTab.id]);
      nineZone.widgets[newWidget.id] = castDraft(newWidget);
      newTabPanel.widgets.splice(widgetDef.tabLocation.widgetIndex, 0, newWidget.id);
    }
  }
}

/** @internal */
export const setWidgetState = produce((
  nineZone: Draft<NineZoneState>,
  widgetDef: WidgetDef,
  state: WidgetState,
) => {
  if (state === WidgetState.Open) {
    const id = widgetDef.id;
    let location = findTab(nineZone, id);
    if (!location) {
      addRemovedTab(nineZone, widgetDef);
      location = findTab(nineZone, id);
      assert(!!location);
    }
    const widget = nineZone.widgets[location.widgetId];
    widget.minimized = false;
    widget.activeTabId = id;
    // ensure panel containing widget is not collapsed
    // istanbul ignore else
    if ("side" in location) {
      const panel = nineZone.panels[location.side];
      panel.collapsed && (panel.collapsed = false);
      // istanbul ignore next
      if (undefined === panel.size || 0 === panel.size) {
        panel.size = panel.minSize ?? 200;
      }
    }
  } else if (state === WidgetState.Closed) {
    const id = widgetDef.id;
    let location = findTab(nineZone, id);
    if (!location) {
      addRemovedTab(nineZone, widgetDef);
      location = findTab(nineZone, id);
      assert(!!location);
    }
    const widget = nineZone.widgets[location.widgetId];
    if (id !== widget.activeTabId)
      return;
    const minimized = widget.minimized;
    widget.minimized = true;
    if ("side" in location) {
      const panel = nineZone.panels[location.side];
      const maximized = panel.widgets.find((wId) => {
        const w = nineZone.widgets[wId];
        return !w.minimized;
      });
      if (maximized === undefined)
        widget.minimized = minimized;
      return;
    }
  } else if (state === WidgetState.Hidden) {
    hideWidget(nineZone, widgetDef);
  }
});

/** Stores widget location and hides it in the UI. */
function hideWidget(state: Draft<NineZoneState>, widgetDef: WidgetDef) {
  const location = findTab(state, widgetDef.id);
  if (!location)
    return;
  const widgetId = location.widgetId;
  const side = "side" in location ? location.side : "left";
  const widgetIndex = "side" in location ? state.panels[side].widgets.indexOf(widgetId) : 0;
  const tabIndex = state.widgets[location.widgetId].tabs.indexOf(widgetDef.id);
  widgetDef.tabLocation = {
    side,
    tabIndex,
    widgetId,
    widgetIndex,
  };
  removeTab(state, widgetDef.id);
}

/** @internal */
export const showWidget = produce((nineZone: Draft<NineZoneState>, id: TabState["id"]) => {
  const location = findTab(nineZone, id);
  if (!location)
    return;
  const widget = nineZone.widgets[location.widgetId];
  if ("side" in location) {
    const panel = nineZone.panels[location.side];
    panel.collapsed = false;
    widget.minimized = false;
    widget.activeTabId = id;
    return;
  }
  widget.activeTabId = id;
  widget.minimized = false;
  isFloatingLocation(location) && floatingWidgetBringToFront(nineZone, location.floatingWidgetId);
});

/** @internal */
export const expandWidget = produce((nineZone: Draft<NineZoneState>, id: TabState["id"]) => {
  const location = findTab(nineZone, id);
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
});

/** @internal */
export const setWidgetLabel = produce((nineZone: Draft<NineZoneState>, id: TabState["id"], label: string) => {
  if (!(id in nineZone.tabs))
    return;

  const tab = nineZone.tabs[id];
  tab.label = label;
});

/** @internal */
export function useSavedFrontstageState(frontstageDef: FrontstageDef) {
  const uiStateStorage = useUiStateStorageHandler();
  const uiStateStorageRef = React.useRef(uiStateStorage);
  const isMountedRef = React.useRef(false);
  React.useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);
  React.useEffect(() => {
    uiStateStorageRef.current = uiStateStorage;
  }, [uiStateStorage]);
  React.useEffect(() => {
    async function fetchFrontstageState() {
      if (frontstageDef.nineZoneState) {
        frontstageDef.nineZoneState = processPopoutWidgets(frontstageDef.nineZoneState, frontstageDef);
        return;
      }
      const id = frontstageDef.id;
      const version = frontstageDef.version;
      const settingsResult = await uiStateStorageRef.current.getSetting(FRONTSTAGE_SETTINGS_NAMESPACE, getFrontstageStateSettingName(id));
      if (isMountedRef.current) {
        if (isFrontstageStateSettingResult(settingsResult) &&
          settingsResult.setting.version >= version &&
          settingsResult.setting.stateVersion >= stateVersion
        ) {
          const restored = restoreNineZoneState(frontstageDef, settingsResult.setting.nineZone);
          let state = addMissingWidgets(frontstageDef, restored);
          state = removeHiddenWidgets(state, frontstageDef);
          state = processPopoutWidgets(state, frontstageDef);
          frontstageDef.nineZoneState = state;
          return;
        }
        frontstageDef.nineZoneState = initializeNineZoneState(frontstageDef);
      }
    }
    fetchFrontstageState(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }, [frontstageDef]);
}

/** @internal */
export function useSaveFrontstageSettings(frontstageDef: FrontstageDef) {
  const nineZone = useNineZoneState(frontstageDef);
  const uiSettingsStorage = useUiStateStorageHandler();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const saveSetting = React.useCallback(debounce(async (id: string, version: number, state: NineZoneState) => {
    const setting: WidgetPanelsFrontstageState = {
      id,
      nineZone: packNineZoneState(state),
      stateVersion,
      version,
    };
    await uiSettingsStorage.saveSetting(FRONTSTAGE_SETTINGS_NAMESPACE, getFrontstageStateSettingName(id), setting);
  }, 1000), [uiSettingsStorage]);
  React.useEffect(() => {
    return () => {
      saveSetting.cancel();
    };
  }, [saveSetting]);
  React.useEffect(() => {
    if (!nineZone || nineZone.draggedTab)
      return;
    saveSetting(frontstageDef.id, frontstageDef.version, nineZone);
  }, [frontstageDef, nineZone, saveSetting]);
}

/** @internal */
export const FRONTSTAGE_SETTINGS_NAMESPACE = "uifw-frontstageSettings";

/** @internal */
export function getFrontstageStateSettingName(frontstageId: WidgetPanelsFrontstageState["id"]) {
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

const createListener = <T extends (...args: any[]) => void>(frontstageDef: FrontstageDef, listener: T) => {
  return (...args: Parameters<T>) => {
    if (!frontstageDef.nineZoneState)
      return;
    listener(...args);
  };
};

/** @internal */
export function useFrontstageManager(frontstageDef: FrontstageDef) {
  React.useEffect(() => {
    const listener = createListener(frontstageDef, ({ widgetDef, widgetState }: WidgetStateChangedEventArgs) => {
      assert(!!frontstageDef.nineZoneState);
      frontstageDef.nineZoneState = setWidgetState(frontstageDef.nineZoneState, widgetDef, widgetState);
    });
    FrontstageManager.onWidgetStateChangedEvent.addListener(listener);
    return () => {
      FrontstageManager.onWidgetStateChangedEvent.removeListener(listener);
    };
  }, [frontstageDef]);
  React.useEffect(() => {
    const listener = createListener(frontstageDef, ({ widgetDef }: WidgetEventArgs) => {
      assert(!!frontstageDef.nineZoneState);
      frontstageDef.nineZoneState = showWidget(frontstageDef.nineZoneState, widgetDef.id);
    });
    FrontstageManager.onWidgetShowEvent.addListener(listener);
    return () => {
      FrontstageManager.onWidgetShowEvent.removeListener(listener);
    };
  }, [frontstageDef]);
  React.useEffect(() => {
    const listener = createListener(frontstageDef, ({ widgetDef }: WidgetEventArgs) => {
      assert(!!frontstageDef.nineZoneState);
      let nineZoneState = showWidget(frontstageDef.nineZoneState, widgetDef.id);
      nineZoneState = expandWidget(nineZoneState, widgetDef.id);
      frontstageDef.nineZoneState = nineZoneState;
    });
    FrontstageManager.onWidgetExpandEvent.addListener(listener);
    return () => {
      FrontstageManager.onWidgetExpandEvent.removeListener(listener);
    };
  }, [frontstageDef]);
  const uiSettingsStorage = useUiStateStorageHandler();
  React.useEffect(() => {
    const listener = (args: FrontstageEventArgs) => {
      // TODO: track restoring frontstages to support workflows:  i.e. prevent loading frontstage OR saving layout when delete is pending
      uiSettingsStorage.deleteSetting(FRONTSTAGE_SETTINGS_NAMESPACE, getFrontstageStateSettingName(args.frontstageDef.id)); // eslint-disable-line @typescript-eslint/no-floating-promises
      if (frontstageDef.id === args.frontstageDef.id) {
        args.frontstageDef.nineZoneState = initializeNineZoneState(frontstageDef);
      } else {
        args.frontstageDef.nineZoneState = undefined;
      }
    };
    FrontstageManager.onFrontstageRestoreLayoutEvent.addListener(listener);
    return () => {
      FrontstageManager.onFrontstageRestoreLayoutEvent.removeListener(listener);
    };
  }, [uiSettingsStorage, frontstageDef]);
  React.useEffect(() => {
    const listener = createListener(frontstageDef, ({ widgetDef }: WidgetEventArgs) => {
      assert(!!frontstageDef.nineZoneState);
      const label = widgetDef.label;
      frontstageDef.nineZoneState = setWidgetLabel(frontstageDef.nineZoneState, widgetDef.id, label);
    });
    FrontstageManager.onWidgetLabelChangedEvent.addListener(listener);
    return () => {
      FrontstageManager.onWidgetLabelChangedEvent.removeListener(listener);
    };
  }, [frontstageDef]);
}

/** @internal */
// istanbul ignore next
export function useItemsManager(frontstageDef: FrontstageDef) {
  const refreshNineZoneState = (def: FrontstageDef) => {
    // Fired for both registered/unregistered. Update definitions and remove/add missing widgets.
    def.updateWidgetDefs();
    let state = def.nineZoneState;
    if (!state)
      return;
    state = addMissingWidgets(def, state);
    state = removeMissingWidgets(def, state);
    state = removeHiddenWidgets(state, def); // TODO: should only apply to widgets provided by registered provider in onUiProviderRegisteredEvent.
    def.nineZoneState = state;
  };

  React.useEffect(() => {
    const remove = UiItemsManager.onUiProviderRegisteredEvent.addListener(() => {
      refreshNineZoneState(frontstageDef);
    });
    // Need to refresh anytime frontstageDef changes because uiItemsProvider may have added something to
    // another stage before it was possibly unloaded in this stage.
    refreshNineZoneState(frontstageDef);
    return remove;
  }, [frontstageDef]);
}

function tabShownInCurrentWidget(def: WidgetDef, state: NineZoneState) {
  for (const [, widget] of Object.entries(state.widgets)) {
    const foundTab = widget.tabs.find((tabId) => tabId === def.id);
    // istanbul ignore else
    if (foundTab)
      return true;
  }
  return false;
}

// istanbul ignore next
function determineNewWidgets(defs: readonly WidgetDef[] | undefined, state: NineZoneState) {
  // if tab for widget.id is not found or the label does not match widget label (label is set to "undefined" when widgetDef is not initially available)
  return (defs || []).filter((def) => !(def.id in state.tabs) || !tabShownInCurrentWidget(def, state));
}

/** @internal */
export async function saveFrontstagePopoutWidgetSizeAndPosition(state: NineZoneState, stageId: string, stageVersion: number, childWindowId: string, childWindow: Window) {
  const location = findWidget(state, childWindowId);
  // istanbul ignore else
  if (location) {
    const adjustmentWidth = ProcessDetector.isElectronAppFrontend ? 16 : 0;
    const adjustmentHeight = ProcessDetector.isElectronAppFrontend ? 39 : 0;
    const newState = produce(state, (draft) => {
      const widget = draft.widgets[childWindowId];
      const tab = draft.tabs[widget.activeTabId];
      tab.preferredPopoutWidgetSize = {
        x: childWindow.screenX,
        y: childWindow.screenY,
        width: childWindow.innerWidth + adjustmentWidth,
        height: childWindow.innerHeight + adjustmentHeight,
      };
    });

    const setting: WidgetPanelsFrontstageState = {
      id: stageId,
      nineZone: packNineZoneState(newState),
      stateVersion,
      version: stageVersion,
    };
    await UiFramework.getUiStateStorage().saveSetting(FRONTSTAGE_SETTINGS_NAMESPACE, getFrontstageStateSettingName(stageId), setting);
    return newState;
  }
  // istanbul ignore next
  return state;
}
