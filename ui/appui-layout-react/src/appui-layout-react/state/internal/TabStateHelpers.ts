/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */

import produce from "immer";
import { UiError } from "@itwin/appui-abstract";
import { NineZoneState } from "../NineZoneState";
import { DraggedTabState, TabsState, TabState } from "../TabState";
import { toolSettingsTabId } from "../ToolSettingsState";
import { category } from "./NineZoneStateHelpers";

/** @internal */
export function createTabState(id: TabState["id"], args?: Partial<TabState>): TabState {
  return {
    label: "",
    ...args,
    id,
  };
}

/** @internal */
export function createTabsState(args?: Partial<TabsState>): TabsState {
  return {
    [toolSettingsTabId]: createTabState(toolSettingsTabId, {
      label: "Tool Settings",
      allowedPanelTargets: ["bottom", "left", "right"],
    }),
    ...args,
  };
}

/** @internal */
export function createDraggedTabState(tabId: DraggedTabState["tabId"], args?: Partial<DraggedTabState>): DraggedTabState {
  return {
    home: {
      side: "left",
      widgetId: undefined,
      widgetIndex: 0,
    },
    position: { x: 0, y: 0 },
    ...args,
    tabId,
  };
}

/** @internal */
export function updateTabState(state: NineZoneState, id: TabState["id"], args: Partial<TabState>) {
  if (!(id in state.tabs))
    throw new UiError(category, "Tab does not exist");

  return produce(state, (draft) => {
    const tab = draft.tabs[id];
    draft.tabs[id] = {
      ...tab,
      ...args,
    };
  });
}
