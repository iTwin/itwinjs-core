/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UiSettings
 */

/* eslint-disable deprecation/deprecation */

/** Interface for getting, saving and deleting settings.
 * @public @deprecated The UiSettings APIs are deprecated in favor of the [IModelApp.userPreferences]($frontend) API.
 */
export interface UiSettingsStorage {
  getSetting(settingNamespace: string, settingName: string): Promise<UiSettingsResult>;
  saveSetting(settingNamespace: string, settingName: string, setting: any): Promise<UiSettingsResult>;
  deleteSetting(settingNamespace: string, settingName: string): Promise<UiSettingsResult>;
}

/** Alias for [[UiSettingsStorage]]
 * @public @deprecated The UiSettings APIs are deprecated in favor of the [IModelApp.userPreferences]($frontend) API.
 */
export type UiSettings = UiSettingsStorage;

/** Enum for [[UiSettingsStorage]] status.
 * @public @deprecated The UiSettings APIs are deprecated in favor of the [IModelApp.userPreferences]($frontend) API.
 */
export enum UiSettingsStatus {
  Success = 0,
  NotFound = 1,
  UnknownError = 2,
  Uninitialized = 3,
  AuthorizationError = 4,
}

/** Interface for result of accessing setting in [[UiSettingsStorage]].
 * @public @deprecated The UiSettings APIs are deprecated in favor of the [IModelApp.userPreferences]($frontend) API.
 */
export interface UiSettingsResult {
  status: UiSettingsStatus;
  setting?: any;
}
