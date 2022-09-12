/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */

import { UiError } from "@itwin/appui-abstract";
import { RectangleProps } from "@itwin/core-react";
import produce from "immer";
import { PanelSide } from "../widget-panels/Panel";
import { category } from "./internal/NineZoneStateHelpers";
import { addWidgetState, createFloatingWidgetState, createPopoutWidgetState, getNewFloatingWidgetBounds } from "./internal/WidgetStateHelpers";
import { NineZoneState } from "./NineZoneState";
import { TabState } from "./TabState";

/** State of a stacked widget, which can contain multiple tabs. I.e. in a panel section or a floating widget.
 * @internal
 */
export interface WidgetState {
  readonly activeTabId: TabState["id"];
  readonly id: string;
  readonly minimized: boolean;
  readonly tabs: ReadonlyArray<TabState["id"]>;
  readonly isFloatingStateWindowResizable?: boolean;
}

/** @internal */
export interface WidgetsState { readonly [id: string]: WidgetState }

/** @internal */
export interface FloatingWidgetHomeState {
  readonly widgetIndex: number;
  readonly widgetId: WidgetState["id"] | undefined;
  readonly side: PanelSide;
}

/** @internal */
export interface FloatingWidgetState {
  readonly bounds: RectangleProps;
  readonly id: WidgetState["id"];
  readonly home: FloatingWidgetHomeState;
  readonly userSized?: boolean;
  readonly hidden?: boolean;
}

/** @internal */
export interface FloatingWidgetsState {
  readonly byId: { readonly [id: string]: FloatingWidgetState };
  readonly allIds: ReadonlyArray<FloatingWidgetState["id"]>;
}

/** @internal */
export interface PopoutWidgetState {
  readonly bounds: RectangleProps;
  readonly id: WidgetState["id"];
  // TODO: popout widget home could also be a floating widget.
  readonly home: FloatingWidgetHomeState;
}

/** @internal */
export interface PopoutWidgetsState {
  readonly byId: { readonly [id: string]: PopoutWidgetState };
  readonly allIds: ReadonlyArray<PopoutWidgetState["id"]>;
}

/** @internal */
export function addFloatingWidget(state: NineZoneState, id: FloatingWidgetState["id"], tabs: WidgetState["tabs"], floatingWidgetArgs?: Partial<FloatingWidgetState>,
  widgetArgs?: Partial<WidgetState>,
): NineZoneState {
  if (id in state.floatingWidgets.byId)
    throw new UiError(category, "Floating widget already exists");

  state = addWidgetState(state, id, tabs, widgetArgs);

  if (!floatingWidgetArgs?.bounds) {
    const bounds = getNewFloatingWidgetBounds(state);
    floatingWidgetArgs = {
      ...floatingWidgetArgs,
      bounds,
    };
  }
  const floatingWidget = createFloatingWidgetState(id, floatingWidgetArgs);
  return produce(state, (stateDraft) => {
    stateDraft.floatingWidgets.byId[id] = floatingWidget;
    stateDraft.floatingWidgets.allIds.push(id);
  });
}

/** @internal */
export function addPopoutWidget(state: NineZoneState, id: PopoutWidgetState["id"], tabs: WidgetState["tabs"], popoutWidgetArgs?: Partial<PopoutWidgetState>,
  widgetArgs?: Partial<WidgetState>,
): NineZoneState {
  if (tabs.length !== 1)
    throw new UiError(category, "Popout widget should contain one tab only", undefined, () => ({ tabs }));

  const popoutWidget = createPopoutWidgetState(id, popoutWidgetArgs);
  state = addWidgetState(state, id, tabs, widgetArgs);
  return produce(state, (stateDraft) => {
    stateDraft.popoutWidgets.byId[id] = popoutWidget;
    stateDraft.popoutWidgets.allIds.push(id);
  });
}

/** @internal */
export function floatingWidgetBringToFront(state: NineZoneState, floatingWidgetId: FloatingWidgetState["id"]): NineZoneState {
  return produce(state, (draft) => {
    const idIndex = draft.floatingWidgets.allIds.indexOf(floatingWidgetId);
    const spliced = draft.floatingWidgets.allIds.splice(idIndex, 1);
    draft.floatingWidgets.allIds.push(spliced[0]);
  });
}
