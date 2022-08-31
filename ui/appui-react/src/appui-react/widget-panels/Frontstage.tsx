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
  addPanelWidget, addTab, addWidgetTabToDraftFloatingPanel, addWidgetTabToFloatingPanel, addWidgetTabToPanelSection, convertAllPopupWidgetContainersToFloating, createNineZoneState, createTabsState, createTabState,
  createWidgetState, findTab, findWidget, floatingWidgetBringToFront, FloatingWidgetHomeState, FloatingWidgets, getUniqueId, getWidgetPanelSectionId, isFloatingLocation,
  isHorizontalPanelSide, isPopoutLocation, NineZone, NineZoneActionTypes, NineZoneDispatch, NineZoneLabels, NineZoneState,
  NineZoneStateReducer, PanelSide, panelSides, removeTab, TabState, toolSettingsTabId, WidgetPanels,
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
import { IModelApp } from "@itwin/core-frontend";

const panelZoneKeys: StagePanelZoneDefKeys[] = ["start", "end"];

const WidgetInternals = React.memo(function WidgetInternals() { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const activeModalFrontstageInfo = useActiveModalFrontstageInfo();
  const uiIsVisible = useUiVisibility();

  return (
    <>
      <ToolbarPopupAutoHideContext.Provider value={!uiIsVisible}>
        <ModalFrontstageComposer stageInfo={activeModalFrontstageInfo} />
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

// istanbul ignore next
const WidgetPanelsFrontstageComponent = React.memo(function WidgetPanelsFrontstageComponent() { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow

  return (
    <>
      <WidgetPanelsToolSettings />
      <WidgetInternals />
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

    window.addEventListener("unload", triggerWidowCloseProcessing);
    return () => {
      window.removeEventListener("unload", triggerWidowCloseProcessing);
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
  useItemsManager(frontstageDef);
  const labels = useLabels();
  const uiIsVisible = useUiVisibility();
  const showWidgetIcon = useSelector((state: FrameworkRootState) => {
    const frameworkState = (state as any)[UiFramework.frameworkStateKey];
    return !!frameworkState.configurableUiState.showWidgetIcon;
  });
  const autoCollapseUnpinnedPanels = useSelector((state: FrameworkRootState) => {
    const frameworkState = (state as any)[UiFramework.frameworkStateKey];
    return !!frameworkState.configurableUiState.autoCollapseUnpinnedPanels;
  });
  const animateToolSettings = useSelector((state: FrameworkRootState) => {
    const frameworkState = (state as any)[UiFramework.frameworkStateKey];
    return !!frameworkState.configurableUiState.animateToolSettings;
  });
  const useToolAsToolSettingsLabel = useSelector((state: FrameworkRootState) => {
    const frameworkState = (state as any)[UiFramework.frameworkStateKey];
    return !!frameworkState.configurableUiState.useToolAsToolSettingsLabel;
  });
  useFrontstageManager(frontstageDef, useToolAsToolSettingsLabel);

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
        autoCollapseUnpinnedPanels={autoCollapseUnpinnedPanels}
        toolSettingsContent={toolSettingsContent}
        widgetContent={widgetContent}
        animateDockedToolSettings={animateToolSettings}
        uiIsVisible={uiIsVisible}
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
      preferredFloatingWidgetSize: widget.defaultFloatingSize,
      canPopout: widget.canPopout,
      isFloatingStateWindowResizable: widget.isFloatingStateWindowResizable,
      hideWithUiWhenFloating: !!widget.hideWithUiWhenFloating,
    });
    tabs.push(widget.id);
  }

  const activeWidget = visibleWidgets.find((widget) => widget.isActive);
  const minimized = false;
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

  // Add missing widget tabs.
  for (const widgetDef of widgetDefs) {
    const label = getWidgetLabel(widgetDef.label);
    const saveTab = state.tabs[widgetDef.id];
    const preferredPanelWidgetSize = saveTab ? saveTab.preferredPanelWidgetSize : widgetDef.preferredPanelSize;
    const preferredFloatingWidgetSize = saveTab ? saveTab.preferredFloatingWidgetSize : widgetDef.defaultFloatingSize;
    const preferredPopoutWidgetSize = saveTab ? saveTab.preferredPopoutWidgetSize : undefined;
    // if a defaultFloatingSize is specified then this mean the widget can't determine its intrinsic size and must be explicitly sized
    const userSized = saveTab ? (saveTab.userSized || !!widgetDef.defaultFloatingSize && !!saveTab.preferredFloatingWidgetSize)
      : !!widgetDef.defaultFloatingSize;
    state = addTab(state, widgetDef.id, {
      label,
      iconSpec: widgetDef.iconSpec,
      canPopout: widgetDef.canPopout,
      preferredPanelWidgetSize,
      preferredFloatingWidgetSize,
      preferredPopoutWidgetSize,
      userSized,
      isFloatingStateWindowResizable: widgetDef.isFloatingStateWindowResizable,
      hideWithUiWhenFloating: !!widgetDef.hideWithUiWhenFloating,
    });
    if (widgetDef.isFloatingStateSupported && widgetDef.defaultState === WidgetState.Floating) {
      const floatingContainerId = widgetDef.floatingContainerId ?? getUniqueId();
      const widgetContainerId = getWidgetId(side, panelZoneKeys[preferredWidgetIndex]);
      const homePanelInfo: FloatingWidgetHomeState = { side, widgetId: widgetContainerId, widgetIndex: 0 };
      const preferredPosition = widgetDef.defaultFloatingPosition;
      state = addWidgetTabToFloatingPanel(state, floatingContainerId, widgetDef.id, homePanelInfo, preferredFloatingWidgetSize, preferredPosition, userSized, widgetDef.isFloatingStateWindowResizable);
    } else {
      const widgetPanelSectionId = getWidgetPanelSectionId(side, preferredWidgetIndex);
      state = addWidgetTabToPanelSection(state, side, widgetPanelSectionId, widgetDef.id);
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

  state = appendWidgets(state, determineNewWidgets(frontstageDef.centerLeft?.widgetDefs, state), "left", 0);
  state = appendWidgets(state, determineNewWidgets(frontstageDef.leftPanel?.panelZones.start.widgetDefs, state), "left", 0);
  state = appendWidgets(state, determineNewWidgets(frontstageDef.bottomLeft?.widgetDefs, state), "left", 1);
  state = appendWidgets(state, determineNewWidgets(frontstageDef.leftPanel?.panelWidgetDefs, state), "left", 1);
  state = appendWidgets(state, determineNewWidgets(frontstageDef.leftPanel?.panelZones.end.widgetDefs, state), "left", 1);

  state = appendWidgets(state, determineNewWidgets(frontstageDef.centerRight?.widgetDefs, state), "right", 0);
  state = appendWidgets(state, determineNewWidgets(frontstageDef.rightPanel?.panelZones.start.widgetDefs, state), "right", 0);
  state = appendWidgets(state, determineNewWidgets(frontstageDef.bottomRight?.widgetDefs, state), "right", 1);
  state = appendWidgets(state, determineNewWidgets(frontstageDef.rightPanel?.panelWidgetDefs, state), "right", 1);
  state = appendWidgets(state, determineNewWidgets(frontstageDef.rightPanel?.panelZones.end.widgetDefs, state), "right", 1);

  state = appendWidgets(state, determineNewWidgets(frontstageDef.topPanel?.panelWidgetDefs, state), "top", 0);
  state = appendWidgets(state, determineNewWidgets(frontstageDef.topPanel?.panelZones.start.widgetDefs, state), "top", 0);
  state = appendWidgets(state, determineNewWidgets(frontstageDef.topMostPanel?.panelWidgetDefs, state), "top", 1); // eslint-disable-line deprecation/deprecation
  state = appendWidgets(state, determineNewWidgets(frontstageDef.topPanel?.panelZones.end.widgetDefs, state), "top", 1);

  state = appendWidgets(state, determineNewWidgets(frontstageDef.bottomPanel?.panelWidgetDefs, state), "bottom", 0);
  state = appendWidgets(state, determineNewWidgets(frontstageDef.bottomPanel?.panelZones.start.widgetDefs, state), "bottom", 0);
  state = appendWidgets(state, determineNewWidgets(frontstageDef.bottomMostPanel?.panelWidgetDefs, state), "bottom", 1); // eslint-disable-line deprecation/deprecation
  state = appendWidgets(state, determineNewWidgets(frontstageDef.bottomPanel?.panelZones.end.widgetDefs, state), "bottom", 1);

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
  "leftEnd" |
  "rightStart" |
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
      }
      return "leftEnd";
    }
    case "right": {
      if (key === "start") {
        return "rightStart";
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
export function getPanelZoneWidgets(frontstageDef: FrontstageDef, panelZone: WidgetIdTypes): WidgetDef[] {
  switch (panelZone) {
    case "leftStart": {
      const outArray = [...frontstageDef.centerLeft?.widgetDefs || []];
      frontstageDef.leftPanel?.panelZones.start.widgetDefs.forEach((widgetDef) => {
        // istanbul ignore else
        if (undefined === outArray.find((widget) => widget.id === widgetDef.id))
          outArray.push(widgetDef);
      });
      return outArray;
    }
    case "leftEnd": {
      const outArray = [...frontstageDef.bottomLeft?.widgetDefs || []];
      frontstageDef.leftPanel?.panelZones.end.widgetDefs.forEach((widgetDef) => {
        // istanbul ignore else
        if (undefined === outArray.find((widget) => widget.id === widgetDef.id))
          outArray.push(widgetDef);
      });
      frontstageDef.leftPanel?.panelWidgetDefs.forEach((widgetDef) => {
        // istanbul ignore else
        if (undefined === outArray.find((widget) => widget.id === widgetDef.id))
          outArray.push(widgetDef);
      });
      return outArray;
    }
    case "rightStart": {
      const outArray = [...frontstageDef.centerRight?.widgetDefs || []];
      frontstageDef.rightPanel?.panelZones.start.widgetDefs.forEach((widgetDef) => {
        // istanbul ignore else
        if (undefined === outArray.find((widget) => widget.id === widgetDef.id))
          outArray.push(widgetDef);
      });
      return outArray;
    }
    case "rightEnd": {
      const outArray = [...frontstageDef.bottomRight?.widgetDefs || []];
      frontstageDef.rightPanel?.panelZones.end.widgetDefs.forEach((widgetDef) => {
        // istanbul ignore else
        if (undefined === outArray.find((widget) => widget.id === widgetDef.id))
          outArray.push(widgetDef);
      });
      frontstageDef.rightPanel?.panelWidgetDefs.forEach((widgetDef) => {
        // istanbul ignore else
        if (undefined === outArray.find((widget) => widget.id === widgetDef.id))
          outArray.push(widgetDef);
      });
      return outArray;
    }
    case "topStart": {
      const outArray = [...frontstageDef.topPanel?.panelWidgetDefs || []];
      frontstageDef.topPanel?.panelZones.start.widgetDefs.forEach((widgetDef) => {
        // istanbul ignore else
        if (undefined === outArray.find((widget) => widget.id === widgetDef.id))
          outArray.push(widgetDef);
      });
      return outArray;
    }
    case "topEnd": {
      const outArray = [...frontstageDef.topMostPanel?.panelWidgetDefs || []]; // eslint-disable-line deprecation/deprecation
      frontstageDef.topPanel?.panelZones.end.widgetDefs.forEach((widgetDef) => {
        // istanbul ignore else
        if (undefined === outArray.find((widget) => widget.id === widgetDef.id))
          outArray.push(widgetDef);
      });
      return outArray;
    }
    case "bottomStart": {
      const outArray = [...frontstageDef.bottomPanel?.panelWidgetDefs || []];
      frontstageDef.bottomPanel?.panelZones.start.widgetDefs.forEach((widgetDef) => {
        // istanbul ignore else
        if (undefined === outArray.find((widget) => widget.id === widgetDef.id))
          outArray.push(widgetDef);
      });
      return outArray;
    }
    case "bottomEnd": {
      const outArray = [...frontstageDef.bottomMostPanel?.panelWidgetDefs || []]; // eslint-disable-line deprecation/deprecation
      frontstageDef.bottomPanel?.panelZones.end.widgetDefs.forEach((widgetDef) => {
        // istanbul ignore else
        if (undefined === outArray.find((widget) => widget.id === widgetDef.id))
          outArray.push(widgetDef);
      });
      return outArray;
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
  state = addWidgets(state, determineNewWidgets(startWidgets, state), side, start);

  const end = getWidgetId(side, "end");
  const endWidgets = getPanelZoneWidgets(frontstageDef, end);
  state = addWidgets(state, determineNewWidgets(endWidgets, state), side, end);
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

const stateVersion = 12; // this needs to be bumped when NineZoneState is changed (to recreate layout).

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
        hideWithUiWhenFloating: widgetDef?.hideWithUiWhenFloating,
        iconSpec: widgetDef?.iconSpec,
        canPopout: widgetDef?.canPopout,
        isFloatingStateWindowResizable: widgetDef?.isFloatingStateWindowResizable,
      };
    }

    // remove center panel section if one is found in left or right panels
    const oldLeftMiddleIndex = saved.panels.left.widgets.findIndex((value) => value === "leftMiddle");
    // istanbul ignore next
    if (-1 !== oldLeftMiddleIndex) {
      draft.panels.left.widgets = saved.panels.left.widgets.filter((value) => value !== "leftMiddle");
      if ("leftEnd" in draft.widgets) {
        draft.widgets.leftMiddle.tabs.forEach((tab) => draft.widgets.leftEnd.tabs.push(tab));
      } else {
        draft.widgets.leftEnd = { ...draft.widgets.leftMiddle };
        delete draft.widgets.leftMiddle;
      }
    }

    const oldRightMiddleIndex = saved.panels.right.widgets.findIndex((value) => value === "rightMiddle");
    // istanbul ignore next
    if (-1 !== oldRightMiddleIndex) {
      draft.panels.right.widgets = saved.panels.right.widgets.filter((value) => value !== "rightMiddle");
      if ("rightEnd" in draft.widgets) {
        draft.widgets.rightMiddle.tabs.forEach((tab) => draft.widgets.rightEnd.tabs.push(tab));
      } else {
        draft.widgets.rightEnd = { ...draft.widgets.rightMiddle };
        delete draft.widgets.rightMiddle;
      }
    }

    return;
  });

  // TODO: remove when isUUID check is refactored.
  restored = produce(restored, (draft) => {
    // Floating widget might have been removed when saving, dock tool settings if tab is not found.
    const location = findTab(draft, toolSettingsTabId);
    if (!location) {
      draft.toolSettings.type = "docked";
    }
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
/**
 * Checks to see whether a widget id is one of our generated uuids
 * @param uuid the string value to test
 * @returns boolean
 */
function isUUID( uuid: string ) {
  const s = `${uuid}`;

  const result = s.match("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");
  // istanbul ignore else
  if (result === null) {
    return false;
  }
  return true;
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

      // istanbul ignore else
      if (isUUID(tab.id))
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
  packed = produce (packed, (draft) => {
    for (const [, floatingWidget] of Object.entries(state.floatingWidgets.byId)) {
      const widgetId = floatingWidget.id;
      // istanbul ignore else
      if (isUUID(widgetId)){
        const idIndex = draft.floatingWidgets.allIds.indexOf(widgetId);
        draft.floatingWidgets.allIds.splice(idIndex, 1);
        delete draft.floatingWidgets.byId[widgetId];
        delete draft.widgets[widgetId];
      }
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
    iconSpec: widgetDef.iconSpec,
    preferredPanelWidgetSize: widgetDef.preferredPanelSize,
    isFloatingStateWindowResizable: widgetDef.isFloatingStateWindowResizable,
    hideWithUiWhenFloating: !!widgetDef.hideWithUiWhenFloating,
  });
  nineZone.tabs[newTab.id] = newTab;
  if (widgetDef.tabLocation.widgetId in nineZone.widgets) {
    // Add to existing widget (by widget id).
    const widgetId = widgetDef.tabLocation.widgetId;
    const newTabWidget = nineZone.widgets[widgetId];
    newTabWidget.tabs.splice(widgetDef.tabLocation.tabIndex, 0, newTab.id);
  } else if (widgetDef.tabLocation.floating) {
    const id = widgetDef.tabLocation.widgetId;
    if (id in nineZone.floatingWidgets.byId){
      nineZone.floatingWidgets.allIds.push(id);
      nineZone.floatingWidgets.byId[id].hidden = false;
      addWidgetTabToDraftFloatingPanel (nineZone, widgetDef.floatingContainerId ?? widgetDef.id, widgetDef.id, nineZone.floatingWidgets.byId[id].home, newTab);
    } else {
      const home: FloatingWidgetHomeState = { side: widgetDef.tabLocation.side, widgetId: widgetDef.floatingContainerId, widgetIndex: 0 };
      addWidgetTabToDraftFloatingPanel (nineZone, widgetDef.floatingContainerId ?? widgetDef.id, widgetDef.id, home, newTab);
    }

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
    if (!!widgetDef.tabLocation.floating) {
      nineZone.floatingWidgets.byId[widgetDef.floatingContainerId ?? widgetDef.id].hidden = false;
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
    if (isFloatingLocation(location)) {
      const widget = nineZone.widgets[location.widgetId];
      if (id !== widget.activeTabId)
        return;
      widget.minimized = true;
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
  if (isFloatingLocation(location)) {
    const widget = state.floatingWidgets.byId[location.widgetId];
    widgetDef.setFloatingContainerId(location.floatingWidgetId);
    widgetDef.tabLocation = {
      side: widget.home.side,
      tabIndex: widget.home.widgetIndex,
      widgetId: widgetDef.id,
      widgetIndex: widget.home.widgetIndex,
      floating: true,
    };
  } else
  // istanbul ignore else
  if (!isPopoutLocation(location)) {
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
  }
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
export function useFrontstageManager(frontstageDef: FrontstageDef, useToolAsToolSettingsLabel?: boolean) {
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

  const defaultLabel = React.useMemo(
    () => UiFramework.translate("widget.labels.toolSettings"),[]
  );
  React.useEffect(() => {
    const updateLabel = createListener(frontstageDef, () => {
      const toolId = FrontstageManager.activeToolId;
      assert(!!frontstageDef.nineZoneState);
      const label = useToolAsToolSettingsLabel ?
        IModelApp.tools.find(toolId)?.flyover || defaultLabel : defaultLabel;
      frontstageDef.nineZoneState = setWidgetLabel(frontstageDef.nineZoneState, toolSettingsTabId, label);
    });
    // Whenever the frontstageDef or the useTool... changes, keep the label up to date.
    updateLabel();
    // If useTool... is true, listen for events to keep up the label up to date.
    if(useToolAsToolSettingsLabel) {
      FrontstageManager.onFrontstageReadyEvent.addListener(updateLabel);
      FrontstageManager.onFrontstageRestoreLayoutEvent.addListener(updateLabel);
      FrontstageManager.onToolActivatedEvent.addListener(updateLabel);
      FrontstageManager.onToolSettingsReloadEvent.addListener(updateLabel);
    }
    return () => {
      if(useToolAsToolSettingsLabel) {
        FrontstageManager.onFrontstageReadyEvent.removeListener(updateLabel);
        FrontstageManager.onFrontstageRestoreLayoutEvent.removeListener(updateLabel);
        FrontstageManager.onToolActivatedEvent.removeListener(updateLabel);
        FrontstageManager.onToolSettingsReloadEvent.removeListener(updateLabel);
      }
    };
  }, [frontstageDef, useToolAsToolSettingsLabel, defaultLabel]);
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
