/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */

import produce from "immer";
import { UiError } from "@itwin/appui-abstract";
import { category } from "../internal";
import { NineZoneState } from "../NineZoneState";
import { TabState } from "../TabState";

/** @internal */
export function createTabState(id: TabState["id"], args?: Partial<TabState>): TabState {
  return {
    allowedPanelTargets: undefined,
    label: "",
    ...args,
    id,
  };
}

/** @internal */
export function updateTabState(state: NineZoneState, id: TabState["id"], args: Partial<TabState>) {
  if (!(id in state.tabs))
    throw new UiError(category, "Tab not found");

  return produce(state, (draft) => {
    const tab = draft.tabs[id];
    draft.tabs[id] = {
      ...tab,
      ...args,
    };
  });
}
