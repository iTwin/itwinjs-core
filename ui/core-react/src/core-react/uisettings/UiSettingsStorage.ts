/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UiSettings
 */

/** eslint-disable deprecation/deprecation */

/** Interface for getting, saving and deleting settings.
 * @public
 * @deprecated Use [[UserPreferences]]
 */
export interface UiSettingsStorage {
  getSetting(settingNamespace: string, settingName: string): Promise<UiSettingsResult>; // eslint-disable-line deprecation/deprecation
  saveSetting(settingNamespace: string, settingName: string, setting: any): Promise<UiSettingsResult>; // eslint-disable-line deprecation/deprecation
  deleteSetting(settingNamespace: string, settingName: string): Promise<UiSettingsResult>; // eslint-disable-line deprecation/deprecation
}

/** Alias for [[UiSettingsStorage]]
 * @public
 */
export type UiSettings = UiSettingsStorage; // eslint-disable-line deprecation/deprecation

/** Enum for [[UiSettingsStorage]] status.
 * @public
 */
export enum UiSettingsStatus {
  Success = 0,
  NotFound = 1,
  UnknownError = 2,
  Uninitialized = 3,
  AuthorizationError = 4,
}

/** Interface for result of accessing setting in [[UiSettingsStorage]].
 * @public
 * @deprecated
 */
export interface UiSettingsResult {
  status: UiSettingsStatus;
  setting?: any;
}
