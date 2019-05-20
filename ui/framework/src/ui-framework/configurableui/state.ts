/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module State */

import { createAction, ActionsUnion } from "../utils/redux-ts";
import { SnapMode } from "@bentley/imodeljs-frontend";
import { COLOR_THEME_DEFAULT } from "../theme/ThemeManager";

// cSpell:ignore configurableui snapmode toolprompt

/** Action Ids used by Redux and to send sync UI components. Typically used to refresh visibility or enable state of control.
 *  Since these are also used as sync ids they should be in lowercase.
 * @public
 */
export enum ConfigurableUiActionId {
  SetSnapMode = "configurableui:set_snapmode",
  SetToolPrompt = "configurableui:set_toolprompt",
  SetTheme = "configurableui:set_theme",
  SetWidgetOpacity = "configurableui:set_widget_opacity",
}

/** The portion of state managed by the ConfigurableUiReducer.
 * @public
 */
export interface ConfigurableUiState {
  snapMode: number;
  toolPrompt: string;
  theme: string;
  widgetOpacity: number;
}

/** used on first call of ConfigurableUiReducer */
const initialState: ConfigurableUiState = {
  snapMode: SnapMode.NearestKeypoint as number,
  toolPrompt: "",
  theme: COLOR_THEME_DEFAULT,
  widgetOpacity: 0.90,
};

/** An object with a function that creates each ConfigurableUiReducer that can be handled by our reducer.
 * @public
 */
export const ConfigurableUiActions = {   // tslint:disable-line:variable-name
  setSnapMode: (snapMode: number) => createAction(ConfigurableUiActionId.SetSnapMode, snapMode),
  setToolPrompt: (toolPrompt: string) => createAction(ConfigurableUiActionId.SetToolPrompt, toolPrompt),
  setTheme: (theme: string) => createAction(ConfigurableUiActionId.SetTheme, theme),
  setWidgetOpacity: (opacity: number) => createAction(ConfigurableUiActionId.SetWidgetOpacity, opacity),
};

/** Union of ConfigurableUi Redux actions
 * @public
 */
export type ConfigurableUiActionsUnion = ActionsUnion<typeof ConfigurableUiActions>;

/** Handles actions to update ConfigurableUiState.
 * @public
 */
export function ConfigurableUiReducer(state: ConfigurableUiState = initialState, _action: ConfigurableUiActionsUnion): ConfigurableUiState {
  let outState = state;

  switch (_action.type) {
    case ConfigurableUiActionId.SetSnapMode: {
      // istanbul ignore else
      if (undefined !== _action.payload)
        outState = { ...state, snapMode: _action.payload };
      break;
    }
    case ConfigurableUiActionId.SetToolPrompt: {
      // istanbul ignore else
      if (undefined !== _action.payload)
        outState = { ...state, toolPrompt: _action.payload };
      break;
    }
    case ConfigurableUiActionId.SetTheme: {
      // istanbul ignore else
      if (undefined !== _action.payload)
        outState = { ...state, theme: _action.payload };
      break;
    }
    case ConfigurableUiActionId.SetWidgetOpacity: {
      // istanbul ignore else
      if (undefined !== _action.payload)
        outState = { ...state, widgetOpacity: _action.payload };
      break;
    }
  }

  return outState;
}
