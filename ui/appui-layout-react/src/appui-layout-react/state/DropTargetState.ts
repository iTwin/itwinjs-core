/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */

import { SizeProps } from "@itwin/core-react";
import { PanelSide } from "../widget-panels/Panel";
import { FloatingWidgetState, WidgetState } from "./WidgetState";

/** @internal */
export interface TabDropTargetState {
  readonly widgetId: WidgetState["id"];
  readonly tabIndex: number;
  readonly type: "tab";
}

/** @internal */
export interface WidgetDropTargetState {
  readonly widgetId: WidgetState["id"];
  readonly type: "widget";
}

/** @internal */
export interface PanelDropTargetState {
  readonly side: PanelSide;
  readonly newWidgetId: WidgetState["id"];
  readonly type: "panel";
}

/** @internal */
export interface SectionDropTargetState {
  readonly side: PanelSide;
  readonly newWidgetId: WidgetState["id"];
  readonly sectionIndex: number;
  readonly type: "section";
}

/** @internal */
export interface FloatingWidgetDropTargetState {
  readonly type: "floatingWidget";
  readonly newFloatingWidgetId: FloatingWidgetState["id"];
  readonly size: SizeProps;
}

/** Drop target of a tab drag action.
 * @internal
 */
export type TabDragDropTargetState = PanelDropTargetState | SectionDropTargetState | WidgetDropTargetState | TabDropTargetState | FloatingWidgetDropTargetState;

/** Default drop target, when nothing is targeted.
 * @internal
 */
export interface WindowDropTargetState {
  readonly type: "window";
}

/** Drop target of a widget drag action.
 * @internal
 */
export type WidgetDragDropTargetState = PanelDropTargetState | SectionDropTargetState | WidgetDropTargetState | TabDropTargetState | WindowDropTargetState;

/** @internal */
export type DropTargetState = TabDragDropTargetState | WidgetDragDropTargetState;

/** @internal */
export function isTabDropTargetState(state: DropTargetState): state is TabDropTargetState {
  return state.type === "tab";
}

/** @internal */
export function isPanelDropTargetState(state: DropTargetState): state is PanelDropTargetState {
  return state.type === "panel";
}

/** @internal */
export function isSectionDropTargetState(state: DropTargetState): state is SectionDropTargetState {
  return state.type === "section";
}

/** @internal */
export function isWidgetDropTargetState(state: DropTargetState): state is WidgetDropTargetState {
  return state.type === "widget";
}

/** @internal */
export function isWindowDropTargetState(state: WidgetDragDropTargetState): state is WindowDropTargetState {
  return state.type === "window";
}

/** @internal */
export function isWidgetDragDropTargetState(state: DropTargetState): state is WidgetDragDropTargetState {
  if (state.type === "floatingWidget")
    return false;
  return true;
}

/** @internal */
export function isTabDragDropTargetState(state: DropTargetState): state is TabDragDropTargetState {
  if (state.type === "window")
    return false;
  return true;
}
