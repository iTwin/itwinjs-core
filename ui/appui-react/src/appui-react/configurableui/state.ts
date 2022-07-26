/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module State
 */

import { SnapMode } from "@itwin/core-frontend";
import { ActionsUnion, createAction } from "../redux/redux-ts";
import { SYSTEM_PREFERRED_COLOR_THEME, WIDGET_OPACITY_DEFAULT } from "../theme/ThemeManager";
import { FrameworkVersionId } from "../UiFramework";

// cSpell:ignore configurableui snapmode toolprompt

/** Action Ids used by Redux and to send sync UI components. Typically used to refresh visibility or enable state of control.
 *  Since these are also used as sync ids they should be in lowercase.
 * @public
 */
export enum ConfigurableUiActionId {
  SetSnapMode = "configurableui:set_snapmode",
  SetTheme = "configurableui:set_theme",
  SetToolPrompt = "configurableui:set_toolprompt",
  SetWidgetOpacity = "configurableui:set_widget_opacity",
  SetDragInteraction = "configurableui:set-drag-interaction",
  SetFrameworkVersion = "configurableui:set-framework-version",
  SetShowWidgetIcon = "configurableui:set-show-widget-icon",
  AutoCollapseUnpinnedPanels = "configurableui:set-auto-collapse-unpinned-panels",
  SetViewOverlayDisplay = "configurableui:set-view-overlay-display",
  AnimateToolSettings = "configurableui:set-animate-tool-settings",
  UseToolAsToolSettingsLabel = "configurableui:set-use-tool-as-tool-settings-label",
}

/** The portion of state managed by the ConfigurableUiReducer.
 * @public
 */
export interface ConfigurableUiState {
  snapMode: number;
  toolPrompt: string;
  theme: string;
  widgetOpacity: number;
  useDragInteraction: boolean;
  frameworkVersion: FrameworkVersionId;
  showWidgetIcon: boolean;
  autoCollapseUnpinnedPanels: boolean;
  viewOverlayDisplay: boolean;
  animateToolSettings: boolean;
  useToolAsToolSettingsLabel: boolean;
}

/** used on first call of ConfigurableUiReducer */
const initialState: ConfigurableUiState = {
  snapMode: SnapMode.NearestKeypoint as number,
  toolPrompt: "",
  theme: SYSTEM_PREFERRED_COLOR_THEME,
  widgetOpacity: WIDGET_OPACITY_DEFAULT,
  useDragInteraction: false,
  frameworkVersion: "2",
  showWidgetIcon: true,
  autoCollapseUnpinnedPanels: false,
  viewOverlayDisplay: true,
  animateToolSettings: false,
  useToolAsToolSettingsLabel: false,
};

/** An object with a function that creates each ConfigurableUiReducer that can be handled by our reducer.
 * @public
 */
export const ConfigurableUiActions = {   // eslint-disable-line @typescript-eslint/naming-convention
  setSnapMode: (snapMode: number) => createAction(ConfigurableUiActionId.SetSnapMode, snapMode),
  setTheme:
    // istanbul ignore next
    (theme: string) => createAction(ConfigurableUiActionId.SetTheme, theme),
  setToolPrompt:
    // istanbul ignore next
    (toolPrompt: string) => createAction(ConfigurableUiActionId.SetToolPrompt, toolPrompt),
  setWidgetOpacity:
    // istanbul ignore next
    (opacity: number) => createAction(ConfigurableUiActionId.SetWidgetOpacity, opacity),
  setDragInteraction: (dragInteraction: boolean) => createAction(ConfigurableUiActionId.SetDragInteraction, dragInteraction),
  setFrameworkVersion: (frameworkVersion: FrameworkVersionId) => createAction(ConfigurableUiActionId.SetFrameworkVersion, frameworkVersion),
  setShowWidgetIcon: (showWidgetIcon: boolean) => createAction(ConfigurableUiActionId.SetShowWidgetIcon, showWidgetIcon),
  setAutoCollapseUnpinnedPanels: (autoCollapse: boolean) => createAction(ConfigurableUiActionId.AutoCollapseUnpinnedPanels, autoCollapse),
  setViewOverlayDisplay: (displayViewOverlay: boolean) => createAction(ConfigurableUiActionId.SetViewOverlayDisplay, displayViewOverlay),
  setAnimateToolSettings: (animateToolSettings: boolean) => createAction(ConfigurableUiActionId.AnimateToolSettings, animateToolSettings),
  setUseToolAsToolSettingsLabel: (useToolAsToolSettingsLabel: boolean) => createAction(ConfigurableUiActionId.UseToolAsToolSettingsLabel, useToolAsToolSettingsLabel),
};

/** Union of ConfigurableUi Redux actions
 * @public
 */
export type ConfigurableUiActionsUnion = ActionsUnion<typeof ConfigurableUiActions>;

/** Handles actions to update ConfigurableUiState.
 * @public
 */
export function ConfigurableUiReducer(state: ConfigurableUiState = initialState, action: ConfigurableUiActionsUnion): ConfigurableUiState {
  const outState = state;

  switch (action.type) {
    case ConfigurableUiActionId.SetSnapMode: {
      return { ...state, snapMode: action.payload };
    }
    case ConfigurableUiActionId.SetToolPrompt: {
      return { ...state, toolPrompt: action.payload };
    }
    case ConfigurableUiActionId.SetTheme: {
      return { ...state, theme: action.payload };
    }
    case ConfigurableUiActionId.SetWidgetOpacity: {
      return { ...state, widgetOpacity: action.payload };
    }
    case ConfigurableUiActionId.SetDragInteraction: {
      return { ...state, useDragInteraction: action.payload };
    }
    case ConfigurableUiActionId.SetFrameworkVersion: {
      const frameworkVersion = (action.payload);
      return { ...state, frameworkVersion };
    }
    case ConfigurableUiActionId.SetShowWidgetIcon: {
      return { ...state, showWidgetIcon: action.payload };
    }
    case ConfigurableUiActionId.AutoCollapseUnpinnedPanels: {
      return { ...state, autoCollapseUnpinnedPanels: action.payload };
    }
    case ConfigurableUiActionId.SetViewOverlayDisplay: {
      return { ...state, viewOverlayDisplay: action.payload };
    }
    case ConfigurableUiActionId.AnimateToolSettings: {
      return { ...state, animateToolSettings: action.payload };
    }
    case ConfigurableUiActionId.UseToolAsToolSettingsLabel: {
      return { ...state, useToolAsToolSettingsLabel: action.payload };
    }
  }
  return outState;
}
