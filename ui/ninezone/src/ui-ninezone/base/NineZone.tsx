/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */

import * as React from "react";
import { produce, castDraft, Draft } from "immer";
import { WidgetPanelSide, HorizontalWidgetPanelSide, VerticalWidgetPanelSide, isHorizontalWidgetPanelSide, useWidgetPanelSide } from "../widget-panels/Panel";
import { useWidgetId } from "../widget/Widget";

/** @internal future */
export interface TabState {
  readonly id: string;
  readonly label: string;
}

/** @internal future */
export interface TabsState { readonly [id: string]: TabState; }

/** @internal future */
export interface WidgetState {
  readonly activeTabId: TabState["id"] | undefined;
  readonly id: string;
  readonly minimized: boolean;
  readonly tabs: ReadonlyArray<TabState["id"]>;
}

/** @internal future */
export interface WidgetsState { readonly [id: string]: WidgetState; }

/** @internal future */
export interface PanelState {
  readonly collapseOffset: number;
  readonly collapsed: boolean;
  readonly maxSize: number;
  readonly minSize: number;
  readonly pinned: boolean;
  readonly side: WidgetPanelSide;
  readonly size: number | undefined;
  readonly widgets: ReadonlyArray<WidgetState["id"]>;
}

/** @internal future */
export interface HorizontalPanelState extends PanelState {
  readonly span: boolean;
  readonly side: HorizontalWidgetPanelSide;
}

/** @internal future */
export interface VerticalPanelState extends PanelState {
  readonly side: VerticalWidgetPanelSide;
}

/** @internal future */
export type PanelStateTypes = HorizontalPanelState | VerticalPanelState;

/** @internal future */
export interface PanelsState {
  readonly bottom: HorizontalPanelState;
  readonly left: VerticalPanelState;
  readonly right: VerticalPanelState;
  readonly top: HorizontalPanelState;
}

/** @internal future */
export function isHorizontalPanelState(state: PanelStateTypes): state is HorizontalPanelState {
  return isHorizontalWidgetPanelSide(state.side);
}

/** @internal future */
export interface NineZoneState {
  readonly panels: PanelsState;
  readonly widgets: WidgetsState;
  readonly tabs: TabsState;
}

/** @internal */
export const NineZoneContext = React.createContext<NineZoneState>(null!); // tslint:disable-line: variable-name

/** @internal */
export const NineZoneDispatchContext = React.createContext<NineZoneDispatch>(null!); // tslint:disable-line: variable-name

/** @internal future */
export function useNineZone() {
  return React.useContext(NineZoneContext);
}

/** @internal future */
export function usePanel() {
  const side = useWidgetPanelSide();
  return usePanelBySide(side);
}

/** @internal future */
export function usePanelBySide(side: WidgetPanelSide) {
  const nineZone = useNineZone();
  return nineZone.panels[side];
}

/** @internal future */
export function useWidget() {
  const id = useWidgetId();
  return useWidgetById(id);
}

/** @internal future */
export function useWidgetById(id: WidgetState["id"]) {
  const nineZone = useNineZone();
  return nineZone.widgets[id];
}

/** @internal future */
export function useTabById(id: TabState["id"]) {
  const nineZone = useNineZone();
  return nineZone.tabs[id];
}

/** @internal future */
export function useNineZoneDispatch() {
  return React.useContext(NineZoneDispatchContext);
}

/** @internal future */
export interface NineZoneProviderProps {
  children?: React.ReactNode;
  state: NineZoneState;
  dispatch: NineZoneDispatch;
}

/** @internal future */
export function NineZoneProvider(props: NineZoneProviderProps) {
  return (
    <NineZoneContext.Provider value={props.state}>
      <NineZoneDispatchContext.Provider value={props.dispatch}>
        {props.children}
      </NineZoneDispatchContext.Provider>
    </NineZoneContext.Provider>
  );
}

/** @internal future */
export const TOGGLE_PANEL_COLLAPSED = "TOGGLE_PANEL_COLLAPSED";
/** @internal future */
export const TOGGLE_PANEL_SPAN = "TOGGLE_PANEL_SPAN";
/** @internal future */
export const TOGGLE_PANEL_PINNED = "TOGGLE_PANEL_PINNED";
/** @internal future */
export const RESIZE_PANEL = "RESIZE_PANEL";
/** @internal future */
export const INITIALIZE_PANEL = "INITIALIZE_PANEL";
/** @internal future */
export const EXPAND_WIDGET = "EXPAND_WIDGET";
/** @internal future */
export const MINIMIZE_WIDGET = "MINIMIZE_WIDGET";
/** @internal future */
export const RESTORE_WIDGET = "RESTORE_WIDGET";
/** @internal future */
export const WIDGET_TAB_CLICK = "WIDGET_TAB_CLICK";
/** @internal future */
export const WIDGET_TAB_DOUBLE_CLICK = "WIDGET_TAB_DOUBLE_CLICK";

/** @internal future */
export interface TogglePanelCollapsedAction {
  readonly type: typeof TOGGLE_PANEL_COLLAPSED;
  readonly side: WidgetPanelSide;
}

/** @internal future */
export interface TogglePanelSpanAction {
  readonly type: typeof TOGGLE_PANEL_SPAN;
  readonly side: HorizontalWidgetPanelSide;
}

/** @internal future */
export interface TogglePanelPinnedAction {
  readonly type: typeof TOGGLE_PANEL_PINNED;
  readonly side: WidgetPanelSide;
}

/** @internal future */
export interface ResizePanelAction {
  readonly type: typeof RESIZE_PANEL;
  readonly side: WidgetPanelSide;
  readonly resizeBy: number;
}

/** @internal future */
export interface InitializePanelAction {
  readonly type: typeof INITIALIZE_PANEL;
  readonly side: WidgetPanelSide;
  readonly size: number;
}

/** @internal future */
export interface WidgetTabClickAction {
  readonly type: typeof WIDGET_TAB_CLICK;
  readonly side: WidgetPanelSide;
  readonly widgetId: WidgetState["id"];
  readonly id: TabState["id"];
}

/** @internal future */
export interface WidgetTabDoubleClickAction {
  readonly type: typeof WIDGET_TAB_DOUBLE_CLICK;
  readonly side: WidgetPanelSide;
  readonly widgetId: WidgetState["id"];
  readonly id: TabState["id"];
}

/** @internal future */
export type NineZoneActionTypes =
  TogglePanelCollapsedAction |
  TogglePanelSpanAction |
  TogglePanelPinnedAction |
  ResizePanelAction |
  InitializePanelAction |
  WidgetTabClickAction |
  WidgetTabDoubleClickAction;

/** @internal future */
export type NineZoneDispatch = (action: NineZoneActionTypes) => void;

/** @internal future */
export const NineZoneStateReducer: (state: NineZoneState, action: NineZoneActionTypes) => NineZoneState = produce(( // tslint:disable-line: variable-name
  state: Draft<NineZoneState>,
  action: NineZoneActionTypes,
) => {
  switch (action.type) {
    case TOGGLE_PANEL_COLLAPSED: {
      const panel = state.panels[action.side];
      state.panels[action.side].collapsed = !panel.collapsed;
      return;
    }
    case TOGGLE_PANEL_SPAN: {
      const panel = state.panels[action.side];
      state.panels[action.side].span = !panel.span;
      return;
    }
    case TOGGLE_PANEL_PINNED: {
      const panel = state.panels[action.side];
      state.panels[action.side].pinned = !panel.pinned;
      return;
    }
    case RESIZE_PANEL: {
      const panel = state.panels[action.side];
      if (panel.size === undefined)
        return;

      const requestedSize = panel.size + action.resizeBy;
      if (panel.collapsed) {
        if (action.resizeBy >= panel.collapseOffset) {
          state.panels[action.side].collapsed = false;
          return;
        }
        return;
      }

      const collapseThreshold = Math.max(panel.minSize - panel.collapseOffset, 0);
      if (requestedSize <= collapseThreshold) {
        state.panels[action.side].collapsed = true;
        state.panels[action.side].size = panel.minSize;
        return;
      }

      const size = Math.min(Math.max(requestedSize, panel.minSize), panel.maxSize);
      state.panels[action.side].size = size;
      return;
    }
    case INITIALIZE_PANEL: {
      const panel = state.panels[action.side];
      const newSize = Math.min(Math.max(action.size, panel.minSize), panel.maxSize);
      state.panels[action.side].size = newSize;
      return;
    }
    case WIDGET_TAB_CLICK: {
      const panel = state.panels[action.side];
      const widget = state.widgets[action.widgetId];
      const active = action.id === widget.activeTabId;

      state.widgets[widget.id].activeTabId = action.id;
      if (widget.minimized) {
        state.widgets[widget.id].minimized = false;
        return;
      }

      if (active) {
        for (const wId of panel.widgets) {
          const w = state.widgets[wId];
          w.minimized = w.id !== widget.id;
        }
      }
      return;
    }
    case WIDGET_TAB_DOUBLE_CLICK: {
      const panel = state.panels[action.side];
      const widget = state.widgets[action.widgetId];
      const active = action.id === widget.activeTabId;
      const maximized = panel.widgets.filter((wId) => {
        return !state.widgets[wId].minimized;
      }, 0);
      if (widget.minimized) {
        widget.activeTabId = action.id;
        for (const wId of panel.widgets) {
          const w = state.widgets[wId];
          w.minimized = w.id !== widget.id;
        }
        return;
      }
      if (!active) {
        widget.activeTabId = action.id;
        return;
      }
      if (maximized.length > 1)
        widget.minimized = true;
      return;
    }
  }
});

/** @internal */
export function createPanelState(side: WidgetPanelSide): PanelState {
  return {
    collapseOffset: 100,
    collapsed: false,
    maxSize: 600,
    minSize: 200,
    pinned: true,
    side,
    size: undefined,
    widgets: [],
  };
}

/** @internal */
export function createVerticalPanelState(side: VerticalWidgetPanelSide): VerticalPanelState {
  return {
    ...createPanelState(side),
    side,
  };
}

/** @internal */
export function createHorizontalPanelState(side: HorizontalWidgetPanelSide): HorizontalPanelState {
  return {
    ...createPanelState(side),
    side,
    span: true,
  };
}

/** @internal */
export function createPanelsState(): PanelsState {
  return {
    bottom: createHorizontalPanelState("bottom"),
    left: createVerticalPanelState("left"),
    right: createVerticalPanelState("right"),
    top: createHorizontalPanelState("top"),
  };
}

/** @internal future */
export function createNineZoneState(): NineZoneState {
  return {
    panels: createPanelsState(),
    tabs: {},
    widgets: {},
  };
}

/** @internal */
export function createWidgetState(id: WidgetState["id"]): WidgetState {
  return {
    activeTabId: undefined,
    id,
    minimized: false,
    tabs: [],
  };
}

/** @internal */
export function createTabState(id: TabState["id"]): TabState {
  return {
    id,
    label: "",
  };
}

/** @internal future */
export function addPanelWidget(state: NineZoneState, side: WidgetPanelSide, id: WidgetState["id"], widgetArgs?: Partial<WidgetState>): NineZoneState {
  const widget = {
    ...createWidgetState(id),
    ...widgetArgs,
  };
  return produce(state, (stateDraft) => {
    stateDraft.widgets[widget.id] = castDraft(widget);
    stateDraft.panels[side].widgets.push(widget.id);
  });
}

/** @internal future */
export function addTab(state: NineZoneState, widgetId: WidgetState["id"], id: TabState["id"], tabArgs?: Partial<TabState>): NineZoneState {
  const tab = {
    ...createTabState(id),
    ...tabArgs,
  };
  return produce(state, (stateDraft) => {
    stateDraft.widgets[widgetId].tabs.push(tab.id);
    stateDraft.tabs[id] = tab;
  });
}
