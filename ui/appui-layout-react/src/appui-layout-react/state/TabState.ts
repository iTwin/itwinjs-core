/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */

import produce from "immer";
import { UiError } from "@itwin/appui-abstract";
import { IconSpec, SizeProps } from "@itwin/core-react";
import { PanelSide } from "../widget-panels/Panel";
import { category } from "./internal";
import { NineZoneState } from "./NineZoneState";
import { WidgetState } from "./WidgetState";
import { findTab } from "./TabLocation";
import { createTabState } from "./internal";

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
    throw new UiError(category, "Tab not found", undefined, () => ({ tabId }));
  if (!(widgetId in state.widgets))
    throw new UiError(category, "Widget not found", undefined, () => ({ widgetId }));
  const location = findTab(state, tabId);
  if (location)
    throw new UiError(category, "Tab is already in a widget", undefined, () => ({ tabId, widgetId: location.widgetId }));

  return produce(state, (draft) => {
    const widget = draft.widgets[widgetId];
    widget.tabs.splice(tabIndex, 0, tabId);
  });
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
