/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */

/** @internal */
export const toolSettingsTabId = "nz-tool-settings-tab";

/** @internal */
export interface DockedToolSettingsState {
  readonly type: "docked";
}

/** @internal */
export interface WidgetToolSettingsState {
  readonly type: "widget";
}

/** @internal */
export type ToolSettingsState = DockedToolSettingsState | WidgetToolSettingsState;

/** @internal */
export function isDockedToolSettingsState(state: ToolSettingsState): state is DockedToolSettingsState {
  return state.type === "docked";
}
