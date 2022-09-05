/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */

import produce from "immer";
import { PointProps, UiError } from "@itwin/appui-abstract";
import { IconSpec, SizeProps } from "@itwin/core-react";
import { PanelSide } from "../widget-panels/Panel";
import { NineZoneState } from "./NineZoneState";
import { FloatingWidgetHomeState, WidgetState } from "./WidgetState";
import { getTabLocation } from "./TabLocation";
import { category } from "./internal/NineZoneStateHelpers";
import { createTabState } from "./internal/TabStateHelpers";
import { assertWidgetState, removeWidget, setWidgetActiveTabId, updateWidgetState } from "./internal/WidgetStateHelpers";

/** `WidgetDef` is equivalent structure in `appui-react`.
 * @internal
 */
export interface TabState {
  readonly id: string;
  readonly label: string;
  readonly iconSpec?: IconSpec;
  readonly preferredFloatingWidgetSize?: SizeProps;
  readonly preferredPanelWidgetSize?: "fit-content";
  readonly allowedPanelTargets?: PanelSide[];
  readonly canPopout?: boolean;
  readonly userSized?: boolean;
  readonly isFloatingStateWindowResizable?: boolean;
  readonly hideWithUiWhenFloating?: boolean;
}

/** @internal */
export interface TabsState { readonly [id: string]: TabState }

/** @internal */
export interface DraggedTabState {
  readonly tabId: TabState["id"];
  readonly position: PointProps;
  readonly home: FloatingWidgetHomeState;
}

/** Adds a new `tab`.
 * @internal
 */
export function addTab(state: NineZoneState, id: TabState["id"], tabArgs?: Partial<TabState>): NineZoneState {
  if (id in state.tabs)
    throw new UiError(category, "Tab already exists");
  const tab = {
    ...createTabState(id),
    ...tabArgs,
  };
  return produce(state, (stateDraft) => {
    stateDraft.tabs[id] = tab;
  });
}

/** Adds an existing `tab` to a specified `widget`.
 * @internal
 */
export function addTabToWidget(state: NineZoneState, tabId: TabState["id"], widgetId: WidgetState["id"]): NineZoneState {
  return insertTabToWidget(state, tabId, widgetId, Infinity);
}

/** Inserts an existing `tab` to a specified `widget` at a specified `tabIndex`.
 * @internal
 */
export function insertTabToWidget(state: NineZoneState, tabId: TabState["id"], widgetId: WidgetState["id"], tabIndex: number): NineZoneState {
  if (!(tabId in state.tabs))
    throw new UiError(category, "Tab does not exist", undefined, () => ({ tabId }));
  assertWidgetState(state, widgetId);
  const location = getTabLocation(state, tabId);
  if (location)
    throw new UiError(category, "Tab is already in a widget", undefined, () => ({ tabId, widgetId: location.widgetId }));

  return produce(state, (draft) => {
    const widget = draft.widgets[widgetId];
    widget.tabs.splice(tabIndex, 0, tabId);
  });
}

/** Removes tab from the UI, but keeps the tab state.
 * @internal
 */
export function removeTabFromWidget(state: NineZoneState, tabId: TabState["id"]): NineZoneState {
  const location = getTabLocation(state, tabId);
  if (!location)
    return state;

  const widgetId = location.widgetId;
  const widget = state.widgets[widgetId];
  const tabs = [...widget.tabs];
  const tabIndex = tabs.indexOf(tabId);
  tabs.splice(tabIndex, 1);

  if (tabs.length === 0) {
    return removeWidget(state, widgetId);
  }

  if (tabId === widget.activeTabId) {
    state = setWidgetActiveTabId(state, widget.id, tabs[0]);
  }

  return updateWidgetState(state, widgetId, {
    tabs,
  });
}

/** Removes tab from the UI and deletes the tab state.
 * @internal
 */
export function removeTab(state: NineZoneState, tabId: TabState["id"]): NineZoneState {
  if (!(tabId in state.tabs))
    throw new UiError(category, "Tab does not exist");

  state = removeTabFromWidget(state, tabId);
  return produce(state, (draft) => {
    delete draft.tabs[tabId];
  });
}
