/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */

import { Draft, produce } from "immer";
import { PointProps } from "@itwin/appui-abstract";
import { NineZoneState } from "../NineZoneState";
import { FloatingWidgetHomeState, FloatingWidgetState } from "../WidgetState";
import { Rectangle, RectangleProps, SizeProps } from "@itwin/core-react";
import { toolSettingsTabId } from "../ToolSettingsState";
import { updateFloatingWidgetState } from "./WidgetStateHelpers";

/** @internal */
export const category = "appui-layout-react:layout";

/** Helper that returns a plain object. Prevents from adding an instance that is not `immerable` to the state.
 * @internal
 */
export function toRectangleProps(rectangle: RectangleProps | undefined): RectangleProps {
  if (rectangle) {
    return {
      bottom: rectangle.bottom,
      left: rectangle.left,
      right: rectangle.right,
      top: rectangle.top,
    };
  }
  return new Rectangle().toProps();
}

/** @internal */
export function setRectangleProps(props: Draft<RectangleProps>, bounds: RectangleProps) {
  props.left = bounds.left;
  props.right = bounds.right;
  props.top = bounds.top;
  props.bottom = bounds.bottom;
}

/** @internal */
export function setPointProps(props: Draft<PointProps>, point: PointProps) {
  props.x = point.x;
  props.y = point.y;
}

/** @internal */
export function setSizeProps(props: Draft<SizeProps>, size: SizeProps) {
  props.height = size.height;
  props.width = size.width;
}

type KeysOfType<T, Type> = { [K in keyof T]: T[K] extends Type ? K : never }[keyof T];

/** @internal */
export function initSizeProps<T, K extends KeysOfType<T, SizeProps | undefined>>(obj: T, key: K, size: SizeProps) {
  if (obj[key]) {
    setSizeProps(obj[key] as unknown as SizeProps, size);
    return;
  }
  (obj[key] as unknown as SizeProps) = {
    height: size.height,
    width: size.width,
  };
}

/** @internal */
export function isToolSettingsFloatingWidget(state: NineZoneState, id: FloatingWidgetState["id"]) {
  const widget = state.widgets[id];
  return (widget.tabs.length === 1 &&
    widget.tabs[0] === toolSettingsTabId &&
    id in state.floatingWidgets.byId
  );
}

/** @internal */
export function updateHomeOfToolSettingsWidget(state: NineZoneState, id: FloatingWidgetState["id"], home: FloatingWidgetHomeState): NineZoneState {
  if (!isToolSettingsFloatingWidget(state, id))
    return state;

  return updateFloatingWidgetState(state, id, {
    home,
  });
}

/** @internal */
export function convertFloatingWidgetContainerToPopout(state: NineZoneState, widgetContainerId: string): NineZoneState {
  // istanbul ignore next - not an expected condition
  if (!state.widgets[widgetContainerId]?.tabs || state.widgets[widgetContainerId].tabs.length !== 1) {
    // currently only support popping out a floating widget container if it has a single tab
    return state;
  }
  return produce(state, (draft) => {
    const floatingWidget = state.floatingWidgets.byId[widgetContainerId];
    const bounds = floatingWidget.bounds;
    const home = floatingWidget.home;
    const id = floatingWidget.id;
    // remove the floating entry
    delete draft.floatingWidgets.byId[widgetContainerId];
    const idIndex = draft.floatingWidgets.allIds.indexOf(widgetContainerId);
    draft.floatingWidgets.allIds.splice(idIndex, 1);
    // insert popout entry
    draft.popoutWidgets.byId[widgetContainerId] = { bounds, id, home };
    draft.popoutWidgets.allIds.push(widgetContainerId);
  });
}

/** @internal */
export function convertPopoutWidgetContainerToFloating(state: NineZoneState, widgetContainerId: string): NineZoneState {
  return produce(state, (draft) => {
    const popoutWidget = state.popoutWidgets.byId[widgetContainerId];
    const bounds = popoutWidget.bounds;
    const home = popoutWidget.home;
    const id = popoutWidget.id;
    // remove the floating entry
    delete draft.popoutWidgets.byId[widgetContainerId];
    const idIndex = draft.popoutWidgets.allIds.indexOf(widgetContainerId);
    draft.popoutWidgets.allIds.splice(idIndex, 1);
    // insert popout entry
    draft.floatingWidgets.byId[widgetContainerId] = { bounds, id, home };
    draft.floatingWidgets.allIds.push(widgetContainerId);
  });
}
