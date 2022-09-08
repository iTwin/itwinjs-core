/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */

import produce from "immer";
import { HorizontalPanelSide, PanelSide, VerticalPanelSide } from "../../widget-panels/Panel";
import { NineZoneState } from "../NineZoneState";
import { HorizontalPanelState, PanelsState, VerticalPanelState } from "../PanelState";

function createPanelState(side: PanelSide) {
  return {
    collapseOffset: 100,
    collapsed: false,
    maxSize: 600,
    minSize: 200,
    pinned: true,
    resizable: true,
    side,
    size: undefined,
    widgets: [],
    maxWidgetCount: 2,
    splitterPercent: 50,
  };
}

/** @internal */
export function createVerticalPanelState(side: VerticalPanelSide, args?: Partial<VerticalPanelState>): VerticalPanelState {
  return {
    ...createPanelState(side),
    ...args,
    side,
  };
}

/** @internal */
export function createHorizontalPanelState(side: HorizontalPanelSide, args?: Partial<HorizontalPanelState>): HorizontalPanelState {
  return {
    ...createPanelState(side),
    minSize: 100,
    span: true,
    ...args,
    side,
  };
}

/** @internal */
export function createPanelsState(args?: Partial<PanelsState>): PanelsState {
  return {
    bottom: createHorizontalPanelState("bottom"),
    left: createVerticalPanelState("left"),
    right: createVerticalPanelState("right"),
    top: createHorizontalPanelState("top"),
    ...args,
  };
}

/** @internal */
export function updatePanelState<K extends keyof PanelsState>(state: NineZoneState, side: K, args: Partial<PanelsState[K]>) {
  return produce(state, (draft) => {
    const panel = draft.panels[side];
    draft.panels[side] = {
      ...panel,
      ...args,
    };
  });
}
