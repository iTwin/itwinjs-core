/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

/**
 * Presentation rules support user settings that allow having additional customization of the hierarchy
 * and content based on user preferences.
 *
 * There are [[special ECExpression symbols]] that can be used to access user settings by their Id, so PresentationRule
 * condition can check for a value and change the behavior. It allows to show/hide some nodes in the hierarchy,
 * change the grouping, etc.
 */
export interface UserSettingsGroup {
  /**
   * Label of the category under which all the settings are grouped. If it is not defined, the settings are not grouped.
   *
   * **Note:**
   * Currently this feature is not supported.
   */
  categoryLabel?: string;

  /** Nested user settings. */
  nestedSettings?: UserSettingsGroup[];

  /** Grouped setting items */
  settingsItems?: UserSettingsItem[];
}

export interface UserSettingsItem {
  /**
   * Id of the setting that is used to persist the value. The same id can be used in the
   * conditions to get the setting value.
   */
  id: string;

  /**
   * Label of the setting item that is shown in the UI.
   *
   * **Note:**
   * Currently this feature is not supported.
   */
  label: string;

  /**
   * Defines what type of setting value it is. Possible options:
   * - YesNo - bool value, that uses Yes/No strings in the UI.
   * - ShowHide - bool value, that uses Show/Hide strings in the UI.
   * - StringValue - any String value.
   * - IntValue - any integer value.
   *
   * Default is set to bool value with True/False in the UI.
   */
  options?: string;

  /**
   * Default value of the setting. This is used when application runs first time and there is no
   * persisted value available.
   */
  defaultValue?: string;
}
