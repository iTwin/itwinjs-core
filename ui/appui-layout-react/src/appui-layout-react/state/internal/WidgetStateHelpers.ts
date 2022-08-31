/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */

import { castDraft, produce } from "immer";
import { UiError } from "@itwin/appui-abstract";
import { NineZoneState } from "../NineZoneState";
import { WidgetState } from "../WidgetState";
import { findTab } from "../TabLocation";
import { category, removeFloatingWidget, removePanelWidget, removePopoutWidget } from "../internal";
import { findWidget, isFloatingWidgetLocation, isPopoutWidgetLocation } from "../WidgetLocation";

/** @internal */
export function createWidgetState(id: WidgetState["id"], tabs: WidgetState["tabs"], args?: Partial<WidgetState>): WidgetState {
  if (tabs.length === 0)
    throw new UiError(category, "Widget must contain tabs");
  return {
    activeTabId: tabs[0],
    minimized: false,
    ...args,
    id,
    tabs,
  };
}

/** @internal */
export function updateWidgetState(state: NineZoneState, id: WidgetState["id"], args: Partial<WidgetState>) {
  if (!(id in state.widgets))
    throw new UiError(category, "Widget not found");

  return produce(state, (draft) => {
    const widget = draft.widgets[id];
    draft.widgets[id] = {
      ...widget,
      ...castDraft(args),
    };
  });
}

/** @internal */
export function addWidgetState(state: NineZoneState, id: WidgetState["id"], tabs: WidgetState["tabs"], args?: Partial<WidgetState>) {
  if (id in state.widgets)
    throw new UiError(category, "Widget already exists");

  const widget = createWidgetState(id, tabs, args);
  for (const tabId of widget.tabs) {
    if (!(tabId in state.tabs))
      throw new UiError(category, "Tab does not exist", undefined, () => ({ tabId }));

    const location = findTab(state, tabId);
    if (location)
      throw new UiError(category, "Tab is already in a widget", undefined, () => ({ tabId, widgetId: location.widgetId }));
  }
  return produce(state, (draft) => {
    draft.widgets[id] = castDraft(widget);
  });
}

/** @internal */
export function removeWidget(state: NineZoneState, id: WidgetState["id"]): NineZoneState {
  const location = findWidget(state, id);
  if (!location)
    throw new UiError(category, "Widget not found");

  if (isFloatingWidgetLocation(location))
    return removeFloatingWidget(state, id);
  if (isPopoutWidgetLocation(location))
    return removePopoutWidget(state, id);
  return removePanelWidget(state, id, location);
}

/** @internal */
export function removeWidgetState(state: NineZoneState, id: WidgetState["id"]): NineZoneState {
  if (!(id in state.widgets))
    throw new UiError(category, "Widget not found");
  return produce(state, (draft) => {
    delete draft.widgets[id];
  });
}
