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
import produce from "immer";
import * as React from "react";
import { assert, Logger, ProcessDetector } from "@itwin/core-bentley";
import { StagePanelLocation, UiItemsManager, WidgetState } from "@itwin/appui-abstract";
import { Rectangle, RectangleProps, Size, SizeProps, UiStateStorageResult, UiStateStorageStatus } from "@itwin/core-react";
import { ToolbarPopupAutoHideContext } from "@itwin/components-react";
import {
  addFloatingWidget, addPanelWidget, addTab, addTabToWidget, convertAllPopupWidgetContainersToFloating, createNineZoneState, floatingWidgetBringToFront,
  FloatingWidgetHomeState,
  FloatingWidgets, getTabLocation, getUniqueId, getWidgetPanelSectionId, insertPanelWidget, insertTabToWidget, isFloatingTabLocation,
  isHorizontalPanelSide, isPanelTabLocation, isPopoutTabLocation, NineZone, NineZoneAction, NineZoneDispatch, NineZoneLabels, NineZoneState, NineZoneStateReducer, PanelSide,
  panelSides, removeTab, removeTabFromWidget, TabState, toolSettingsTabId, WidgetPanels,
} from "@itwin/appui-layout-react";
import { useActiveFrontstageDef } from "../frontstage/Frontstage";
import { FrontstageDef, FrontstageEventArgs, FrontstageNineZoneStateChangedEventArgs } from "../frontstage/FrontstageDef";
import { FrontstageManager } from "../frontstage/FrontstageManager";
import { StagePanelMaxSizeSpec } from "../stagepanels/StagePanel";
import { StagePanelState, StagePanelZoneDefKeys } from "../stagepanels/StagePanelDef";
import { UiFramework } from "../UiFramework";
import { useUiStateStorageHandler } from "../uistate/useUiStateStorage";
import { TabLocation, WidgetDef, WidgetEventArgs, WidgetStateChangedEventArgs } from "../widgets/WidgetDef";
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

function FrameworkStateReducer(state: NineZoneState, action: NineZoneAction, frontstageDef: FrontstageDef) {
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
      allowedPanelTargets: widget.allowedPanelTargets as PanelSide[],
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
    // if a defaultFloatingSize is specified then this mean the widget can't determine its intrinsic size and must be explicitly sized
    const userSized = saveTab ? (saveTab.userSized || !!widgetDef.defaultFloatingSize && !!saveTab.preferredFloatingWidgetSize)
      : !!widgetDef.defaultFloatingSize;
    state = addTab(state, widgetDef.id, {
      label,
      iconSpec: widgetDef.iconSpec,
      canPopout: widgetDef.canPopout,
      preferredPanelWidgetSize,
      preferredFloatingWidgetSize,
      userSized,
      isFloatingStateWindowResizable: widgetDef.isFloatingStateWindowResizable,
      hideWithUiWhenFloating: !!widgetDef.hideWithUiWhenFloating,
      allowedPanelTargets: widgetDef.allowedPanelTargets as PanelSide[],
    });

    if (widgetDef.isFloatingStateSupported && widgetDef.defaultState === WidgetState.Floating) {
      const floatingContainerId = widgetDef.floatingContainerId ?? getUniqueId();
      const widgetContainerId = getWidgetId(side, panelZoneKeys[preferredWidgetIndex]);
      const home: FloatingWidgetHomeState = { side, widgetId: widgetContainerId, widgetIndex: 0 };
      const preferredPosition = widgetDef.defaultFloatingPosition;

      if (floatingContainerId in state.widgets) {
        state = addTabToWidget(state, widgetDef.id, floatingContainerId);
      } else {
        const tab = state.tabs[widgetDef.id];

        const size = { height: 200, width: 300, ...tab.preferredFloatingWidgetSize };
        const preferredPoint = preferredPosition ?? { x: (state.size.width - size.width) / 2, y: (state.size.height - size.height) / 2 };
        const nzBounds = Rectangle.createFromSize(state.size);
        const bounds = Rectangle.createFromSize(size).offset(preferredPoint);
        const containedBounds = bounds.containIn(nzBounds);

        state = addFloatingWidget(state, floatingContainerId, [widgetDef.id], {
          bounds: containedBounds.toProps(),
          home,
          userSized,
        }, {
          isFloatingStateWindowResizable: widgetDef.isFloatingStateWindowResizable,
        });
      }
    } else {
      const widgetPanelSectionId = getWidgetPanelSectionId(side, preferredWidgetIndex);
      if (widgetPanelSectionId in state.widgets) {
        state = addTabToWidget(state, widgetDef.id, widgetPanelSectionId);
      } else {
        const panel = state.panels[side];
        if (panel.widgets.length < panel.maxWidgetCount) {
          state = addPanelWidget(state, side, widgetPanelSectionId, [widgetDef.id]);
        } else {
          const widgetIndex = Math.min(preferredWidgetIndex, panel.widgets.length - 1);
          const widgetId = panel.widgets[widgetIndex];
          state = addTabToWidget(state, widgetDef.id, widgetId);
        }
      }
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

/** Hide widgets with Hidden defaultState. */
function hideWidgets(state: NineZoneState, frontstageDef: FrontstageDef): NineZoneState {
  const tabs = Object.values(state.tabs);
  for (const tab of tabs) {
    const widgetDef = frontstageDef.findWidgetDef(tab.id);
    if (!widgetDef)
      continue;

    if (widgetDef.defaultState === WidgetState.Hidden) {
      state = hideWidget(state, widgetDef);
    }
  }

  return state;
}

/** Removes NineZoneState widgets that are missing in frontstageDef.
 * @internal
 */
export function removeMissingWidgets(frontstageDef: FrontstageDef, initialState: NineZoneState): NineZoneState {
  let state = initialState;
  for (const [, tab] of Object.entries(state.tabs)) {
    if (tab.id === toolSettingsTabId)
      continue;
    const widgetDef = frontstageDef.findWidgetDef(tab.id);
    if (widgetDef)
      continue;
    state = removeTab(state, tab.id);
  }
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
export function initializePanel(state: NineZoneState, frontstageDef: FrontstageDef, panelSide: PanelSide) {
  state = addPanelWidgets(state, frontstageDef, panelSide);
  const location = toStagePanelLocation(panelSide);
  const panelDef = frontstageDef.getStagePanelDef(location);
  state = produce(state, (draft) => {
    const panel = draft.panels[panelSide];
    panel.minSize = panelDef?.minSize ?? panel.minSize;
    panel.pinned = panelDef?.pinned ?? panel.pinned;
    panel.resizable = panelDef?.resizable ?? panel.resizable;
    if (panelDef?.maxSizeSpec) {
      panel.maxSize = getPanelMaxSize(panelDef.maxSizeSpec, panelSide, state.size);
    }

    const size = panelDef?.size;
    panel.size = size === undefined ? size : Math.min(Math.max(size, panel.minSize), panel.maxSize);
  });
  return state;
}

function getPanelMaxSize(maxSizeSpec: StagePanelMaxSizeSpec, panel: PanelSide, nineZoneSize: SizeProps) {
  if (typeof maxSizeSpec === "number") {
    return maxSizeSpec;
  }
  const size = isHorizontalPanelSide(panel) ? nineZoneSize.height : nineZoneSize.width;
  return maxSizeSpec.percentage / 100 * size;
}

const stateVersion = 13; // this needs to be bumped when NineZoneState is changed (to recreate the layout).

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
      // istanbul ignore next
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
  nineZone = hideWidgets(nineZone, frontstageDef);
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
    tabs: defaultNineZone.tabs,
  };

  for (const [, tab] of Object.entries(saved.tabs)) {
    // Re-add the placeholder tab in order to correctly remove it from the state if WidgetDef is not found.
    restored = addTab(restored, tab.id);

    const widgetDef = frontstageDef.findWidgetDef(tab.id);
    if (!widgetDef) {
      Logger.logInfo(UiFramework.loggerCategory(restoreNineZoneState), "WidgetDef is not found for saved tab.", () => ({
        frontstageId: frontstageDef.id,
        tabId: tab.id,
      }));
      restored = removeTab(restored, tab.id);
      continue;
    }
    restored = produce(restored, (draft) => {
      draft.tabs[tab.id] = {
        ...tab,
        label: getWidgetLabel(widgetDef.label),
        hideWithUiWhenFloating: widgetDef.hideWithUiWhenFloating,
        iconSpec: widgetDef.iconSpec,
        canPopout: widgetDef.canPopout,
        isFloatingStateWindowResizable: widgetDef.isFloatingStateWindowResizable,
        allowedPanelTargets: widgetDef.allowedPanelTargets as PanelSide[],
      };
    });
  }
  restored = produce(restored, (draft) => {
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
        allowedPanelTargets: tab.allowedPanelTargets,
        userSized: tab.userSized,
      };
    }
  });
  return packed;
}

// TODO: clean-up of saved widgets.
// istanbul ignore next
function packSavedWidgets(savedWidgets: SavedWidgets, frontstageDef: FrontstageDef): SavedWidgets {
  for (const widgetDef of frontstageDef.widgetDefs) {
    const id = widgetDef.id;
    const initialWidget: SavedWidget = {
      id,
    };
    const widget = produce(initialWidget, (draft) => {
      if (widgetDef.tabLocation) {
        draft.tabLocation = { ...widgetDef.tabLocation };
      }
      if (widgetDef.popoutBounds) {
        draft.popoutBounds = widgetDef.popoutBounds.toProps();
      }
    });
    if (widget === initialWidget)
      continue;

    savedWidgets = produce(savedWidgets, (draft) => {
      draft.push(widget);
    });
  }

  return savedWidgets;
}

// istanbul ignore next
function restoreSavedWidgets(savedWidgets: SavedWidgets, frontstage: FrontstageDef) {
  let i = savedWidgets.length;
  while (i--) {
    const savedWidget = savedWidgets[i];
    const widgetId = savedWidget.id;
    const widgetDef = frontstage.findWidgetDef(widgetId);
    if (!widgetDef)
      continue;

    if (savedWidget.tabLocation) {
      widgetDef.tabLocation = { ...savedWidget.tabLocation };
    }
    if (savedWidget.popoutBounds) {
      widgetDef.popoutBounds = Rectangle.create(savedWidget.popoutBounds);
    }

    savedWidgets = produce(savedWidgets, (draft) => {
      draft.splice(i, 1);
    });
  }

  return savedWidgets;
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
  widgets: SavedWidgets;
  id: FrontstageDef["id"];
  /** Frontstage version used to create the frontstage state. Allows to invalidate the layout from the frontstage. */
  version: number;
  /** Platform provided frontstage version. Allows to invalidate the layout from the platform. */
  stateVersion: number;
}

/** Saved data specific to `WidgetDef`. I.e. used to restore hidden widgets.
 * @internal
 */
export interface SavedWidget {
  readonly id: WidgetDef["id"];
  readonly tabLocation?: TabLocation;
  readonly popoutBounds?: RectangleProps;
}

/** @internal */
export type SavedWidgets = ReadonlyArray<SavedWidget>;

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

function addHiddenWidget(state: NineZoneState, widgetDef: WidgetDef): NineZoneState {
  const tabLocation = widgetDef.tabLocation || widgetDef.defaultTabLocation;
  const tabId = widgetDef.id;
  const { widgetId, tabIndex } = tabLocation;

  if (widgetId in state.widgets) {
    // Add to an existing widget (by widget id).
    return insertTabToWidget(state, tabId, widgetId, tabIndex);
  } else if (tabLocation.floatingWidget) {
    const floatingWidget = tabLocation.floatingWidget;
    assert(widgetId === floatingWidget.id);

    // Add to a new floating widget.
    const nzBounds = Rectangle.createFromSize(state.size);
    const bounds = Rectangle.create(floatingWidget.bounds).containIn(nzBounds);
    return addFloatingWidget(state, floatingWidget.id, [tabId], {
      ...floatingWidget,
      bounds: bounds.toProps(),
    });
  }

  // Add to a panel section.
  const panel = state.panels[tabLocation.side];

  // Add to existing panel section.
  if (panel.widgets.length >= panel.maxWidgetCount) {
    const sectionIndex = Math.min(panel.maxWidgetCount - 1, tabLocation.widgetIndex);
    const sectionId = panel.widgets[sectionIndex];
    return insertTabToWidget(state, tabId, sectionId, tabLocation.tabIndex);
  }

  // Create a new panel section.
  const newSectionId = getUniqueId();
  return insertPanelWidget(state, panel.side, newSectionId, [tabId], tabLocation.widgetIndex);
}

/** @internal */
export function setWidgetState(
  state: NineZoneState,
  widgetDef: WidgetDef,
  widgetState: WidgetState,
) {
  if (widgetState === WidgetState.Hidden) {
    return hideWidget(state, widgetDef);
  } else if (widgetState === WidgetState.Open) {
    const id = widgetDef.id;
    let location = getTabLocation(state, id);
    if (!location) {
      state = addHiddenWidget(state, widgetDef);
      location = getTabLocation(state, id);
    }

    return produce(state, (draft) => {
      assert(!!location);
      const widget = draft.widgets[location.widgetId];
      widget.minimized = false;
      widget.activeTabId = id;

      if (isFloatingTabLocation(location)) {
        const floatingWidget = draft.floatingWidgets.byId[location.floatingWidgetId];
        floatingWidget.hidden = false;
      // istanbul ignore else
      } else if (isPanelTabLocation(location)) {
        const panel = draft.panels[location.side];
        panel.collapsed = false;
        if (undefined === panel.size || 0 === panel.size) {
          // istanbul ignore next
          panel.size = panel.minSize ?? 200;
        }
      }
    });
  } else if (widgetState === WidgetState.Closed) {
    const id = widgetDef.id;
    let location = getTabLocation(state, id);
    if (!location) {
      state = addHiddenWidget(state, widgetDef);
      location = getTabLocation(state, id);
    }

    // TODO: should change activeTabId of a widget with multiple tabs.
    return produce(state, (draft) => {
      assert(!!location);
      const widget = draft.widgets[location.widgetId];

      if (isFloatingTabLocation(location)) {
        if (id === widget.activeTabId) {
          widget.minimized = true;
        }
      }
    });
  } else if (widgetState === WidgetState.Floating) {
    const id = widgetDef.id;
    let location = getTabLocation(state, id);
    if (!location) {
      state = addHiddenWidget(state, widgetDef);
      location = getTabLocation(state, id);
    }

    assert(!!location);
    if (isFloatingTabLocation(location))
      return state;

    // Widget is not floating.
    state = removeTabFromWidget(state, id);
    const bounds = widgetDef.tabLocation?.floatingWidget?.bounds;
    state = addFloatingWidget(state, getUniqueId(), [id], { bounds });
  }
  return state;
}

/** Stores widget location and hides it in the UI. */
function hideWidget(state: NineZoneState, widgetDef: WidgetDef) {
  const location = getTabLocation(state, widgetDef.id);
  if (!location)
    return state;
  // istanbul ignore else
  if (isFloatingTabLocation(location)) {
    const floatingWidget = state.floatingWidgets.byId[location.widgetId];
    widgetDef.setFloatingContainerId(location.floatingWidgetId);
    widgetDef.tabLocation = {
      side: floatingWidget.home.side,
      tabIndex: floatingWidget.home.widgetIndex,
      widgetId: floatingWidget.id,
      widgetIndex: floatingWidget.home.widgetIndex,
      floatingWidget,
    };
  } else if (!isPopoutTabLocation(location)) {
    const widgetId = location.widgetId;
    const side = isPanelTabLocation(location) ? location.side : "left";
    const widgetIndex = isPanelTabLocation(location) ? state.panels[side].widgets.indexOf(widgetId) : 0;
    const tabIndex = state.widgets[location.widgetId].tabs.indexOf(widgetDef.id);
    widgetDef.tabLocation = {
      side,
      tabIndex,
      widgetId,
      widgetIndex,
    };
  }
  return removeTabFromWidget(state, widgetDef.id);
}

/** @internal */
export function showWidget(state: NineZoneState, id: TabState["id"]) {
  const location = getTabLocation(state, id);
  if (!location)
    return state;
  state = produce(state, (draft) => {
    const widget = draft.widgets[location.widgetId];
    widget.activeTabId = id;
    widget.minimized = false;
    if (isPanelTabLocation(location)) {
      const panel = draft.panels[location.side];
      panel.collapsed = false;
    }
  });
  if (isFloatingTabLocation(location)) {
    state = floatingWidgetBringToFront(state, location.floatingWidgetId);
  }
  return state;
}

/** @internal */
export function expandWidget(state: NineZoneState, id: TabState["id"]) {
  const location = getTabLocation(state, id);
  if (!location)
    return state;

  return produce(state, (draft) => {
    const widget = draft.widgets[location.widgetId];
    if (isPanelTabLocation(location)) {
      const panel = draft.panels[location.side];
      panel.widgets.forEach((wId) => {
        const w = draft.widgets[wId];
        w.minimized = true;
      });
    }
    widget.minimized = false;
  });
}

/** @internal */
export function setWidgetLabel(state: NineZoneState, id: TabState["id"], label: string) {
  if (!(id in state.tabs))
    return state;

  return produce(state, (draft) => {
    const tab = draft.tabs[id];
    tab.label = label;
  });
}

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
      const settingResult = await uiStateStorageRef.current.getSetting(FRONTSTAGE_SETTINGS_NAMESPACE, getFrontstageStateSettingName(id));
      if (!isMountedRef.current)
        return;

      if (isFrontstageStateSettingResult(settingResult)) {
        const setting = settingResult.setting;
        if (setting.version >= version && setting.stateVersion >= stateVersion) {
          const restored = restoreNineZoneState(frontstageDef, setting.nineZone);
          const savedWidgets = restoreSavedWidgets(setting.widgets, frontstageDef);
          let state = addMissingWidgets(frontstageDef, restored);
          state = hideWidgets(state, frontstageDef);
          state = processPopoutWidgets(state, frontstageDef);

          frontstageDef.nineZoneState = state;
          frontstageDef.savedWidgetDefs = savedWidgets;
          return;
        }
      }
      frontstageDef.nineZoneState = initializeNineZoneState(frontstageDef);
    }
    fetchFrontstageState(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }, [frontstageDef]);
}

/** @internal */
export function useSaveFrontstageSettings(frontstageDef: FrontstageDef) {
  const nineZone = useNineZoneState(frontstageDef);
  const uiSettingsStorage = useUiStateStorageHandler();
  const saveSetting = React.useMemo(() => {
    return debounce(async (frontstage: FrontstageDef, state: NineZoneState, savedWidgets: SavedWidgets) => {
      const id = frontstage.id;
      const setting: WidgetPanelsFrontstageState = {
        id,
        version: frontstage.version,
        stateVersion,
        nineZone: packNineZoneState(state),
        widgets: packSavedWidgets(savedWidgets, frontstage),
      };
      await uiSettingsStorage.saveSetting(FRONTSTAGE_SETTINGS_NAMESPACE, getFrontstageStateSettingName(id), setting);
    }, 1000);
  }, [uiSettingsStorage]);
  React.useEffect(() => {
    return () => {
      saveSetting.cancel();
    };
  }, [saveSetting]);
  React.useEffect(() => {
    if (!nineZone || nineZone.draggedTab)
      return;
    const savedWidgets = frontstageDef.savedWidgetDefs || [];
    saveSetting(frontstageDef, nineZone, savedWidgets);
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
    () => UiFramework.translate("widget.labels.toolSettings"), []
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
    if (useToolAsToolSettingsLabel) {
      FrontstageManager.onFrontstageReadyEvent.addListener(updateLabel);
      FrontstageManager.onFrontstageRestoreLayoutEvent.addListener(updateLabel);
      FrontstageManager.onToolActivatedEvent.addListener(updateLabel);
      FrontstageManager.onToolSettingsReloadEvent.addListener(updateLabel);
    }
    return () => {
      if (useToolAsToolSettingsLabel) {
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
    state = hideWidgets(state, def); // TODO: should only apply to widgets provided by registered provider in onUiProviderRegisteredEvent.
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

// istanbul ignore next
function determineNewWidgets(defs: readonly WidgetDef[] | undefined, state: NineZoneState) {
  return (defs || []).filter((def) => !(def.id in state.tabs));
}
