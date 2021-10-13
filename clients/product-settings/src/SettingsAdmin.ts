/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Settings
 */

import { AccessToken } from "@itwin/core-bentley";

/** Possible values for SettingsResults.status
 * @beta
 */
export enum SettingsStatus {
  SETTINGS_ERROR_BASE = 0x1b000,
  /** The specified setting was successfully saved, deleted, or retrieved. */
  Success = 0,
  /** Access to the specified setting was blocked. */
  AuthorizationError = SETTINGS_ERROR_BASE + 1,
  /** The Url for the setting is not properly formed. Check the characters in the setting name. */
  UrlError = SETTINGS_ERROR_BASE + 2,
  /** An invalid iTwinId was specified. */
  ITwinInvalid = SETTINGS_ERROR_BASE + 3,
  /** An invalid iModelId was specified. */
  IModelInvalid = SETTINGS_ERROR_BASE + 4,
  /** The setting specified for deletion or retrieval does not exist. */
  SettingNotFound = SETTINGS_ERROR_BASE + 5,
  /** The settings server malfunctioned.  */
  ServerError = SETTINGS_ERROR_BASE + 6,
  /** An unexpected error occurred.  */
  UnknownError = SETTINGS_ERROR_BASE + 8,
}

/** The result of the SettingsAdmin methods to save, retrieve, and delete settings.
 * These are constructed by the SettingsAdmin methods and examined by applications.
 * @beta
 */
export class SettingsResult {
  /** Construct a new SettingsResult. SettingsResult objects are created by the SettingsAdmin methods.
   * @internal
   * @param status The result of the settings method.
   * @param errorMessage An error message that is sometimes returned by the server.
   * @param setting The object returned by the "get" Settings methods.
   */
  constructor(public status: SettingsStatus, public errorMessage?: string, public setting?: any) {
  }
}

/** The result of the SettingsAdmin methods to retrieve all settings by namespace.
 * These are constructed by the SettingsAdmin "getxxxByNamespace" methods and examined by applications.
 * @beta
 */
export class SettingsMapResult {
  /** Construct a new SettingsResult. SettingsResult objects are created by the SettingsAdmin methods.
   * @internal
   * @param status The result of the settings method.
   * @param errorMessage An error message that is sometimes returned by the server.
   * @param settingsMap A Map of name to property objects.
   */
  constructor(public status: SettingsStatus, public errorMessage?: string, public settingsMap?: Map<string, any>) {
  }
}

/** Methods available to save and get Settings objects on behalf of combinations of the Application, iTwin, iModel, and User
 * @beta
 */
export interface SettingsAdmin {

  /** Saves a user-specific settings object to the settings service.
   * @param accessToken A valid access token string.
   * @param settings The object to be saved. It is saved as a JSON string.
   * @param namespace A program-supplied namespace that is used to organize settings and prevent name collisions.
   * @param name The name of the setting. Acceptable characters are alphanumeric and the period character.
   * @param applicationSpecific Specifies whether the setting is specific to the current application, or used by all applications.
   * @param iTwinId The id of the iTwin, if the settings is specific to an iTwin, otherwise undefined.
   * @param iModelId The wsgId of the iModel, if the setting is specific to an iModel, otherwise undefined. The parent iTwinId must be specified if iModelId is specified.
   * @return The result of the save operation. The setting member is undefined for save operations.
   */
  saveUserSetting(accessToken: AccessToken, settings: any, namespace: string, name: string, applicationSpecific: boolean, iTwinId?: string, iModelId?: string): Promise<SettingsResult>;

  /** Retrieves a user-specific settings object from the settings service.
   * @param accessToken A valid access token string.
   * @param namespace A program-supplied namespace that is used to organize settings and prevent name collisions.
   * @param name The name of the setting. Acceptable characters are alphanumeric and the period character.
   * @param applicationSpecific Specifies whether the setting is specific to the current application, or used by all applications.
   * @param iTwinId The id of the iTwin, if the settings is specific to an iTwin, otherwise undefined.
   * @param iModelId The wsgId of the iModel, if the setting is specific to an iModel, otherwise undefined. The parent iTwinId must be specified if iModelId is specified.
   * @return The result of the retrieval operation. The setting member contains the setting if the operation succeeds.
   */
  getUserSetting(accessToken: AccessToken, namespace: string, name: string, applicationSpecific: boolean, iTwinId?: string, iModelId?: string): Promise<SettingsResult>;

  /** Deletes a user-specific settings object from the settings service.
   * @param namespace A program-supplied namespace that is used to organize settings and prevent name collisions.
   * @param name The name of the setting. Acceptable characters are alphanumeric and the period character.
   * @param applicationSpecific Specifies whether the setting is specific to the current application, or used by all applications.
   * @param iTwinId The id of the iTwin, if the settings is specific to an iTwin, otherwise undefined.
   * @param iModelId The wsgId of the iModel, if the setting is specific to an iModel, otherwise undefined. The parent iTwinId must be specified if iModelId is specified.
   * @return The result of the save operation. The setting member is undefined for delete operations. If the setting specified for deletion
   * does not exists, the SettingsResult.status is SettingsStatus.SettingNotFound.
   */
  deleteUserSetting(accessToken: AccessToken, namespace: string, name: string, applicationSpecific: boolean, iTwinId?: string, iModelId?: string): Promise<SettingsResult>;

  /** Retrieves an array of user-specific settings objects that are stored with the specified namespace
   * @param accessToken A valid access token string.
   * @param namespace A program - supplied namespace that is used to organize settings and prevent name collisions.
   * @param applicationSpecific Specifies whether the setting is specific to the current application, or used by all applications.
   * @param iTwinId The id of the iTwin, if the settings is specific to an iTwin, otherwise undefined.
   * @param iModelId The wsgId of the iModel, if the setting is specific to an iModel, otherwise undefined. The parent iTwinId must be specified if iModelId is specified.
   * @return The result of the retrieval operation. If successful, SettingsResult.settingsMap contains a map of string to settings values containing all of the settings stored with the specified namespace.
   */
  getUserSettingsByNamespace(accessToken: AccessToken, namespace: string, applicationSpecific: boolean, iTwinId?: string, iModelId?: string): Promise<SettingsMapResult>;

  /** Saves a shared settings object to the settings service.
   * @param accessToken A valid access token string.
   * @param settings The object to be saved. It is saved as a JSON string.
   * @param namespace A program-supplied namespace that is used to organize settings and prevent name collisions.
   * @param name The name of the setting. Acceptable characters are alphanumeric and the period character.
   * @param applicationSpecific Specifies whether the setting is specific to the current application, or used by all applications.
   * @param iTwinId The id of the iTwin, if the settings is specific to an iTwin, otherwise undefined.
   * @param iModelId The wsgId of the iModel, if the setting is specific to an iModel, otherwise undefined. The parent iTwinId must be specified if iModelId is specified.
   * @return The result of the save operation. The setting member is undefined for save operations.
   */
  saveSharedSetting(accessToken: AccessToken, settings: any, namespace: string, name: string, applicationSpecific: boolean, iTwinId: string, iModelId?: string): Promise<SettingsResult>;

  /** Retrieves a shared settings object from the settings service.
   * @param accessToken A valid access token string.
   * @param namespace A program-supplied namespace that is used to organize settings and prevent name collisions.
   * @param name The name of the setting. Acceptable characters are alphanumeric and the period character.
   * @param applicationSpecific Specifies whether the setting is specific to the current application, or used by all applications.
   * @param iTwinId The id of the iTwin (required for Shared Setting).
   * @param iModelId The wsgId of the iModel, if the setting is specific to an iModel, otherwise undefined.
   * @return The result of the retrieval operation. The setting member contains the setting if the operation succeeds.
   */
  getSharedSetting(accessToken: AccessToken, namespace: string, name: string, applicationSpecific: boolean, iTwinId: string, iModelId?: string): Promise<SettingsResult>;

  /** Deletes a shared settings object from the settings service.
   * @param namespace A program-supplied namespace that is used to organize settings and prevent name collisions.
   * @param name The name of the setting. Acceptable characters are alphanumeric and the period character.
   * @param applicationSpecific Specifies whether the setting is specific to the current application, or used by all applications.
   * @param iTwinId The id of the iTwin (required for Shared Setting).
   * @param iModelId The wsgId of the iModel, if the setting is specific to an iModel, otherwise undefined.
   * @return The result of the save operation. The setting member is undefined for delete operations. If the setting specified for deletion
   * does not exists, the SettingsResult.status is SettingsStatus.SettingNotFound.
   */
  deleteSharedSetting(accessToken: AccessToken, namespace: string, name: string, applicationSpecific: boolean, iTwinId: string, iModelId?: string): Promise<SettingsResult>;

  /** Retrieves an array of shared settings objects that are stored with the specified namespace
   * @param accessToken A valid access token string.
   * @param namespace A program - supplied namespace that is used to organize settings and prevent name collisions.
   * @param applicationSpecific Specifies whether the setting is specific to the current application, or used by all applications.
   * @param iTwinId The id of the iTwin (required for Shared Setting).
   * @param iModelId The wsgId of the iModel, to retrieve settings specific to an iModel, otherwise undefined.
   * @return The result of the retrieval operation. If successful, SettingsResult.settingsMap contains a map of string to settings values containing all of the settings stored with the specified namespace.
   */
  getSharedSettingsByNamespace(accessToken: AccessToken, namespace: string, applicationSpecific: boolean, iTwinId: string, iModelId?: string): Promise<SettingsMapResult>;

  /** Saves a non-user-specific settings object to the settings service.
   * @param accessToken A valid access token string.
   * @param settings The object to be saved. It is saved as a JSON string.
   * @param namespace A program-supplied namespace that is used to organize settings and prevent name collisions.
   * @param name The name of the setting. Acceptable characters are alphanumeric and the period character.
   * @param applicationSpecific Specifies whether the setting is specific to the current application, or used by all applications.
   * @param iTwinId The id of the iTwin, if the settings is specific to an iTwin, otherwise undefined.
   * @param iModelId The wsgId of the iModel, if the setting is specific to an iModel, otherwise undefined. The parent iTwinId must be specified if iModelId is specified.
   * @return The result of the save operation. The setting member is undefined for save operations.
   * @note The logged in user must have the appropriate permissions to save a non-user-specific setting.
   */
  saveSetting(accessToken: AccessToken, settings: any, namespace: string, name: string, applicationSpecific: boolean, iTwinId?: string, iModelId?: string): Promise<SettingsResult>;

  /** Retrieves a non-user-specific settings object from the settings service.
   * @param accessToken A valid access token string.
   * @param namespace A program-supplied namespace that is used to organize settings and prevent name collisions.
   * @param name The name of the setting. Acceptable characters are alphanumeric and the period character.
   * @param applicationSpecific Specifies whether the setting is specific to the current application, or used by all applications.
   * @param iTwinId The id of the iTwin, if the settings is specific to an iTwin, otherwise undefined.
   * @param iModelId The wsgId of the iModel, if the setting is specific to an iModel, otherwise undefined. The parent iTwinId must be specified if iModelId is specified.
   * @return The result of the retrieval operation. The setting member contains the setting if the operation succeeds.
   */
  getSetting(accessToken: AccessToken, namespace: string, name: string, applicationSpecific: boolean, iTwinId?: string, iModelId?: string): Promise<SettingsResult>;

  /** Deletes a non-user-specific settings object from the settings service.
   * @param accessToken A valid access token string.
   * @param namespace A program-supplied namespace that is used to organize settings and prevent name collisions.
   * @param name The name of the setting. Acceptable characters are alphanumeric and the period character.
   * @param applicationSpecific Specifies whether the setting is specific to the current application, or used by all applications.
   * @param iTwinId The id of the iTwin, if the settings is specific to an iTwin, otherwise undefined.
   * @param iModelId The wsgId of the iModel, if the setting is specific to an iModel, otherwise undefined. The parent iTwinId must be specified if iModelId is specified.
   * @return The result of the save operation. The setting member is undefined for delete operations. If the setting specified for deletion
   * does not exists, the SettingsResult.status is SettingsStatus.SettingNotFound.
   * @note The logged in user must have the appropriate permissions to delete a non-user-specific setting.
   */
  deleteSetting(accessToken: AccessToken, namespace: string, name: string, applicationSpecific: boolean, iTwinId?: string, iModelId?: string): Promise<SettingsResult>;

  /** Retrieves an array of non-user-specific settings objects that are stored with the specified namespace
   * @param accessToken A valid access token string.
   * @param namespace A program - supplied namespace that is used to organize settings and prevent name collisions.
   * @param applicationSpecific Specifies whether the setting is specific to the current application, or used by all applications.
   * @param iTwinId The id of the iTwin, if the settings is specific to an iTwin, otherwise undefined.
   * @param iModelId The wsgId of the iModel, if the setting is specific to an iModel, otherwise undefined. The parent iTwinId must be specified if iModelId is specified.
   * @return The result of the retrieval operation. If successful, SettingsResult.settingsMap contains a map of string to settings values containing all of the settings stored with the specified namespace.
   */
  getSettingsByNamespace(accessToken: AccessToken, namespace: string, applicationSpecific: boolean, iTwinId?: string, iModelId?: string): Promise<SettingsMapResult>;
}
